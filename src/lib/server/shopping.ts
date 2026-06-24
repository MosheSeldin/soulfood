import { db, type Executor } from '$lib/server/db';
import {
	shoppingLists,
	shoppingListItems,
	shoppingListRecipes,
	recipes,
	recipeIngredients,
	ingredients,
	recipeIngredientVariants,
	pantryItems
} from '$lib/server/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { aggregateIngredients, subtractOnHand, sumNullable } from '$lib/utils/quantities';

/** Get or create the active shopping list, returns its ID */
export async function getOrCreateActiveShoppingList(exec: Executor = db): Promise<string> {
	const activeList = await exec
		.select()
		.from(shoppingLists)
		.where(eq(shoppingLists.isActive, true))
		.limit(1);

	if (activeList.length > 0) return activeList[0].id;

	const id = generateId();
	await exec.insert(shoppingLists).values({ id, name: 'רשימת קניות', isActive: true });
	return id;
}

/** Bump a list's version + updatedAt so other devices can detect a change (live sync). */
export async function touchList(listId: string, exec: Executor = db): Promise<void> {
	await exec
		.update(shoppingLists)
		.set({ version: (await currentVersion(listId, exec)) + 1, updatedAt: new Date() })
		.where(eq(shoppingLists.id, listId));
}

async function currentVersion(listId: string, exec: Executor): Promise<number> {
	const r = await exec
		.select({ version: shoppingLists.version })
		.from(shoppingLists)
		.where(eq(shoppingLists.id, listId))
		.limit(1);
	return r[0]?.version ?? 0;
}

