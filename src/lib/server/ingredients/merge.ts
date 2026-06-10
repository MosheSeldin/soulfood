import { db, type Executor } from '../db';
import {
	ingredients,
	ingredientVariants,
	recipeIngredients,
	recipeIngredientVariants,
	pantryItems,
	shoppingListItems
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { sumNullable } from '$lib/utils/quantities';

/**
 * Merge ingredient `fromId` into `toId`, re-pointing every reference and
 * collapsing anything that would otherwise violate the new uniqueness indexes
 * (one pantry row per ingredient, one variant per (ingredient, nameKey), one
 * list item per (list, ingredient, variant)). Safe to run inside a transaction.
 */
export async function mergeIngredientInto(fromId: string, toId: string, exec: Executor = db): Promise<void> {
	if (fromId === toId) return;

	// recipe_ingredients carry no uniqueness — straight re-point.
	await exec.update(recipeIngredients).set({ ingredientId: toId }).where(eq(recipeIngredients.ingredientId, fromId));

	// ── Variants ────────────────────────────────────────────────────────────────
	const fromVariants = await exec.select().from(ingredientVariants).where(eq(ingredientVariants.ingredientId, fromId));
	const toVariants = await exec.select().from(ingredientVariants).where(eq(ingredientVariants.ingredientId, toId));
	const toByKey = new Map(toVariants.filter((v) => v.nameKey).map((v) => [v.nameKey!, v.id]));

	for (const fv of fromVariants) {
		const survivor = fv.nameKey ? toByKey.get(fv.nameKey) : undefined;
		if (survivor) {
			await exec.update(recipeIngredientVariants).set({ variantId: survivor }).where(eq(recipeIngredientVariants.variantId, fv.id));
			await exec.update(shoppingListItems).set({ chosenVariantId: survivor }).where(eq(shoppingListItems.chosenVariantId, fv.id));
			await exec.delete(ingredientVariants).where(eq(ingredientVariants.id, fv.id));
		} else {
			await exec.update(ingredientVariants).set({ ingredientId: toId }).where(eq(ingredientVariants.id, fv.id));
			if (fv.nameKey) toByKey.set(fv.nameKey, fv.id);
		}
	}

	// ── Pantry (unique per ingredient) ───────────────────────────────────────────
	const toPantry = await exec.select().from(pantryItems).where(eq(pantryItems.ingredientId, toId)).limit(1);
	if (toPantry.length > 0) {
		await exec.delete(pantryItems).where(eq(pantryItems.ingredientId, fromId));
	} else {
		await exec.update(pantryItems).set({ ingredientId: toId }).where(eq(pantryItems.ingredientId, fromId));
	}

	// ── Shopping list items (unique per list+ingredient+variant) ─────────────────
	const fromItems = await exec.select().from(shoppingListItems).where(eq(shoppingListItems.ingredientId, fromId));
	const toItems = await exec.select().from(shoppingListItems).where(eq(shoppingListItems.ingredientId, toId));
	const toItemByKey = new Map(toItems.map((it) => [`${it.shoppingListId}|${it.chosenVariantId ?? ''}`, it]));
	for (const fi of fromItems) {
		const k = `${fi.shoppingListId}|${fi.chosenVariantId ?? ''}`;
		const collide = toItemByKey.get(k);
		if (collide) {
			await exec
				.update(shoppingListItems)
				.set({ quantity: sumNullable(collide.quantity, fi.quantity), updatedAt: new Date() })
				.where(eq(shoppingListItems.id, collide.id));
			await exec.delete(shoppingListItems).where(eq(shoppingListItems.id, fi.id));
		} else {
			await exec.update(shoppingListItems).set({ ingredientId: toId, updatedAt: new Date() }).where(eq(shoppingListItems.id, fi.id));
			toItemByKey.set(k, { ...fi, ingredientId: toId });
		}
	}

	// ── Absorb names (fill only the survivor's blanks) then drop the merged row ──
	const [from] = await exec.select().from(ingredients).where(eq(ingredients.id, fromId)).limit(1);
	const [to] = await exec.select().from(ingredients).where(eq(ingredients.id, toId)).limit(1);
	if (from && to) {
		const patch: { name?: string; nameHe?: string } = {};
		if (!to.name && from.name) patch.name = from.name;
		if (!to.nameHe && from.nameHe) patch.nameHe = from.nameHe;
		if (Object.keys(patch).length > 0) {
			await exec.update(ingredients).set(patch).where(eq(ingredients.id, toId));
		}
	}
	await exec.delete(ingredients).where(eq(ingredients.id, fromId));
}
