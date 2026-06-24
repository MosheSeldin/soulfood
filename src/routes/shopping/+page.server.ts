import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	shoppingLists, shoppingListItems, shoppingListRecipes,
	recipes, ingredients, aisleCategories,
	ingredientVariants
} from '$lib/server/db/schema';
import { eq, and, inArray, or, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { keyForString } from '$lib/server/ingredients/classifier';
import { reconcileList, touchList, getOrCreateActiveShoppingList, addTemplateToActiveList } from '$lib/server/shopping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {

	const addRecipeId = url.searchParams.get('add');
	const addedCount = url.searchParams.get('added');

	let activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
	if (activeList.length === 0) {
		const id = generateId();
		await db.insert(shoppingLists).values({ id, name: 'רשימת קניות', isActive: true });
		activeList = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id)).limit(1);
	}
	const listId = activeList[0].id;

	if (addRecipeId) {
		const exists = await db.select().from(shoppingListRecipes)
			.where(and(eq(shoppingListRecipes.shoppingListId, listId), eq(shoppingListRecipes.recipeId, addRecipeId)))
			.limit(1);
		if (exists.length === 0) {
			await db.insert(shoppingListRecipes).values({ id: generateId(), shoppingListId: listId, recipeId: addRecipeId });
			await reconcileList(listId);
		}
	}

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
				isMaayan: ingredients.isMaayan,
				maayanTop: ingredients.maayanTop,
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

	const ingredientIds = [...new Set(items.filter(i => i.ingredientId).map(i => i.ingredientId!))];
	let availableVariants: Record<string, Array<{ id: string; name: string; nameHe: string | null }>> = {};
	if (ingredientIds.length > 0) {
		const allVariants = await db
			.select({ id: ingredientVariants.id, ingredientId: ingredientVariants.ingredientId, name: ingredientVariants.name, nameHe: ingredientVariants.nameHe })
			.from(ingredientVariants)
			.where(inArray(ingredientVariants.ingredientId, ingredientIds));
		for (const v of allVariants) {
			if (!availableVariants[v.ingredientId]) availableVariants[v.ingredientId] = [];
			availableVariants[v.ingredientId].push({ id: v.id, name: v.name, nameHe: v.nameHe });
		}
	}

	// names of source recipes, for "from: X, Y" display
	const allRecipeIds = [...new Set(items.flatMap((i) => i.sourceRecipes || []))];
	const recipeNameMap: Record<string, string> = {};
	if (allRecipeIds.length > 0) {
		const rows = await db
			.select({ id: recipes.id, title: recipes.title, titleHe: recipes.titleHe })
			.from(recipes)
			.where(inArray(recipes.id, allRecipeIds));
		for (const r of rows) recipeNameMap[r.id] = r.titleHe || r.title;
	}

	const enrichedItems = items.map(item => ({
		...item,
		availableVariants: item.ingredientId ? (availableVariants[item.ingredientId] || []) : [],
		sourceRecipeNames: (item.sourceRecipes || []).map((id) => recipeNameMap[id]).filter(Boolean)
	}));

	const listRecipes = await db
		.select({ recipeId: shoppingListRecipes.recipeId, title: recipes.title, titleHe: recipes.titleHe })
		.from(shoppingListRecipes)
		.innerJoin(recipes, eq(shoppingListRecipes.recipeId, recipes.id))
		.where(eq(shoppingListRecipes.shoppingListId, listId));

	const aisleGroups = new Map<string, { name: string; icon: string | null; sortOrder: number; items: typeof enrichedItems }>();
	for (const item of enrichedItems) {
		const key = item.aisleCategoryId || 'other';
		if (!aisleGroups.has(key)) {
			aisleGroups.set(key, { name: item.aisleName || 'אחר', icon: item.aisleIcon, sortOrder: item.aisleSortOrder ?? 99, items: [] });
		}
		aisleGroups.get(key)!.items.push(item);
	}

	const sortedAisles = [...aisleGroups.entries()]
		.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
		.map(([id, data]) => ({ id, ...data }));

	// Saved/custom lists (e.g. "קלאסי") offered as one-tap quick-adds.
	const templates = await db
		.select({ id: shoppingLists.id, name: shoppingLists.name })
		.from(shoppingLists)
		.where(eq(shoppingLists.isTemplate, true));

	return {
		listId,
		listVersion: activeList[0].version,
		aisles: sortedAisles,
		listRecipes,
		templates,
		totalItems: items.length,
		checkedItems: items.filter((i) => i.isChecked).length,
		addedRecipe: addRecipeId ? true : false,
		addedFromList: addedCount !== null ? parseInt(addedCount) || 0 : null
	};
};

async function activeListId(): Promise<string | null> {
	const r = await db.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
	return r[0]?.id ?? null;
}

