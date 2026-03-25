import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const allRecipes = await db
		.select({
			id: recipes.id,
			title: recipes.title,
			titleHe: recipes.titleHe,
			imageUrl: recipes.imageUrl,
			category: recipes.category,
			cuisine: recipes.cuisine,
			totalTimeMinutes: recipes.totalTimeMinutes,
			servings: recipes.servings,
			isFavorite: recipes.isFavorite
		})
		.from(recipes)
		.orderBy(desc(recipes.createdAt));

	return { recipes: allRecipes };
};