/** Add a single ingredient to the active shopping list (merge if already present). */
export async function addIngredientToShoppingList(opts: {
	ingredientId: string;
	quantity: number | null;
	unit: string | null;
	aisleCategoryId: string | null;
	chosenVariantId?: string | null;
}): Promise<void> {
	await db.transaction(async (tx) => {
		const listId = await getOrCreateActiveShoppingList(tx);

		const variantCondition = opts.chosenVariantId
			? eq(shoppingListItems.chosenVariantId, opts.chosenVariantId)
			: isNull(shoppingListItems.chosenVariantId);

		const existing = await tx
			.select()
			.from(shoppingListItems)
			.where(
				and(
					eq(shoppingListItems.shoppingListId, listId),
					eq(shoppingListItems.ingredientId, opts.ingredientId),
					variantCondition
				)
			)
			.limit(1);

		if (existing.length > 0) {
			if (opts.quantity) {
				await tx
					.update(shoppingListItems)
					.set({
						quantity: sumNullable(existing[0].quantity, opts.quantity),
						unit: opts.unit || existing[0].unit,
						updatedAt: new Date()
					})
					.where(eq(shoppingListItems.id, existing[0].id));
			}
		} else {
			let aisleCategoryId = opts.aisleCategoryId;
			if (!aisleCategoryId) {
				const ing = await tx
					.select({ aisleCategoryId: ingredients.aisleCategoryId })
					.from(ingredients)
					.where(eq(ingredients.id, opts.ingredientId))
					.limit(1);
				aisleCategoryId = ing[0]?.aisleCategoryId || null;
			}
			await tx.insert(shoppingListItems).values({
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
		await touchList(listId, tx);
	});
}

type ListItemRow = typeof shoppingListItems.$inferSelect;

/**
 * Copy one saved-list row into the active list, deduping by ingredient+variant
 * (or by custom name for free-text rows). Returns true if a new row was added.
 */
async function copyItemToActiveList(
	tx: Executor,
	activeId: string,
	it: ListItemRow
): Promise<boolean> {
	if (it.ingredientId) {
		const variantCondition = it.chosenVariantId
			? eq(shoppingListItems.chosenVariantId, it.chosenVariantId)
			: isNull(shoppingListItems.chosenVariantId);
		const existing = await tx
			.select({ id: shoppingListItems.id })
			.from(shoppingListItems)
			.where(
				and(
					eq(shoppingListItems.shoppingListId, activeId),
					eq(shoppingListItems.ingredientId, it.ingredientId),
					variantCondition
				)
			)
			.limit(1);
		if (existing.length > 0) return false; // already on the list — leave it be
	} else if (it.customName) {
		const existing = await tx
			.select({ id: shoppingListItems.id })
			.from(shoppingListItems)
			.where(
				and(
					eq(shoppingListItems.shoppingListId, activeId),
					eq(shoppingListItems.customName, it.customName)
				)
			)
			.limit(1);
		if (existing.length > 0) return false;
	} else {
		return false; // nothing identifiable to copy
	}

	await tx.insert(shoppingListItems).values({
		id: generateId(),
		shoppingListId: activeId,
		ingredientId: it.ingredientId,
		customName: it.customName,
		quantity: it.quantity,
		unit: it.unit,
		isChecked: false,
		aisleCategoryId: it.aisleCategoryId || 'other',
		addedManually: true,
		chosenVariantId: it.chosenVariantId
	});
	return true;
}

/**
 * Copy every item from a saved/custom list (e.g. "קלאסי") into the active
 * shopping list, merging by ingredient+variant so nothing is duplicated.
 * Returns how many new rows were added. Items already on the list are skipped.
 */
export async function addTemplateToActiveList(templateListId: string): Promise<number> {
	return await db.transaction(async (tx) => {
		const items = await tx
			.select()
			.from(shoppingListItems)
			.where(eq(shoppingListItems.shoppingListId, templateListId));
		if (items.length === 0) return 0;

		const activeId = await getOrCreateActiveShoppingList(tx);
		let added = 0;
		for (const it of items) if (await copyItemToActiveList(tx, activeId, it)) added++;

		await touchList(activeId, tx);
		return added;
	});
}

/**
 * Copy a chosen subset of saved-list rows (by their ids) into the active list.
 * Powers "add this one item" and "add the items I ticked" from the lists page.
 * Returns how many new rows were added.
 */
export async function addTemplateItemsToActiveList(itemIds: string[]): Promise<number> {
	if (itemIds.length === 0) return 0;
	return await db.transaction(async (tx) => {
		const items = await tx
			.select()
			.from(shoppingListItems)
			.where(inArray(shoppingListItems.id, itemIds));
		if (items.length === 0) return 0;

		const activeId = await getOrCreateActiveShoppingList(tx);
		let added = 0;
		for (const it of items) if (await copyItemToActiveList(tx, activeId, it)) added++;

		await touchList(activeId, tx);
		return added;
	});
}

interface DesiredItem {
	ingredientId: string | null;
	name: string;
	nameHe: string | null;
	quantity: number | null;
	unit: string | null;
	aisleCategoryId: string | null;
	sourceRecipeIds: string[];
	chosenVariantId: string | null;
}

/** Compute the auto-generated item set implied by the recipes on a list (pantry-subtracted). */
async function computeDesiredItems(listId: string, exec: Executor): Promise<DesiredItem[]> {
	const listRecipeRows = await exec
		.select()
		.from(shoppingListRecipes)
		.where(eq(shoppingListRecipes.shoppingListId, listId));
	if (listRecipeRows.length === 0) return [];

	const recipeIds = listRecipeRows.map((r) => r.recipeId);

	const allIngs = await exec
		.select({
			recipeIngredientId: recipeIngredients.id,
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

	const riIds = allIngs.map((i) => i.recipeIngredientId);
	const riVariants = riIds.length
		? await exec
				.select({
					recipeIngredientId: recipeIngredientVariants.recipeIngredientId,
					variantId: recipeIngredientVariants.variantId
				})
				.from(recipeIngredientVariants)
				.where(inArray(recipeIngredientVariants.recipeIngredientId, riIds))
		: [];
	const riVariantMap = new Map<string, string>();
	for (const rv of riVariants) if (!riVariantMap.has(rv.recipeIngredientId)) riVariantMap.set(rv.recipeIngredientId, rv.variantId);

	// servings multipliers
	const recipeServings = new Map<string, number>();
	const recipeRows = await exec
		.select({ id: recipes.id, servings: recipes.servings })
		.from(recipes)
		.where(inArray(recipes.id, recipeIds));
	const defaultServingsById = new Map(recipeRows.map((r) => [r.id, r.servings || 1]));
	for (const lr of listRecipeRows) {
		const def = defaultServingsById.get(lr.recipeId) || 1;
		recipeServings.set(lr.recipeId, (lr.servings || def) / def);
	}

	const scaled = allIngs.map((ing) => {
		const multiplier = recipeServings.get(ing.recipeId) || 1;
		return {
			recipeId: ing.recipeId,
			ingredientId: ing.ingredientId,
			name: ing.ingredientName || ing.ingredientNameHe || ing.originalText || 'מצרך',
			nameHe: ing.ingredientNameHe,
			quantity: ing.quantity ? ing.quantity * multiplier : null,
			unit: ing.unit,
			aisleCategoryId: ing.aisleCategoryId,
			chosenVariantId: riVariantMap.get(ing.recipeIngredientId) || null
		};
	});

	const aggregated = aggregateIngredients(scaled);

	// pantry subtraction (quantity-aware)
	const pantry = await exec.select().from(pantryItems);
	const pantryMap = new Map(pantry.map((p) => [p.ingredientId, p]));

	const desired: DesiredItem[] = [];
	for (const item of aggregated) {
		let quantity = item.quantity;
		let unit = item.unit;
		if (item.ingredientId && pantryMap.has(item.ingredientId)) {
			const have = pantryMap.get(item.ingredientId)!;
			const net = subtractOnHand({ quantity, unit }, { quantity: have.quantity, unit: have.unit });
			if (net.covered) continue; // pantry covers it
			quantity = net.quantity;
			unit = net.unit;
		}
		desired.push({
			ingredientId: item.ingredientId,
			name: item.name,
			nameHe: item.nameHe,
			quantity,
			unit,
			aisleCategoryId: item.aisleCategoryId,
			sourceRecipeIds: item.sourceRecipeIds,
			chosenVariantId: item.chosenVariantId || null
		});
	}
	return desired;
}

/**
 * Non-destructively reconcile a list's items with its recipes.
 *
 * Unlike the old delete-and-recreate, this DIFFS: it preserves `isChecked` and
 * variant choices on surviving rows, folds manually-added quantities into the
 * recipe-derived total, recomputes `sourceRecipes`, and removes only auto rows
 * that no recipe implies anymore. Runs in a transaction.
 */
export async function reconcileList(listId: string, outer?: Executor): Promise<void> {
	const work = async (exec: Executor) => {
		const desired = await computeDesiredItems(listId, exec);

		const existing = await exec
			.select()
			.from(shoppingListItems)
			.where(eq(shoppingListItems.shoppingListId, listId));

		// pool of rows that carry an ingredientId, by ingredient (auto + manual)
		const pool = new Map<string, typeof existing>();
		for (const e of existing) {
			if (!e.ingredientId) continue;
			if (!pool.has(e.ingredientId)) pool.set(e.ingredientId, []);
			pool.get(e.ingredientId)!.push(e);
		}
		const used = new Set<string>();

		for (const d of desired) {
			const candidates = (d.ingredientId && pool.get(d.ingredientId)) || [];
			const free = candidates.filter((e) => !used.has(e.id));
			// prefer same variant, else reuse any free row for this ingredient
			const match = free.find((e) => (e.chosenVariantId ?? null) === d.chosenVariantId) || free[0];

			if (match) {
				used.add(match.id);
				const buyQty = match.addedManually ? sumNullable(d.quantity, match.quantity) : d.quantity;
				await exec
					.update(shoppingListItems)
					.set({
						quantity: buyQty,
						unit: d.unit || match.unit,
						aisleCategoryId: d.aisleCategoryId || match.aisleCategoryId || 'other',
						sourceRecipes: d.sourceRecipeIds,
						chosenVariantId: match.addedManually ? (match.chosenVariantId ?? d.chosenVariantId) : d.chosenVariantId,
						addedManually: false,
						updatedAt: new Date()
						// isChecked intentionally preserved
					})
					.where(eq(shoppingListItems.id, match.id));
			} else {
				await exec.insert(shoppingListItems).values({
					id: generateId(),
					shoppingListId: listId,
					ingredientId: d.ingredientId,
					quantity: d.quantity,
					unit: d.unit,
					isChecked: false,
					aisleCategoryId: d.aisleCategoryId || 'other',
					sourceRecipes: d.sourceRecipeIds,
					addedManually: false,
					chosenVariantId: d.chosenVariantId
				});
			}
		}

		// remove leftover AUTO rows no recipe implies anymore; keep manual + free-text
		for (const e of existing) {
			if (used.has(e.id)) continue;
			if (!e.addedManually) {
				await exec.delete(shoppingListItems).where(eq(shoppingListItems.id, e.id));
			}
		}

		await touchList(listId, exec);
	};

	if (outer) await work(outer);
	else await db.transaction(work);
}
