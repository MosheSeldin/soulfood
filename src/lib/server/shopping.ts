import { db } from '$lib/server/db';
import { shoppingLists, shoppingListItems, ingredients } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';

/** Get or create the active shopping list, returns its ID */
export async function getOrCreateActiveShoppingList(): Promise<string> {
	const activeList = await db
		.select()
		.from(shoppingLists)
		.where(eq(shoppingLists.isActive, true))
		.limit(1);

	if (activeList.length > 0) return activeList[0].id;

	const id = generateId();
	await db.insert(shoppingLists).values({ id, name: 'רשימת קניות', isActive: true });
	return id;
}

/** Add a single ingredient to the active shopping list (merge if already present) */
export async function addIngredientToShoppingList(opts: {
	ingredientId: string;
	quantity: number | null;
	unit: string | null;
	aisleCategoryId: string | null;
	chosenVariantId?: string | null;
}): Promise<void> {
	const listId = await getOrCreateActiveShoppingList();

	// Check if ingredient already on list
	const existing = await db
		.select()
		.from(shoppingListItems)
		.where(
			and(
				eq(shoppingListItems.shoppingListId, listId),
				eq(shoppingListItems.ingredientId, opts.ingredientId)
			)
		)
		.limit(1);

	if (existing.length > 0 && opts.quantity) {
		// Merge quantities
		const currentQty = existing[0].quantity || 0;
		await db
			.update(shoppingListItems)
			.set({ quantity: currentQty + opts.quantity, unit: opts.unit || existing[0].unit })
			.where(eq(shoppingListItems.id, existing[0].id));
	} else if (existing.length === 0) {
		// Look up aisle from ingredient if not provided
		let aisleCategoryId = opts.aisleCategoryId;
		if (!aisleCategoryId) {
			const ing = await db
				.select({ aisleCategoryId: ingredients.aisleCategoryId })
				.from(ingredients)
				.where(eq(ingredients.id, opts.ingredientId))
				.limit(1);
			aisleCategoryId = ing[0]?.aisleCategoryId || null;
		}

		await db.insert(shoppingListItems).values({
			id: generateId(),
			shoppingListId: listId,
			ingredientId: opts.ingredientId,
			quantity: opts.quantity,
			unit: opts.unit,
			isChecked: false,
			aisleCategoryId: aisleCategoryId || 'other',
			addedManually: true,
			chosenVariantId: opts.chosenVariantId || null
		});
	}
}