export const actions: Actions = {
	addTemplate: async ({ request }) => {
		const data = await request.formData();
		const listId = data.get('listId') as string;
		if (!listId) return fail(400);
		const added = await addTemplateToActiveList(listId);
		return { addedFromList: added };
	},

	toggleItem: async ({ request, locals }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const currentState = data.get('isChecked') === 'true';
		await db.update(shoppingListItems).set({ isChecked: !currentState, updatedAt: new Date() }).where(eq(shoppingListItems.id, itemId));
		const listId = await activeListId();
		if (listId) await touchList(listId);
	},

	searchIngredients: async ({ request, locals }) => {
		const data = await request.formData();
		const q = (data.get('q') as string)?.trim();
		if (!q || q.length < 2) return { results: [] };
		const pattern = `%${q}%`;
		const results = await db
			.select({ id: ingredients.id, name: ingredients.name, nameHe: ingredients.nameHe, aisleCategoryId: ingredients.aisleCategoryId, defaultUnit: ingredients.defaultUnit, isMaayan: ingredients.isMaayan, maayanTop: ingredients.maayanTop })
			.from(ingredients)
			.where(or(like(ingredients.name, pattern), like(ingredients.nameHe, pattern)))
			.limit(8);
		return { results };
	},

	addCustomItem: async ({ request, locals }) => {
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		let ingredientId = (data.get('ingredientId') as string)?.trim() || null;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		if (!name && !ingredientId) return fail(400);

		// Free text: try to dedupe against the canonical bank (no auto-create of junk)
		if (!ingredientId && name) {
			const key = keyForString(name);
			if (key) {
				const match = await db.select({ id: ingredients.id }).from(ingredients).where(eq(ingredients.nameKey, key)).limit(1);
				if (match.length > 0) ingredientId = match[0].id;
			}
		}

		await db.transaction(async (tx) => {
			const listId = await getOrCreateActiveShoppingList(tx);
			if (ingredientId) {
				const existing = await tx.select().from(shoppingListItems)
					.where(and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.ingredientId, ingredientId)))
					.limit(1);
				if (existing.length > 0) {
					if (quantity) {
						await tx.update(shoppingListItems)
							.set({ quantity: (existing[0].quantity || 0) + quantity, unit: unit || existing[0].unit, updatedAt: new Date() })
							.where(eq(shoppingListItems.id, existing[0].id));
					}
				} else {
					const ing = await tx.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1);
					await tx.insert(shoppingListItems).values({
						id: generateId(), shoppingListId: listId, ingredientId,
						quantity, unit: unit || ing[0]?.defaultUnit,
						isChecked: false, aisleCategoryId: ing[0]?.aisleCategoryId || 'other', addedManually: true
					});
				}
			} else {
				await tx.insert(shoppingListItems).values({
					id: generateId(), shoppingListId: listId, customName: name,
					quantity, unit, isChecked: false, aisleCategoryId: 'other', addedManually: true
				});
			}
			await touchList(listId, tx);
		});
	},

	removeRecipe: async ({ request, locals }) => {
		const data = await request.formData();
		const recipeId = data.get('recipeId') as string;
		const listId = await activeListId();
		if (!listId) return fail(400);
		await db.delete(shoppingListRecipes).where(
			and(eq(shoppingListRecipes.shoppingListId, listId), eq(shoppingListRecipes.recipeId, recipeId))
		);
		await reconcileList(listId);
	},

	clearChecked: async ({ locals }) => {
		const listId = await activeListId();
		if (!listId) return;
		await db.delete(shoppingListItems).where(and(eq(shoppingListItems.shoppingListId, listId), eq(shoppingListItems.isChecked, true)));
		await touchList(listId);
	},

	chooseVariant: async ({ request, locals }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const variantId = data.get('variantId') as string;
		if (!itemId || !variantId) return fail(400);
		await db.update(shoppingListItems).set({ chosenVariantId: variantId, updatedAt: new Date() }).where(eq(shoppingListItems.id, itemId));
		const listId = await activeListId();
		if (listId) await touchList(listId);
	},

	updateQuantity: async ({ request, locals }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		if (!itemId) return fail(400);
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		await db.update(shoppingListItems).set({ quantity, ...(unit ? { unit } : {}), updatedAt: new Date() }).where(eq(shoppingListItems.id, itemId));
		const listId = await activeListId();
		if (listId) await touchList(listId);
	},

	deleteItem: async ({ request, locals }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		if (!itemId) return fail(400);
		await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
		const listId = await activeListId();
		if (listId) await touchList(listId);
	},

	clearAll: async ({ locals }) => {
		const listId = await activeListId();
		if (!listId) return;
		await db.delete(shoppingListItems).where(eq(shoppingListItems.shoppingListId, listId));
		await db.delete(shoppingListRecipes).where(eq(shoppingListRecipes.shoppingListId, listId));
		await touchList(listId);
	}
};
