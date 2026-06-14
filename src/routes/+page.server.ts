import { db } from '$lib/server/db';
import { recipes, shoppingListItems, shoppingLists } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// The cover/title page is public; live data only loads for a signed-in user.
	if (!locals.user) {
		return { loggedIn: false, featured: [], totalRecipes: 0, openItems: 0 };
	}

	const featured = await db
		.select({
			id: recipes.id,
			title: recipes.title,
			titleHe: recipes.titleHe,
			category: recipes.category,
			imageUrl: recipes.imageUrl
		})
		.from(recipes)
		.where(eq(recipes.isFavorite, true))
		.orderBy(desc(recipes.createdAt))
		.limit(3);

	const allRecipes = await db.select({ id: recipes.id }).from(recipes);

	const activeList = await db
		.select({ id: shoppingLists.id })
		.from(shoppingLists)
		.where(eq(shoppingLists.isActive, true))
		.limit(1);

	let openItems = 0;
	if (activeList.length > 0) {
		const open = await db
			.select({ id: shoppingListItems.id })
			.from(shoppingListItems)
			.where(
				and(
					eq(shoppingListItems.shoppingListId, activeList[0].id),
					eq(shoppingListItems.isChecked, false)
				)
			);
		openItems = open.length;
	}

	return { loggedIn: true, featured, totalRecipes: allRecipes.length, openItems };
};
