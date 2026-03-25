import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ──── Users ────
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
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
export const ingredients = sqliteTable('ingredients', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	nameHe: text('name_he'),
	aisleCategoryId: text('aisle_category_id').references(() => aisleCategories.id),
	defaultUnit: text('default_unit')
});

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
export const ingredientVariants = sqliteTable('ingredient_variants', {
	id: text('id').primaryKey(),
	ingredientId: text('ingredient_id')
		.notNull()
		.references(() => ingredients.id),
	name: text('name').notNull(),
	nameHe: text('name_he')
});

// ──── Recipe Ingredient Variants (which variants a recipe offers) ────
export const recipeIngredientVariants = sqliteTable('recipe_ingredient_variants', {
	id: text('id').primaryKey(),
	recipeIngredientId: text('recipe_ingredient_id')
		.notNull()
		.references(() => recipeIngredients.id, { onDelete: 'cascade' }),
	variantId: text('variant_id')
		.notNull()
		.references(() => ingredientVariants.id),
	sortOrder: integer('sort_order').notNull().default(0)
});

// ──── Pantry Items ────
export const pantryItems = sqliteTable('pantry_items', {
	id: text('id').primaryKey(),
	ingredientId: text('ingredient_id')
		.notNull()
		.references(() => ingredients.id),
	quantity: real('quantity'),
	unit: text('unit'),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// ──── Shopping Lists ────
export const shoppingLists = sqliteTable('shopping_lists', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

// ──── Shopping List Items ────
export const shoppingListItems = sqliteTable('shopping_list_items', {
	id: text('id').primaryKey(),
	shoppingListId: text('shopping_list_id')
		.notNull()
		.references(() => shoppingLists.id, { onDelete: 'cascade' }),
	ingredientId: text('ingredient_id').references(() => ingredients.id),
	customName: text('custom_name'),
	quantity: real('quantity'),
	unit: text('unit'),
	isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
	aisleCategoryId: text('aisle_category_id').references(() => aisleCategories.id),
	sourceRecipes: text('source_recipes', { mode: 'json' }).$type<string[]>(),
	addedManually: integer('added_manually', { mode: 'boolean' }).notNull().default(false),
	chosenVariantId: text('chosen_variant_id').references(() => ingredientVariants.id)
});

// ──── Shopping List Recipes (which recipes are on this list) ────
export const shoppingListRecipes = sqliteTable('shopping_list_recipes', {
	id: text('id').primaryKey(),
	shoppingListId: text('shopping_list_id')
		.notNull()
		.references(() => shoppingLists.id, { onDelete: 'cascade' }),
	recipeId: text('recipe_id')
		.notNull()
		.references(() => recipes.id),
	servings: integer('servings')
});

// ──── Sessions ────
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});
