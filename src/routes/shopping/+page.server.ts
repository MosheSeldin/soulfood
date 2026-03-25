import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	shoppingLists, shoppingListItems, shoppingListRecipes,
	recipes, recipeIngredients, ingredients, aisleCategories, pantryItems
} from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { aggregateIngredients } from '$lib/utils/quantities';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');

	const addRecipeId = url.searchParams.get('add');

	// Get or create active list
	let activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);

	if (activeList.length === 0) {
		const id = generateId();
		await db.insert(shoppingLists).values({ id, name: 'רשימת קניות', isActive: true });
		activeList = [{ id, name: 'רשימת קניות', createdAt: new Date(), isActive: true }];
	}

	const listId = activeList[0].id;

	// Add recipe if requested
	if (addRecipeId) {
		const exists = await db.select().from(shoppingListRecipes)
			.where(and(eq(shoppingListRecipes.shoppingListId, listId), eq(shoppingListRecipes.recipeId, addRecipeId)))
			.limit(1);

		if (exists.length === 0) {
			await db.insert(shoppingListRecipes).values({
				id: generateId(), shoppingListId: listId, recipeId: addRecipeId
			});
			await regenerateListItems(listId);
		}
	}

	// Load list items
	const items = await db
		.select({
			id: shoppingListItems.id,
			ingredientId: shoppingListItems.ingredientId,
			customName: shoppingListItems.customName,
			quantity: shoppingListItems.quantity,
			unit: shoppingListItems.unit,
			isChecked: shoppingListItems.isChecked,
			aisleCategoryId: shoppingListItems.aisleCategoryId,
			sourceRecipes: shoppingListItems.sourceRecipes,
			addedManually: shoppingListItems.addedManually,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe,
			aisleName: aisleCategories.nameHe,
			aisleSortOrder: aisleCategories.sortOrder,
			aisleIcon: aisleCategories.icon
		})
		.from(shoppingListItems)
		.leftJoin(ingredients, eq(shoppingListItems.ingredientId, ingredients.id))
		.leftJoin(aisleCategories, eq(shoppingListItems.aisleCategoryId, aisleCategories.id))
		.where(eq(shoppingListItems.shoppingListId, listId));

	// Load recipes on this list
	const listRecipes = await db
		.select({ recipeId: shoppingListRecipes.recipeId, title: recipes.title, titleHe: recipes.titleHe })
		.from(shoppingListRecipes)
		.innerJoin(recipes, eq(shoppingListRecipes.recipeId, recipes.id))
		.where(eq(shoppingListRecipes.shoppingListId, listId));

	// Group items by aisle
	const aisleGroups = new Map<string, { name: string; icon: string | null; sortOrder: number; items: typeof items }>();
	for (const item of items) {
		const key = item.aisleCategoryId || 'other';
		if (!aisleGroups.has(key)) {
			aisleGroups.set(key, {
				name: item.aisleName || 'אחר',
				icon: item.aisleIcon,
				sortOrder: item.aisleSortOrder ?? 99,
				items: []
			});
		}
		aisleGroups.get(key)!.items.push(item);
	}

	const sortedAisles = [...aisleGroups.entries()]
		.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([id, data]) => ({ id, ...data }));

	const totalItems = items.length;
	const checkedItems = items.filter((i) => i.isChecked).length;

	return {
		listId,
		aisles: sortedAisles,
		listRecipes,
		totalItems,
		checkedItems,
		addedRecipe: addRecipeId ? true : false
	};
};

