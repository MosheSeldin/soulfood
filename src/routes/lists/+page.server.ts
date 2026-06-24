import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	shoppingLists,
	shoppingListItems,
	shoppingListRecipes,
	ingredients,
	aisleCategories,
	ingredientVariants
} from '$lib/server/db/schema';
import { eq, and, or, like, inArray, asc } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { keyForString } from '$lib/server/ingredients/classifier';
import { addTemplateToActiveList, addTemplateItemsToActiveList, touchList } from '$lib/server/shopping';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const lists = await db
		.select()
		.from(shoppingLists)
		.where(eq(shoppingLists.isTemplate, true))
		.orderBy(asc(shoppingLists.createdAt));

	const listIds = lists.map((l) => l.id);

	type Row = {
		id: string;
		shoppingListId: string;
		ingredientId: string | null;
		customName: string | null;
		quantity: number | null;
		unit: string | null;
		aisleCategoryId: string | null;
		chosenVariantId: string | null;
		ingredientName: string | null;
		ingredientNameHe: string | null;
		isMaayan: boolean | null;
		maayanTop: boolean | null;
		aisleName: string | null;
		aisleSortOrder: number | null;
		variantName: string | null;
		variantNameHe: string | null;
	};

	const itemsByList: Record<string, Row[]> = {};
	if (listIds.length > 0) {
		const rows = await db
			.select({
				id: shoppingListItems.id,
				shoppingListId: shoppingListItems.shoppingListId,
				ingredientId: shoppingListItems.ingredientId,
				customName: shoppingListItems.customName,
				quantity: shoppingListItems.quantity,
				unit: shoppingListItems.unit,
				aisleCategoryId: shoppingListItems.aisleCategoryId,
				chosenVariantId: shoppingListItems.chosenVariantId,
				ingredientName: ingredients.name,
				ingredientNameHe: ingredients.nameHe,
				isMaayan: ingredients.isMaayan,
				maayanTop: ingredients.maayanTop,
				aisleName: aisleCategories.nameHe,
				aisleSortOrder: aisleCategories.sortOrder,
				variantName: ingredientVariants.name,
				variantNameHe: ingredientVariants.nameHe
			})
			.from(shoppingListItems)
			.leftJoin(ingredients, eq(shoppingListItems.ingredientId, ingredients.id))
			.leftJoin(aisleCategories, eq(shoppingListItems.aisleCategoryId, aisleCategories.id))
			.leftJoin(ingredientVariants, eq(shoppingListItems.chosenVariantId, ingredientVariants.id))
			.where(inArray(shoppingListItems.shoppingListId, listIds));

		for (const r of rows) {
			(itemsByList[r.shoppingListId] ||= []).push(r as Row);
		}
		// sort each list by aisle order, then name
		for (const id of listIds) {
			(itemsByList[id] ||= []).sort((a, b) => {
				const ao = (a.aisleSortOrder ?? 99) - (b.aisleSortOrder ?? 99);
				if (ao !== 0) return ao;
				const an = a.ingredientNameHe || a.customName || a.ingredientName || '';
				const bn = b.ingredientNameHe || b.customName || b.ingredientName || '';
				return an.localeCompare(bn, 'he');
			});
		}
	}

	return {
		lists: lists.map((l) => ({ id: l.id, name: l.name, items: itemsByList[l.id] || [] }))
	};
};

