import { redirect, error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	recipes, recipeIngredients, ingredients,
	recipeIngredientVariants, shoppingListRecipes, shoppingLists
} from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getVariantsForRecipeIngredients } from '$lib/server/ingredients/variants';
import { addIngredientToShoppingList, reconcileList } from '$lib/server/shopping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');

	const recipe = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
	if (recipe.length === 0) error(404, 'מתכון לא נמצא');

	const recipeIngs = await db
		.select({
			id: recipeIngredients.id,
			ingredientId: recipeIngredients.ingredientId,
			quantity: recipeIngredients.quantity,
			unit: recipeIngredients.unit,
			originalText: recipeIngredients.originalText,
			preparation: recipeIngredients.preparation,
			isOptional: recipeIngredients.isOptional,
			sortOrder: recipeIngredients.sortOrder,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe,
			aisleCategoryId: ingredients.aisleCategoryId,
				isMaayan: ingredients.isMaayan,
				maayanTop: ingredients.maayanTop
		})
		.from(recipeIngredients)
		.leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
		.where(eq(recipeIngredients.recipeId, params.id))
		.orderBy(recipeIngredients.sortOrder);

	// Fetch variants for all recipe ingredients
	const recipeIngIds = recipeIngs.map((ri) => ri.id);
	const variantsMap = await getVariantsForRecipeIngredients(recipeIngIds);

	const ingredientsWithVariants = recipeIngs.map((ri) => ({
		...ri,
		variants: variantsMap[ri.id] || []
	}));

	return {
		recipe: recipe[0],
		ingredients: ingredientsWithVariants
	};
};

export const actions: Actions = {
	toggleFavorite: async ({ params, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const recipe = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
		if (recipe.length === 0) return fail(404);
		await db
			.update(recipes)
			.set({ isFavorite: !recipe[0].isFavorite })
			.where(eq(recipes.id, params.id));
	},

	addToShoppingList: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const ingredientId = data.get('ingredientId') as string;
		if (!ingredientId) return fail(400);

		const quantityStr = data.get('quantity') as string;
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		const unit = (data.get('unit') as string)?.trim() || null;
		const aisleCategoryId = (data.get('aisleCategoryId') as string)?.trim() || null;
		const variantId = (data.get('variantId') as string)?.trim() || null;

		await addIngredientToShoppingList({
			ingredientId,
			quantity,
			unit,
			aisleCategoryId,
			chosenVariantId: variantId
		});

		return { addedIngredientId: ingredientId };
	},

	delete: async ({ params, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const affectedLists = await db
			.select({ id: shoppingListRecipes.shoppingListId })
			.from(shoppingListRecipes)
			.where(eq(shoppingListRecipes.recipeId, params.id));

		await db.transaction(async (tx) => {
			// FK enforcement is off in libsql — remove dependents explicitly.
			const riIds = (
				await tx.select({ id: recipeIngredients.id }).from(recipeIngredients).where(eq(recipeIngredients.recipeId, params.id))
			).map((r) => r.id);
			if (riIds.length > 0) {
				await tx.delete(recipeIngredientVariants).where(inArray(recipeIngredientVariants.recipeIngredientId, riIds));
			}
			await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, params.id));
			await tx.delete(shoppingListRecipes).where(eq(shoppingListRecipes.recipeId, params.id));
			await tx.delete(recipes).where(eq(recipes.id, params.id));

			// Keep any list this recipe was on consistent.
			for (const listId of new Set(affectedLists.map((l) => l.id))) {
				await reconcileList(listId, tx);
			}
		});

		redirect(302, '/recipes');
	}
};
