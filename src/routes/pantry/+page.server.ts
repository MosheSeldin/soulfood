import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { pantryItems, ingredients } from '$lib/server/db/schema';
import { eq, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateIngredient } from '$lib/server/ingredients/normalizer';
import type { Actions, PageServerLoad } from './$types';

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
		if (!name) return fail(400, { error: 'נא להזין שם מצרך' });

		const ingredientId = await findOrCreateIngredient(name);

		// Check if already in pantry
		const existing = await db.select().from(pantryItems).where(eq(pantryItems.ingredientId, ingredientId)).limit(1);
		if (existing.length > 0) return fail(400, { error: 'המצרך כבר ברשימה' });

		await db.insert(pantryItems).values({
			id: generateId(),
			ingredientId
		});
	},

	remove: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const itemId = data.get('itemId') as string;
		await db.delete(pantryItems).where(eq(pantryItems.id, itemId));
	},

	clearAll: async ({ locals }) => {
		if (!locals.user) redirect(302, '/login');
		await db.delete(pantryItems);
	},

	search: async ({ request }) => {
		const data = await request.formData();
		const q = (data.get('q') as string)?.trim();
		if (!q || q.length < 2) return { results: [] };

		const results = await db
			.select({ id: ingredients.id, name: ingredients.name, nameHe: ingredients.nameHe })
			.from(ingredients)
			.where(like(ingredients.name, `%${q}%`))
			.limit(10);

		return { results };
	}
};
