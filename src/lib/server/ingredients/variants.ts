import { db } from '../db';
import { ingredientVariants, recipeIngredientVariants } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';

/** Find or create a variant for a canonical ingredient */
export async function findOrCreateVariant(
	ingredientId: string,
	name: string,
	nameHe?: string
): Promise<string> {
	const normalized = name.toLowerCase().trim();

	const existing = await db
		.select()
		.from(ingredientVariants)
		.where(
			and(
				eq(ingredientVariants.ingredientId, ingredientId),
				eq(ingredientVariants.name, normalized)
			)
		)
		.limit(1);

	if (existing.length > 0) {
		// Update Hebrew name if provided and missing
		if (nameHe && !existing[0].nameHe) {
			await db
				.update(ingredientVariants)
				.set({ nameHe })
				.where(eq(ingredientVariants.id, existing[0].id));
		}
		return existing[0].id;
	}

	const id = generateId();
	await db.insert(ingredientVariants).values({
		id,
		ingredientId,
		name: normalized,
		nameHe: nameHe || null
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
	variantIds: string[]
): Promise<void> {
	// Delete existing
	await db
		.delete(recipeIngredientVariants)
		.where(eq(recipeIngredientVariants.recipeIngredientId, recipeIngredientId));

	// Insert new
	for (let i = 0; i < variantIds.length; i++) {
		await db.insert(recipeIngredientVariants).values({
			id: generateId(),
			recipeIngredientId,
			variantId: variantIds[i],
			sortOrder: i
		});
	}
}
