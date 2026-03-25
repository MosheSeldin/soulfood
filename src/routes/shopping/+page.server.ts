import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	shoppingLists, shoppingListItems, shoppingListRecipes,
	recipes, recipeIngredients, ingredients, aisleCategories, pantryItems,
	ingredientVariants, recipeIngredientVariants
} from '$lib/server/db/schema';
import { eq, and, inArray, or, like } from 'drizzle-orm';
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

	// Load list items with chosen variant info
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
			chosenVariantId: shoppingListItems.chosenVariantId,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe,
			aisleName: aisleCategories.nameHe,
			aisleSortOrder: aisleCategories.sortOrder,
			aisleIcon: aisleCategories.icon,
			variantName: ingredientVariants.name,
			variantNameHe: ingredientVariants.nameHe
		})
		.from(shoppingListItems)
		.leftJoin(ingredients, eq(shoppingListItems.ingredientId, ingredients.id))
		.leftJoin(aisleCategories, eq(shoppingListItems.aisleCategoryId, aisleCategories.id))
		.leftJoin(ingredientVariants, eq(shoppingListItems.chosenVariantId, ingredientVariants.id))
		.where(eq(shoppingListItems.shoppingListId, listId));

	// For items with ingredients that have variants, load available variants
	const ingredientIds = [...new Set(items.filter(i => i.ingredientId).map(i => i.ingredientId!))];
	let availableVariants: Record<string, Array<{ id: string; name: string; nameHe: string | null }>> = {};
	if (ingredientIds.length > 0) {
		const allVariants = await db
			.select({
				id: ingredientVariants.id,
				ingredientId: ingredientVariants.ingredientId,
				name: ingredientVariants.name,
				nameHe: ingredientVariants.nameHe
			})
			.from(ingredientVariants)
			.where(inArray(ingredientVariants.ingredientId, ingredientIds));

		for (const v of allVariants) {
			if (!availableVariants[v.ingredientId]) availableVariants[v.ingredientId] = [];
			availableVariants[v.ingredientId].push({ id: v.id, name: v.name, nameHe: v.nameHe });
		}
	}

	// Enrich items with available variants
	const enrichedItems = items.map(item => ({
		...item,
		availableVariants: item.ingredientId ? (availableVariants[item.ingredientId] || []) : []
	}));

	// Load recipes on this list
	const listRecipes = await db
		.select({ recipeId: shoppingListRecipes.recipeId, title: recipes.title, titleHe: recipes.titleHe })
		.from(shoppingListRecipes)
		.innerJoin(recipes, eq(shoppingListRecipes.recipeId, recipes.id))
		.where(eq(shoppingListRecipes.shoppingListId, listId));

	// Group items by aisle
	const aisleGroups = new Map<string, { name: string; icon: string | null; sortOrder: number; items: typeof enrichedItems }>();
	for (const item of enrichedItems) {
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

	// Merge manual items that overlap with recipe-derived items
	const manualWithIngredient = existingManual.filter(m => m.ingredientId);
	for (const manual of manualWithIngredient) {
		const recipeItem = await db.select().from(shoppingListItems)
			.where(and(
				eq(shoppingListItems.shoppingListId, listId),
				eq(shoppingListItems.ingredientId, manual.ingredientId!),
				eq(shoppingListItems.addedManually, false)
			))
			.limit(1);

		if (recipeItem.length > 0) {
			// Add manual quantity to recipe item, then remove the manual row
			const combined = (recipeItem[0].quantity || 0) + (manual.quantity || 0);
			await db.update(shoppingListItems)
				.set({ quantity: combined > 0 ? combined : recipeItem[0].quantity })
				.where(eq(shoppingListItems.id, recipeItem[0].id));
			await db.delete(shoppingListItems).where(eq(shoppingListItems.id, manual.id));
		}
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

	searchIngredients: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const q = (data.get('q') as string)?.trim();
		if (!q || q.length < 2) return { results: [] };

		const pattern = `%${q}%`;
		const results = await db
			.select({
				id: ingredients.id,
				name: ingredients.name,
				nameHe: ingredients.nameHe,
				aisleCategoryId: ingredients.aisleCategoryId,
				defaultUnit: ingredients.defaultUnit
			})
			.from(ingredients)
			.where(or(like(ingredients.name, pattern), like(ingredients.nameHe, pattern)))
			.limit(8);

		return { results };
	},

	addCustomItem: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const ingredientId = (data.get('ingredientId') as string)?.trim() || null;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		const quantity = quantityStr ? parseFloat(quantityStr) : null;

		if (!name && !ingredientId) return fail(400);

		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return fail(400);
		const listId = activeList[0].id;

		if (ingredientId) {
			// Check if this ingredient already exists on the list
			const existing = await db.select().from(shoppingListItems)
				.where(and(
					eq(shoppingListItems.shoppingListId, listId),
					eq(shoppingListItems.ingredientId, ingredientId)
				))
				.limit(1);

			if (existing.length > 0 && quantity) {
				// Merge: add quantity to existing item
				const currentQty = existing[0].quantity || 0;
				await db.update(shoppingListItems)
					.set({ quantity: currentQty + quantity, unit: unit || existing[0].unit })
					.where(eq(shoppingListItems.id, existing[0].id));
			} else if (existing.length === 0) {
				// New canonical item
				const ing = await db.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1);
				await db.insert(shoppingListItems).values({
					id: generateId(),
					shoppingListId: listId,
					ingredientId,
					quantity,
					unit: unit || ing[0]?.defaultUnit,
					isChecked: false,
					aisleCategoryId: ing[0]?.aisleCategoryId || 'other',
					addedManually: true
				});
			}
		} else {
			// Free text custom item
			await db.insert(shoppingListItems).values({
				id: generateId(),
				shoppingListId: listId,
				customName: name,
				isChecked: false,
				aisleCategoryId: 'other',
				addedManually: true
			});
		}
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

	chooseVariant: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const variantId = data.get('variantId') as string;
		if (!itemId || !variantId) return fail(400);
		await db.update(shoppingListItems)
			.set({ chosenVariantId: variantId })
			.where(eq(shoppingListItems.id, itemId));
	},

	updateQuantity: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		if (!itemId) return fail(400);
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		await db.update(shoppingListItems)
			.set({ quantity, ...(unit ? { unit } : {}) })
			.where(eq(shoppingListItems.id, itemId));
	},

	deleteItem: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		if (!itemId) return fail(400);
		await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
	},

	clearAll: async ({ locals }) => {
		if (!locals.user) redirect(302, '/login');
		const activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
		if (activeList.length === 0) return;
		await db.delete(shoppingListItems).where(eq(shoppingListItems.shoppingListId, activeList[0].id));
		await db.delete(shoppingListRecipes).where(eq(shoppingListRecipes.shoppingListId, activeList[0].id));
	}
};
