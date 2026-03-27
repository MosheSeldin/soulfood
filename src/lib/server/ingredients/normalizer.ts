import { db } from '../db';
import { ingredients, ingredientVariants } from '../db/schema';
import { eq, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateVariant } from './variants';
import {
	stripIngredientModifiers,
	extractBaseAndVariant,
	greedyBaseCandidates
} from './classifier';

export interface ResolvedIngredient {
	ingredientId: string;
	variantId?: string;
	matchType: 'exact' | 'hebrew' | 'stripped' | 'variant_table' | 'base_variant' | 'greedy_base' | 'fuzzy' | 'created';
}

/**
 * Smart ingredient resolver.
 * Returns the canonical ingredient ID and, when detected, an auto-created variant ID.
 * Callers can use variantId to write recipeIngredientVariants records automatically.
 */
export async function resolveIngredient(
	name: string,
	nameHe?: string
): Promise<ResolvedIngredient> {
	const normalized = normalizeName(name);
	const lookupHe = nameHe?.trim() || null;

	// ── Step 1: Exact match on English name ────────────────────────────────────
	if (normalized) {
		const exact = await db.select().from(ingredients).where(eq(ingredients.name, normalized)).limit(1);
		if (exact.length > 0) return { ingredientId: exact[0].id, matchType: 'exact' };
	}

	// ── Step 2: Exact match on Hebrew name ─────────────────────────────────────
	if (lookupHe) {
		const heExact = await db.select().from(ingredients).where(eq(ingredients.nameHe, lookupHe)).limit(1);
		if (heExact.length > 0) return { ingredientId: heExact[0].id, matchType: 'hebrew' };
	}

	// Primary lookup name: prefer Hebrew, fall back to English
	const primary = lookupHe || normalized;

	// ── Step 3: Strip PREPARATION + QUALITY words, retry exact match ───────────
	const stripped = stripIngredientModifiers(primary);
	if (stripped && stripped !== primary) {
		const strippedMatch = await db.select().from(ingredients)
			.where(eq(ingredients.nameHe, stripped))
			.limit(1);
		if (strippedMatch.length > 0) return { ingredientId: strippedMatch[0].id, matchType: 'stripped' };

		// Also try English stripped form
		const strippedEn = stripIngredientModifiers(normalized);
		if (strippedEn && strippedEn !== normalized) {
			const strippedEnMatch = await db.select().from(ingredients)
				.where(eq(ingredients.name, strippedEn))
				.limit(1);
			if (strippedEnMatch.length > 0) return { ingredientId: strippedEnMatch[0].id, matchType: 'stripped' };
		}
	}

	// Work with the stripped form from here on
	const workingName = stripped || primary;

	// ── Step 4: Check variant table — is the full name already a stored variant? ─
	const asVariant = await db.select({
		ingredientId: ingredientVariants.ingredientId,
		variantId: ingredientVariants.id
	})
		.from(ingredientVariants)
		.where(eq(ingredientVariants.nameHe, workingName))
		.limit(1);
	if (asVariant.length > 0) {
		return { ingredientId: asVariant[0].ingredientId, variantId: asVariant[0].variantId, matchType: 'variant_table' };
	}

	// ── Step 5: Extract base + variant using classifier ────────────────────────
	const { base, variant } = extractBaseAndVariant(workingName);
	if (variant && base) {
		const baseMatch = await db.select().from(ingredients)
			.where(eq(ingredients.nameHe, base))
			.limit(1);
		if (baseMatch.length > 0) {
			const variantId = await findOrCreateVariant(baseMatch[0].id, variant, variant);
			return { ingredientId: baseMatch[0].id, variantId, matchType: 'base_variant' };
		}
	}

	// ── Step 6: Greedy base lookup (remove rightmost word regardless of class) ──
	if (workingName.includes(' ')) {
		const candidates = greedyBaseCandidates(workingName);
		for (const candidate of candidates) {
			const match = await db.select().from(ingredients)
				.where(eq(ingredients.nameHe, candidate))
				.limit(1);
			if (match.length > 0) {
				// The removed word(s) become the variant label
				const variantLabel = workingName.slice(candidate.length).trim();
				const variantId = await findOrCreateVariant(match[0].id, variantLabel, variantLabel);
				return { ingredientId: match[0].id, variantId, matchType: 'greedy_base' };
			}
		}
	}

	// ── Step 7: Fuzzy fallback (strip English adjectives + LIKE) ───────────────
	const strippedAdj = stripAdjectives(normalized);
	if (strippedAdj && strippedAdj !== normalized) {
		const fuzzy = await db.select().from(ingredients)
			.where(like(ingredients.name, `%${strippedAdj}%`))
			.limit(1);
		if (fuzzy.length > 0) return { ingredientId: fuzzy[0].id, matchType: 'fuzzy' };
	}

	// ── Step 8: Create new canonical ingredient ────────────────────────────────
	// Use the prep/quality-stripped form so we don't persist cooking instructions
	const cleanName = stripIngredientModifiers(normalized) || normalized;
	const cleanNameHe = lookupHe ? (stripIngredientModifiers(lookupHe) || lookupHe) : null;

	const id = generateId();
	await db.insert(ingredients).values({
		id,
		name: cleanName,
		nameHe: cleanNameHe
	});
	return { ingredientId: id, matchType: 'created' };
}

/**
 * Backward-compatible wrapper — returns only the ingredient ID.
 * All existing callers can keep using this without changes.
 */
export async function findOrCreateIngredient(
	name: string,
	nameHe?: string
): Promise<string> {
	return (await resolveIngredient(name, nameHe)).ingredientId;
}

// ────────────────────────────────────────────────────────────────────────────
// Private helpers
// ────────────────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/,.*$/, '')       // remove trailing comma text
		.replace(/\s*\(.*?\)\s*/g, '') // remove parenthetical
		.trim();
}

const LEGACY_ADJECTIVES = [
	'fresh', 'dried', 'organic', 'large', 'medium', 'small',
	'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
	'ground', 'whole', 'boneless', 'skinless', 'extra-virgin',
	'unsalted', 'salted', 'raw', 'cooked', 'frozen', 'canned',
	'packed', 'loosely', 'firmly', 'finely', 'roughly', 'thinly', 'ripe'
];

function stripAdjectives(name: string): string {
	let result = name;
	for (const adj of LEGACY_ADJECTIVES) {
		result = result.replace(new RegExp(`\\b${adj}\\b`, 'gi'), '');
	}
	return result.replace(/\s+/g, ' ').trim();
}
