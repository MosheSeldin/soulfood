import { db, type Executor } from '../db';
import { ingredients, ingredientVariants } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateVariant } from './variants';
import {
	canonicalize,
	computeNameKey,
	computeVariantKey,
	keyForString,
	isHebrew,
	greedyBaseCandidates,
	stripIngredientModifiers
} from './classifier';

export type MatchType =
	| 'memo'
	| 'name_key'
	| 'hebrew'
	| 'english'
	| 'variant_table'
	| 'base_variant'
	| 'greedy_base'
	| 'created';

export interface ResolvedIngredient {
	ingredientId: string;
	variantId?: string;
	matchType: MatchType;
}

/** Per-request cache to collapse N+1 lookups during bulk inserts (one recipe import). */
export type ResolveMemo = Map<string, ResolvedIngredient>;
export const createResolveMemo = (): ResolveMemo => new Map();

type Input = string | { name?: string | null; nameHe?: string | null };
interface ResolveOpts {
	memo?: ResolveMemo;
	db?: Executor;
}

/**
 * Smart, dedup-proof ingredient resolver.
 *
 * Identity is anchored on a language-tagged `nameKey` (see canonicalize), so the
 * same base ingredient always maps to one canonical row regardless of language,
 * modifiers, or which language slot the caller used. Variants ("olive" oil,
 * "coarse" salt) are detected and linked rather than spawning duplicate bases.
 *
 * Pass `opts.db` to run inside a transaction; pass `opts.memo` to dedupe lookups
 * across a bulk import.
 */
export async function resolveIngredient(input: Input, opts: ResolveOpts = {}): Promise<ResolvedIngredient> {
	const exec = opts.db ?? db;
	const memo = opts.memo;
	const raw = typeof input === 'string' ? { name: input, nameHe: null } : input;
	const c = canonicalize(raw.name, raw.nameHe);

	// Nothing usable → create a bare row so callers always get an id.
	if (!c.nameKey) {
		const id = generateId();
		await exec.insert(ingredients).values({ id, name: raw.name?.trim() || null, nameHe: raw.nameHe?.trim() || null });
		return { ingredientId: id, matchType: 'created' };
	}

	const memoKey = `${c.nameKey}|${c.variantNameHe || c.variantName || ''}`;
	if (memo?.has(memoKey)) return { ...memo.get(memoKey)!, matchType: 'memo' };

	const remember = (r: ResolvedIngredient) => {
		memo?.set(memoKey, r);
		return r;
	};

	// Ensure a base ingredient row exists for key `c.nameKey`, return its id.
	const findOrCreateBase = async (): Promise<string> => {
		// 1. canonical key
		const byKey = await exec.select().from(ingredients).where(eq(ingredients.nameKey, c.nameKey)).limit(1);
		if (byKey.length > 0) return byKey[0].id;

		// 2/3. legacy rows that predate nameKey — match on exact he/en, then backfill the key
		const conds = [];
		if (c.baseNameHe) conds.push(eq(ingredients.nameHe, c.baseNameHe));
		if (c.baseName) conds.push(eq(ingredients.name, c.baseName));
		if (conds.length > 0) {
			const legacy = await exec.select().from(ingredients).where(conds.length === 1 ? conds[0] : or(...conds)).limit(1);
			if (legacy.length > 0) {
				if (!legacy[0].nameKey) {
					await exec.update(ingredients).set({ nameKey: c.nameKey }).where(eq(ingredients.id, legacy[0].id));
				}
				return legacy[0].id;
			}
		}

		// 4. create
		const id = generateId();
		await exec.insert(ingredients).values({
			id,
			name: c.baseName,
			nameHe: c.baseNameHe,
			nameKey: c.nameKey
		});
		return id;
	};

	// ── Case A: the input itself names a variant (e.g. "אורז בסמטי") ────────────
	if (!c.variantNameHe && !c.variantName) {
		const primary = c.baseNameHe || c.baseName;
		const inputVariantKey = computeVariantKey(raw.name, raw.nameHe);
		if (primary && inputVariantKey) {
			// Is the FULL input already a stored variant? Match on the variant key
			// (distinguishes "white onion" from "red onion"), not the base key.
			const asVariant = await exec
				.select({ ingredientId: ingredientVariants.ingredientId, variantId: ingredientVariants.id })
				.from(ingredientVariants)
				.where(
					or(
						eq(ingredientVariants.nameKey, inputVariantKey),
						eq(ingredientVariants.nameHe, primary),
						eq(ingredientVariants.name, primary)
					)
				)
				.limit(1);
			if (asVariant.length > 0) {
				return remember({
					ingredientId: asVariant[0].ingredientId,
					variantId: asVariant[0].variantId,
					matchType: 'variant_table'
				});
			}
		}
	}

	// ── Resolve / create the base ingredient ────────────────────────────────────
	// Fast path: exact base already known.
	const directKey = await exec.select().from(ingredients).where(eq(ingredients.nameKey, c.nameKey)).limit(1);
	if (directKey.length > 0 && !c.variantNameHe && !c.variantName) {
		return remember({ ingredientId: directKey[0].id, matchType: 'name_key' });
	}

	// ── Case B: classifier detected an explicit variant word ────────────────────
	if (c.variantNameHe || c.variantName) {
		const ingredientId = await findOrCreateBase();
		const variantId = await findOrCreateVariant(
			ingredientId,
			c.variantName || c.variantNameHe!,
			c.variantNameHe || c.variantName!,
			exec
		);
		return remember({ ingredientId, variantId, matchType: 'base_variant' });
	}

	// ── Case C: greedy multi-word fallback (base exists, trailing word is a variant) ─
	const primary = c.baseNameHe || c.baseName;
	if (primary && primary.includes(' ')) {
		for (const candidate of greedyBaseCandidates(stripIngredientModifiers(primary) || primary)) {
			const candKey = keyForString(candidate);
			const match = await exec.select().from(ingredients).where(eq(ingredients.nameKey, candKey)).limit(1);
			if (match.length > 0) {
				const variantLabel = primary.slice(candidate.length).trim() || primary;
				const variantId = await findOrCreateVariant(match[0].id, variantLabel, isHebrew(variantLabel) ? variantLabel : undefined, exec);
				return remember({ ingredientId: match[0].id, variantId, matchType: 'greedy_base' });
			}
		}
	}

	// ── Case D: brand-new base ingredient ───────────────────────────────────────
	const ingredientId = await findOrCreateBase();
	const created = directKey.length === 0;
	return remember({ ingredientId, matchType: created ? 'created' : 'name_key' });
}

/** Backward-compatible wrapper — returns only the ingredient ID. */
export async function findOrCreateIngredient(
	name: string,
	nameHe?: string,
	opts: ResolveOpts = {}
): Promise<string> {
	return (await resolveIngredient(nameHe ? { name, nameHe } : name, opts)).ingredientId;
}

// Re-export the key helper so callers/migrations import from one place.
export { computeNameKey, canonicalize } from './classifier';
