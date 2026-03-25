import { redirect, error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes, recipeIngredients, ingredients } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getVariantsForRecipeIngredients } from '$lib/server/ingredients/variants';
import { addIngredientToShoppingList } from '$lib/server/shopping';
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
			aisleCategoryId: ingredients.aisleCategoryId
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
		await db.delete(recipes).where(eq(recipes.id, params.id));
		redirect(302, '/recipes');
	}
};
