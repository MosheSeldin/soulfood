import { redirect, error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes, recipeIngredients, ingredients } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getVariantsForRecipeIngredients } from '$lib/server/ingredients/variants';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');

	const recipe = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
	if (recipe.length === 0) error(404, 'מתכון לא נמצא');

	const recipeIngs = await db
		.select({
			id: recipeIngredients.id,
			quantity: recipeIngredients.quantity,
			unit: recipeIngredients.unit,
			originalText: recipeIngredients.originalText,
			preparation: recipeIngredients.preparation,
			isOptional: recipeIngredients.isOptional,
			sortOrder: recipeIngredients.sortOrder,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe
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

	delete: async ({ params, locals }) => {
		if (!locals.user) redirect(302, '/login');
		await db.delete(recipes).where(eq(recipes.id, params.id));
		redirect(302, '/recipes');
	}
};