/** Insert an item into a specific template list, deduped within that list. */
async function addItemToList(opts: {
	listId: string;
	ingredientId: string | null;
	name: string | null;
	quantity: number | null;
	unit: string | null;
}) {
	let ingredientId = opts.ingredientId;
	// Free text → try to match the canonical bank (don't spawn junk rows).
	if (!ingredientId && opts.name) {
		const key = keyForString(opts.name);
		if (key) {
			const match = await db
				.select({ id: ingredients.id })
				.from(ingredients)
				.where(eq(ingredients.nameKey, key))
				.limit(1);
			if (match.length > 0) ingredientId = match[0].id;
		}
	}

	await db.transaction(async (tx) => {
		if (ingredientId) {
			const existing = await tx
				.select({ id: shoppingListItems.id })
				.from(shoppingListItems)
				.where(
					and(
						eq(shoppingListItems.shoppingListId, opts.listId),
						eq(shoppingListItems.ingredientId, ingredientId)
					)
				)
				.limit(1);
			if (existing.length > 0) return; // already in this saved list
			const ing = await tx.select().from(ingredients).where(eq(ingredients.id, ingredientId)).limit(1);
			await tx.insert(shoppingListItems).values({
				id: generateId(),
				shoppingListId: opts.listId,
				ingredientId,
				quantity: opts.quantity,
				unit: opts.unit || ing[0]?.defaultUnit,
				isChecked: false,
				aisleCategoryId: ing[0]?.aisleCategoryId || 'other',
				addedManually: true
			});
		} else if (opts.name) {
			await tx.insert(shoppingListItems).values({
				id: generateId(),
				shoppingListId: opts.listId,
				customName: opts.name,
				quantity: opts.quantity,
				unit: opts.unit,
				isChecked: false,
				aisleCategoryId: 'other',
				addedManually: true
			});
		}
		await touchList(opts.listId, tx);
	});
}

export const actions: Actions = {
	createList: async ({ request }) => {
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		if (!name) return fail(400, { error: 'נא להזין שם לרשימה' });
		await db.insert(shoppingLists).values({
			id: generateId(),
			name,
			isActive: false,
			isTemplate: true
		});
	},

	renameList: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('listId') as string;
		const name = (data.get('name') as string)?.trim();
		if (!id || !name) return fail(400);
		await db
			.update(shoppingLists)
			.set({ name })
			.where(and(eq(shoppingLists.id, id), eq(shoppingLists.isTemplate, true)));
	},

	deleteList: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('listId') as string;
		if (!id) return fail(400);
		// FK enforcement is off — clear children explicitly.
		await db.transaction(async (tx) => {
			await tx.delete(shoppingListItems).where(eq(shoppingListItems.shoppingListId, id));
			await tx.delete(shoppingListRecipes).where(eq(shoppingListRecipes.shoppingListId, id));
			await tx
				.delete(shoppingLists)
				.where(and(eq(shoppingLists.id, id), eq(shoppingLists.isTemplate, true)));
		});
	},

	searchIngredients: async ({ request }) => {
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
				defaultUnit: ingredients.defaultUnit,
				isMaayan: ingredients.isMaayan,
				maayanTop: ingredients.maayanTop
			})
			.from(ingredients)
			.where(or(like(ingredients.name, pattern), like(ingredients.nameHe, pattern)))
			.limit(8);
		return { results };
	},

	addItem: async ({ request }) => {
		const data = await request.formData();
		const listId = data.get('listId') as string;
		const name = (data.get('name') as string)?.trim() || null;
		const ingredientId = (data.get('ingredientId') as string)?.trim() || null;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		if (!listId || (!name && !ingredientId)) return fail(400);
		await addItemToList({ listId, ingredientId, name, quantity, unit });
	},

	removeItem: async ({ request }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const listId = data.get('listId') as string;
		if (!itemId) return fail(400);
		await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
		if (listId) await touchList(listId);
	},

	addToShopping: async ({ request }) => {
		const data = await request.formData();
		const listId = data.get('listId') as string;
		if (!listId) return fail(400);
		const added = await addTemplateToActiveList(listId);
		redirect(303, `/shopping?added=${added}`);
	},

	// Add a single saved-list item to the active shopping list (stay on this page).
	addItemToShopping: async ({ request }) => {
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		if (!itemId) return fail(400);
		const added = await addTemplateItemsToActiveList([itemId]);
		return { addedItemId: itemId, added };
	},

	// Add a ticked subset of a list's items to the active shopping list.
	addSelectedToShopping: async ({ request }) => {
		const data = await request.formData();
		const raw = (data.get('itemIds') as string) || '[]';
		let ids: string[] = [];
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string');
		} catch {
			ids = [];
		}
		if (ids.length === 0) return fail(400, { error: 'לא נבחרו פריטים' });
		const added = await addTemplateItemsToActiveList(ids);
		return { addedSelected: added, addedCount: ids.length };
	}
};
