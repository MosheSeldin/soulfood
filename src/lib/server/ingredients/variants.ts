import { db, type Executor } from '../db';
import { ingredientVariants, recipeIngredientVariants } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { computeVariantKey, isHebrew } from './classifier';

/**
 * Find or create a variant for a canonical ingredient.
 * Deduped on (ingredientId, nameKey) so the same product type never doubles up,
 * regardless of casing/language slot.
 */
export async function findOrCreateVariant(
	ingredientId: string,
	name: string,
	nameHe?: string,
	exec: Executor = db
): Promise<string> {
	const cleanName = (name || nameHe || '').trim();
	const cleanHe = (nameHe || (isHebrew(name) ? name : ''))?.trim() || null;
	const nameKey = computeVariantKey(cleanName, cleanHe);

	// Prefer a stable match on nameKey; fall back to legacy (ingredientId, name).
	const existing = await exec
		.select()
		.from(ingredientVariants)
		.where(
			and(
				eq(ingredientVariants.ingredientId, ingredientId),
				nameKey ? eq(ingredientVariants.nameKey, nameKey) : eq(ingredientVariants.name, cleanName.toLowerCase())
			)
		)
		.limit(1);

	if (existing.length > 0) {
		const patch: Partial<typeof ingredientVariants.$inferInsert> = {};
		if (cleanHe && !existing[0].nameHe) patch.nameHe = cleanHe;
		if (nameKey && !existing[0].nameKey) patch.nameKey = nameKey;
		if (Object.keys(patch).length > 0) {
			await exec.update(ingredientVariants).set(patch).where(eq(ingredientVariants.id, existing[0].id));
		}
		return existing[0].id;
	}

	const id = generateId();
	await exec.insert(ingredientVariants).values({
		id,
		ingredientId,
		name: cleanName.toLowerCase(),
		nameHe: cleanHe,
		nameKey: nameKey || null
	});
	return id;
}

/** Get all variants for a list of recipe ingredient IDs */
export async function getVariantsForRecipeIngredients(
	recipeIngredientIds: string[]
): Promise<
	Record<
		string,
		Array<{ variantId: string; name: string; nameHe: string | null; sortOrder: number }>
	>
> {
	if (recipeIngredientIds.length === 0) return {};

	const allRows = await db
		.select({
			recipeIngredientId: recipeIngredientVariants.recipeIngredientId,
			variantId: ingredientVariants.id,
			name: ingredientVariants.name,
			nameHe: ingredientVariants.nameHe,
			sortOrder: recipeIngredientVariants.sortOrder
		})
		.from(recipeIngredientVariants)
		.innerJoin(
			ingredientVariants,
			eq(recipeIngredientVariants.variantId, ingredientVariants.id)
		)
		.where(inArray(recipeIngredientVariants.recipeIngredientId, recipeIngredientIds));

	const result: Record<
		string,
		Array<{ variantId: string; name: string; nameHe: string | null; sortOrder: number }>
	> = {};

	for (const row of allRows) {
		if (!result[row.recipeIngredientId]) {
			result[row.recipeIngredientId] = [];
		}
		result[row.recipeIngredientId].push({
			variantId: row.variantId,
			name: row.name,
			nameHe: row.nameHe,
			sortOrder: row.sortOrder
		});
	}

	// Sort each array by sortOrder
	for (const key of Object.keys(result)) {
		result[key].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	return result;
}

/** Set variants for a recipe ingredient (replaces existing) */
export async function setRecipeIngredientVariants(
	recipeIngredientId: string,
	variantIds: string[],
	exec: Executor = db
): Promise<void> {
	// Delete existing
	await exec
		.delete(recipeIngredientVariants)
		.where(eq(recipeIngredientVariants.recipeIngredientId, recipeIngredientId));

	// Insert new
	for (let i = 0; i < variantIds.length; i++) {
		await exec.insert(recipeIngredientVariants).values({
			id: generateId(),
			recipeIngredientId,
			variantId: variantIds[i],
			sortOrder: i
		});
	}
}
