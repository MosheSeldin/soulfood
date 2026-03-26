import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	ingredients,
	aisleCategories,
	ingredientVariants,
	recipeIngredients,
	pantryItems,
	shoppingListItems
} from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { addIngredientToShoppingList } from '$lib/server/shopping';
import { generateId } from '$lib/utils/helpers';
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
			aisleNameHe: aisleCategories.nameHe,
			usageCount: sql<number>`(SELECT COUNT(*) FROM recipe_ingredients WHERE ingredient_id = ingredients.id)`
		})
		.from(ingredients)
		.leftJoin(aisleCategories, eq(ingredients.aisleCategoryId, aisleCategories.id))
		.orderBy(ingredients.nameHe);

	const allVariants = await db
		.select({
			id: ingredientVariants.id,
			ingredientId: ingredientVariants.ingredientId,
			name: ingredientVariants.name,
			nameHe: ingredientVariants.nameHe
		})
		.from(ingredientVariants);

	const variantsByIngredient: Record<string, typeof allVariants> = {};
	for (const v of allVariants) {
		if (!variantsByIngredient[v.ingredientId]) variantsByIngredient[v.ingredientId] = [];
		variantsByIngredient[v.ingredientId].push(v);
	}

	const allAisles = await db.select().from(aisleCategories).orderBy(aisleCategories.sortOrder);

	return {
		ingredients: allIngredients.map((ing) => ({
			...ing,
			variants: variantsByIngredient[ing.id] || []
		})),
		aisleCategories: allAisles
	};
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

	deleteIngredient: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const ingredientId = data.get('ingredientId') as string;
		if (!ingredientId) return fail(400);

		const [usage] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(recipeIngredients)
			.where(eq(recipeIngredients.ingredientId, ingredientId));

		if ((usage?.count ?? 0) > 0) return fail(400, { error: 'ingredient in use' });

		await db.delete(ingredientVariants).where(eq(ingredientVariants.ingredientId, ingredientId));
		await db.delete(pantryItems).where(eq(pantryItems.ingredientId, ingredientId));
		await db.delete(ingredients).where(eq(ingredients.id, ingredientId));
	},

	mergeIngredient: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const fromId = data.get('fromId') as string;
		const toId = data.get('toId') as string;

		if (!fromId || !toId || fromId === toId) return fail(400);

		// Re-point all references
		await db
			.update(recipeIngredients)
			.set({ ingredientId: toId })
			.where(eq(recipeIngredients.ingredientId, fromId));
		await db
			.update(pantryItems)
			.set({ ingredientId: toId })
			.where(eq(pantryItems.ingredientId, fromId));
		await db
			.update(shoppingListItems)
			.set({ ingredientId: toId })
			.where(eq(shoppingListItems.ingredientId, fromId));
		await db
			.update(ingredientVariants)
			.set({ ingredientId: toId })
			.where(eq(ingredientVariants.ingredientId, fromId));

		await db.delete(ingredients).where(eq(ingredients.id, fromId));
	},

	addVariant: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const ingredientId = data.get('ingredientId') as string;
		const variantNameHe = (data.get('variantNameHe') as string)?.trim();
		const variantName = (data.get('variantName') as string)?.trim() || variantNameHe || '';

		if (!ingredientId || !variantName) return fail(400);

		await db.insert(ingredientVariants).values({
			id: generateId(),
			ingredientId,
			name: variantName.toLowerCase(),
			nameHe: variantNameHe || null
		});
	},

	deleteVariant: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const variantId = data.get('variantId') as string;
		if (!variantId) return fail(400);
		await db.delete(ingredientVariants).where(eq(ingredientVariants.id, variantId));
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
