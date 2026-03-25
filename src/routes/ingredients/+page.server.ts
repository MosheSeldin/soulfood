import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { ingredients, aisleCategories } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { addIngredientToShoppingList } from '$lib/server/shopping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const allIngredients = await db
		.select({
			id: ingredients.id,
			name: ingredients.name,
			nameHe: ingredients.nameHe,
			aisleCategoryId: ingredients.aisleCategoryId,
			defaultUnit: ingredients.defaultUnit,
			aisleName: aisleCategories.name,
			aisleNameHe: aisleCategories.nameHe
		})
		.from(ingredients)
		.leftJoin(aisleCategories, eq(ingredients.aisleCategoryId, aisleCategories.id))
		.orderBy(ingredients.nameHe);

	const allAisles = await db
		.select()
		.from(aisleCategories)
		.orderBy(aisleCategories.sortOrder);

	return { ingredients: allIngredients, aisleCategories: allAisles };
};

export const actions: Actions = {
	updateIngredient: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const ingredientId = data.get('ingredientId') as string;
		const name = (data.get('name') as string)?.trim();
		const nameHe = (data.get('nameHe') as string)?.trim() || null;
		const aisleCategoryId = (data.get('aisleCategoryId') as string)?.trim() || null;

		if (!ingredientId || !name) return fail(400);

		await db
			.update(ingredients)
			.set({ name, nameHe, aisleCategoryId })
			.where(eq(ingredients.id, ingredientId));
	},

	addToShoppingList: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const ingredientId = data.get('ingredientId') as string;
		if (!ingredientId) return fail(400);

		const aisleCategoryId = (data.get('aisleCategoryId') as string)?.trim() || null;
		const defaultUnit = (data.get('defaultUnit') as string)?.trim() || null;

		await addIngredientToShoppingList({
			ingredientId,
			quantity: null,
			unit: defaultUnit,
			aisleCategoryId
		});

		return { addedIngredientId: ingredientId };
	}
};
