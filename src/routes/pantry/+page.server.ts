import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pantryItems, ingredients, shoppingLists } from '$lib/server/db/schema';
import { eq, or, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateIngredient } from '$lib/server/ingredients/normalizer';
import { reconcileList } from '$lib/server/shopping';
import type { Actions, PageServerLoad } from './$types';

async function reconcileActive() {
	const r = await db.select({ id: shoppingLists.id }).from(shoppingLists).where(eq(shoppingLists.isActive, true)).limit(1);
	if (r[0]) await reconcileList(r[0].id);
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const items = await db
		.select({
			id: pantryItems.id,
			ingredientId: pantryItems.ingredientId,
			quantity: pantryItems.quantity,
			unit: pantryItems.unit,
			updatedAt: pantryItems.updatedAt,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe
		})
		.from(pantryItems)
		.leftJoin(ingredients, eq(pantryItems.ingredientId, ingredients.id));

	return { items };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		if (!name) return fail(400, { error: 'נא להזין שם מצרך' });

		const ingredientId = await findOrCreateIngredient(name);

		// Upsert: if already on hand, update the amount instead of erroring.
		const existing = await db.select().from(pantryItems).where(eq(pantryItems.ingredientId, ingredientId)).limit(1);
		if (existing.length > 0) {
			await db.update(pantryItems).set({ quantity, unit, updatedAt: new Date() }).where(eq(pantryItems.id, existing[0].id));
		} else {
			await db.insert(pantryItems).values({ id: generateId(), ingredientId, quantity, unit });
		}

		await reconcileActive();
	},

	updateQuantity: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		const quantityStr = data.get('quantity') as string;
		const unit = (data.get('unit') as string)?.trim() || null;
		if (!itemId) return fail(400);
		const quantity = quantityStr ? parseFloat(quantityStr) : null;
		await db.update(pantryItems).set({ quantity, unit, updatedAt: new Date() }).where(eq(pantryItems.id, itemId));
		await reconcileActive();
	},

	remove: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		await db.delete(pantryItems).where(eq(pantryItems.id, itemId));
		await reconcileActive();
	},

	clearAll: async ({ locals }) => {
		if (!locals.user) redirect(302, '/login');
		await db.delete(pantryItems);
		await reconcileActive();
	},

	search: async ({ request }) => {
		const data = await request.formData();
		const q = (data.get('q') as string)?.trim();
		if (!q || q.length < 2) return { results: [] };
		const pattern = `%${q}%`;
		const results = await db
			.select({ id: ingredients.id, name: ingredients.name, nameHe: ingredients.nameHe })
			.from(ingredients)
			.where(or(like(ingredients.name, pattern), like(ingredients.nameHe, pattern)))
			.limit(10);
		return { results };
	}
};
