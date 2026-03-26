/**
 * Insert a structured recipe into the Soul Food database.
 * Run via: npx tsx .claude/skills/import-recipe/scripts/insert-recipe.ts <json-file>
 *
 * The JSON file should match the RecipeImport interface.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { db } from '../../../../src/lib/server/db';
import { recipes, recipeIngredients, users } from '../../../../src/lib/server/db/schema';
import { generateId } from '../../../../src/lib/utils/helpers';
import { findOrCreateIngredient } from '../../../../src/lib/server/ingredients/normalizer';
import {
	findOrCreateVariant,
	setRecipeIngredientVariants
} from '../../../../src/lib/server/ingredients/variants';

interface IngredientImport {
	quantity: number | null;
	unit: string | null;
	canonicalName: string;
	canonicalNameHe: string | null;
	variants: Array<{ name: string; nameHe: string | null }>;
	preparation: string | null;
	isOptional: boolean;
	originalText: string;
}

interface RecipeImport {
	title: string;
	titleHe: string | null;
	description: string | null;
	sourceUrl: string | null;
	imageUrl: string | null;
	servings: number | null;
	prepTimeMinutes: number | null;
	cookTimeMinutes: number | null;
	totalTimeMinutes: number | null;
	category: string | null;
	cuisine: string | null;
	tags: string[];
	instructions: string[];
	ingredients: IngredientImport[];
}

async function main() {
	const jsonPath = process.argv[2];
	if (!jsonPath) {
		console.error('Usage: npx tsx insert-recipe.ts <recipe.json>');
		process.exit(1);
	}

	const data: RecipeImport = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	// Get first user as creator
	const allUsers = await db.select().from(users).limit(1);
	const userId = allUsers[0]?.id;
	if (!userId) {
		console.error('No users found in database');
		process.exit(1);
	}

	const recipeId = generateId();

	await db.insert(recipes).values({
		id: recipeId,
		title: data.title,
		titleHe: data.titleHe,
		description: data.description,
		sourceUrl: data.sourceUrl,
		sourceType: 'url',
		imageUrl: data.imageUrl,
		servings: data.servings,
		prepTimeMinutes: data.prepTimeMinutes,
		cookTimeMinutes: data.cookTimeMinutes,
		totalTimeMinutes: data.totalTimeMinutes,
		instructions: data.instructions,
		tags: data.tags,
		category: data.category,
		cuisine: data.cuisine,
		isFavorite: false,
		createdBy: userId
	});

	for (let i = 0; i < data.ingredients.length; i++) {
		const ing = data.ingredients[i];
		const ingredientId = await findOrCreateIngredient(ing.canonicalName, ing.canonicalNameHe ?? undefined);

		const recipeIngId = generateId();
		await db.insert(recipeIngredients).values({
			id: recipeIngId,
			recipeId,
			ingredientId,
			quantity: ing.quantity,
			unit: ing.unit,
			originalText: ing.originalText,
			preparation: ing.preparation,
			isOptional: ing.isOptional,
			sortOrder: i
		});

		if (ing.variants && ing.variants.length > 0) {
			const variantIds: string[] = [];
			for (const v of ing.variants) {
				const vid = await findOrCreateVariant(ingredientId, v.name, v.nameHe ?? undefined);
				variantIds.push(vid);
			}
			await setRecipeIngredientVariants(recipeIngId, variantIds);
		}
	}

	console.log(`Recipe "${data.titleHe || data.title}" inserted with ID: ${recipeId}`);
	console.log(`View at: /recipes/${recipeId}`);
}

main().catch((err) => {
	console.error('Failed to insert recipe:', err);
	process.exit(1);
});