async function regenerateListItems(listId: string) {
	// Delete auto-generated items (keep manually added)
	const existingManual = await db.select().from(shoppingListItems)
		.where(and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.addedManually, true)));

	await db.delete(shoppingListItems).where(
		and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.addedManually, false))
	);

	// Get all recipes on this list
	const listRecipeRows = await db.select().from(shoppingListRecipes)
		.where(eq(shoppingListRecipes.shoppingListId, listId));

	if (listRecipeRows.length === 0) return;

	const recipeIds = listRecipeRows.map((r) => r.recipeId);

	// Get all recipe ingredients with their data
	const allIngs = await db
		.select({
			recipeId: recipeIngredients.recipeId,
			ingredientId: recipeIngredients.ingredientId,
			quantity: recipeIngredients.quantity,
			unit: recipeIngredients.unit,
			originalText: recipeIngredients.originalText,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe,
			aisleCategoryId: ingredients.aisleCategoryId
		})
		.from(recipeIngredients)
		.leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
		.where(inArray(recipeIngredients.recipeId, recipeIds));

	// Get servings multipliers
	const recipeServings = new Map<string, number>();
	for (const lr of listRecipeRows) {
		const recipe = await db.select({ servings: recipes.servings }).from(recipes).where(eq(recipes.id, lr.recipeId)).limit(1);
		const defaultServings = recipe[0]?.servings || 1;
		const overrideServings = lr.servings || defaultServings;
		recipeServings.set(lr.recipeId, overrideServings / defaultServings);
	}

	// Scale quantities
	const scaled = allIngs.map((ing) => {
		const multiplier = recipeServings.get(ing.recipeId) || 1;
		return {
			recipeId: ing.recipeId,
			ingredientId: ing.ingredientId,
			name: ing.ingredientName || ing.originalText || 'מצרך',
			nameHe: ing.ingredientNameHe,
			quantity: ing.quantity ? ing.quantity * multiplier : null,
			unit: ing.unit,
			aisleCategoryId: ing.aisleCategoryId
		};
	});

	// Aggregate
	const aggregated = aggregateIngredients(scaled);

	// Check pantry
	const pantry = await db.select().from(pantryItems);
	const pantryMap = new Map(pantry.map((p) => [p.ingredientId, p]));

	// Insert items
	for (const item of aggregated) {
		const inPantry = item.ingredientId ? pantryMap.has(item.ingredientId) : false;
		if (inPantry) continue; // Skip items in pantry

		await db.insert(shoppingListItems).values({
			id: generateId(),
			shoppingListId: listId,
			ingredientId: item.ingredientId,
			quantity: item.quantity,
			unit: item.unit,
			isChecked: false,
			aisleCategoryId: item.aisleCategoryId,
			sourceRecipes: item.sourceRecipeIds,
			addedManually: false
		});
	}
}

export const actions: Actions = {
	toggleItem: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const currentState = data.get('isChecked') === 'true';
		await db.update(shoppingListItems).set({ isChecked: !currentState }).where(eq(shoppingListItems.id, itemId));
	},

	addCustomItem: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		if (!name) return fail(400);

		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return fail(400);

		await db.insert(shoppingListItems).values({
			id: generateId(),
			shoppingListId: activeList[0].id,
			customName: name,
			isChecked: false,
			aisleCategoryId: 'other',
			addedManually: true
		});
	},

	removeRecipe: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const recipeId = data.get('recipeId') as string;
		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return fail(400);

		await db.delete(shoppingListRecipes).where(
			and(eq(shoppingListRecipes.shoppingListId, activeList[0].id), eq(shoppingListRecipes.recipeId, recipeId))
		);
		await regenerateListItems(activeList[0].id);
	},

	clearChecked: async ({ locals }) => {
		if (!locals.user) redirect(302, '/login');
		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return;
		await db.delete(shoppingListItems).where(
			and(eq(shoppingListItems.shoppingListId, activeList[0].id), eq(shoppingListItems.isChecked, true))
		);
	},

	clearAll: async ({ locals }) => {
		if (!locals.user) redirect(302, '/login');
		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return;
		await db.delete(shoppingListItems).where(eq(shoppingListItems.shoppingListId, activeList[0].id));
		await db.delete(shoppingListRecipes).where(eq(shoppingListRecipes.shoppingListId, activeList[0].id));
	}
};
