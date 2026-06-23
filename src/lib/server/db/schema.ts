import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ──── Users ────
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	passwordSalt: text('password_salt'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ──── Aisle Categories ────
export const aisleCategories = sqliteTable('aisle_categories', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	nameHe: text('name_he').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	icon: text('icon')
});

// ──── Ingredients (canonical bank) ────
// `nameKey` is the language-tagged canonical key and the real uniqueness anchor
// (see computeNameKey). `name` (English) may be null for Hebrew-only ingredients;
// we never store Hebrew text in `name`.
export const ingredients = sqliteTable(
	'ingredients',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		nameHe: text('name_he'),
		nameKey: text('name_key'),
		aisleCategoryId: text('aisle_category_id').references(() => aisleCategories.id),
		defaultUnit: text('default_unit'),
		// Maayan's personal food list: `isMaayan` marks a food she eats (purple dot);
		// `maayanTop` marks the extra-recommended subset (bold items in her sheet).
		isMaayan: integer('is_maayan', { mode: 'boolean' }).notNull().default(false),
		maayanTop: integer('maayan_top', { mode: 'boolean' }).notNull().default(false)
	},
	(t) => [uniqueIndex('ingredients_name_key_unique').on(t.nameKey)]
);

// ──── Recipes ────
export const recipes = sqliteTable('recipes', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	titleHe: text('title_he'),
	description: text('description'),
	sourceUrl: text('source_url'),
	sourceType: text('source_type').notNull().default('manual'), // 'url' | 'manual' | 'video' | 'cookbook'
	imageUrl: text('image_url'),
	servings: integer('servings'),
	prepTimeMinutes: integer('prep_time_minutes'),
	cookTimeMinutes: integer('cook_time_minutes'),
	totalTimeMinutes: integer('total_time_minutes'),
	instructions: text('instructions', { mode: 'json' }).$type<string[]>(),
	tags: text('tags', { mode: 'json' }).$type<string[]>(),
	category: text('category'), // 'main' | 'side' | 'dessert' | 'soup' | 'salad' | 'breakfast' | 'snack'
	cuisine: text('cuisine'),
	isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
	createdBy: text('created_by').references(() => users.id),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ──── Recipe Ingredients ────
export const recipeIngredients = sqliteTable('recipe_ingredients', {
	id: text('id').primaryKey(),
	recipeId: text('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	ingredientId: text('ingredient_id').references(() => ingredients.id),
	quantity: real('quantity'),
	unit: text('unit'),
	originalText: text('original_text'),
	originalTextHe: text('original_text_he'),
	preparation: text('preparation'),
	isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0)
});

// ──── Ingredient Variants ────
export const ingredientVariants = sqliteTable(
	'ingredient_variants',
	{
		id: text('id').primaryKey(),
		ingredientId: text('ingredient_id')
			.notNull()
			.references(() => ingredients.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		nameHe: text('name_he'),
		nameKey: text('name_key')
	},
	(t) => [uniqueIndex('ingredient_variants_ing_key_unique').on(t.ingredientId, t.nameKey)]
);

// ──── Recipe Ingredient Variants (which variants a recipe offers) ────
export const recipeIngredientVariants = sqliteTable('recipe_ingredient_variants', {
	id: text('id').primaryKey(),
	recipeIngredientId: text('recipe_ingredient_id')
		.notNull()
		.references(() => recipeIngredients.id, { onDelete: 'cascade' }),
	variantId: text('variant_id')
		.notNull()
		.references(() => ingredientVariants.id, { onDelete: 'cascade' }),
	sortOrder: integer('sort_order').notNull().default(0)
});

// ──── Pantry Items ────
export const pantryItems = sqliteTable(
	'pantry_items',
	{
		id: text('id').primaryKey(),
		ingredientId: text('ingredient_id')
			.notNull()
			.references(() => ingredients.id, { onDelete: 'cascade' }),
		quantity: real('quantity'),
		unit: text('unit'),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [uniqueIndex('pantry_items_ingredient_unique').on(t.ingredientId)]
);

// ──── Shopping Lists ────
export const shoppingLists = sqliteTable('shopping_lists', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	version: integer('version').notNull().default(0),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

// ──── Shopping List Items ────
export const shoppingListItems = sqliteTable(
	'shopping_list_items',
	{
		id: text('id').primaryKey(),
		shoppingListId: text('shopping_list_id')
			.notNull()
			.references(() => shoppingLists.id, { onDelete: 'cascade' }),
		ingredientId: text('ingredient_id').references(() => ingredients.id, { onDelete: 'cascade' }),
		customName: text('custom_name'),
		quantity: real('quantity'),
		unit: text('unit'),
		isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
		aisleCategoryId: text('aisle_category_id').references(() => aisleCategories.id),
		sourceRecipes: text('source_recipes', { mode: 'json' }).$type<string[]>(),
		addedManually: integer('added_manually', { mode: 'boolean' }).notNull().default(false),
		chosenVariantId: text('chosen_variant_id').references(() => ingredientVariants.id, {
			onDelete: 'set null'
		}),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [
		uniqueIndex('sli_list_ing_variant_unique').on(
			t.shoppingListId,
			t.ingredientId,
			t.chosenVariantId
		)
	]
);

// ──── Shopping List Recipes (which recipes are on this list) ────
export const shoppingListRecipes = sqliteTable('shopping_list_recipes', {
	id: text('id').primaryKey(),
	shoppingListId: text('shopping_list_id')
		.notNull()
		.references(() => shoppingLists.id, { onDelete: 'cascade' }),
	recipeId: text('recipe_id')
		.notNull()
		.references(() => recipes.id, { onDelete: 'cascade' }),
	servings: integer('servings')
});

// ──── Sessions ────
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});
