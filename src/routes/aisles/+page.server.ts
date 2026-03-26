import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { aisleCategories, ingredients } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const allAisles = await db
		.select({
			id: aisleCategories.id,
			name: aisleCategories.name,
			nameHe: aisleCategories.nameHe,
			sortOrder: aisleCategories.sortOrder,
			icon: aisleCategories.icon,
			ingredientCount: sql<number>`(SELECT COUNT(*) FROM ingredients WHERE aisle_category_id = aisle_categories.id)`
		})
		.from(aisleCategories)
		.orderBy(aisleCategories.sortOrder);

	return { aisles: allAisles };
};

export const actions: Actions = {
	createAisle: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const nameHe = (data.get('nameHe') as string)?.trim();
		const sortOrder = parseInt(data.get('sortOrder') as string) || 50;

		if (!name || !nameHe) return fail(400, { error: 'שם חובה' });

		await db.insert(aisleCategories).values({
			id: generateId(),
			name,
			nameHe,
			sortOrder
		});
	},

	updateAisle: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const id = data.get('id') as string;
		const name = (data.get('name') as string)?.trim();
		const nameHe = (data.get('nameHe') as string)?.trim();
		const sortOrder = parseInt(data.get('sortOrder') as string) || 50;

		if (!id || !name || !nameHe) return fail(400);

		await db.update(aisleCategories).set({ name, nameHe, sortOrder }).where(eq(aisleCategories.id, id));
	},

	deleteAisle: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const data = await request.formData();
		const id = data.get('id') as string;
		if (!id) return fail(400);

		const [usage] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(ingredients)
			.where(eq(ingredients.aisleCategoryId, id));

		if ((usage?.count ?? 0) > 0) return fail(400, { error: 'יש מצרכים במדור זה' });

		await db.delete(aisleCategories).where(eq(aisleCategories.id, id));
	}
};
