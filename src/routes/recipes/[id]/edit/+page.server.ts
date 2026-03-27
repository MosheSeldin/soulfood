import { redirect, error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes, recipeIngredients, ingredients } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { resolveIngredient } from '$lib/server/ingredients/normalizer';
import {
	getVariantsForRecipeIngredients,
	findOrCreateVariant,
	setRecipeIngredientVariants
} from '$lib/server/ingredients/variants';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');

	const recipe = await db.select().from(recipes).where(eq(recipes.id, params.id)).limit(1);
	if (recipe.length === 0) error(404, 'מתכון לא נמצא');

	const recipeIngs = await db
		.select({
			id: recipeIngredients.id,
			quantity: recipeIngredients.quantity,
			unit: recipeIngredients.unit,
			preparation: recipeIngredients.preparation,
			isOptional: recipeIngredients.isOptional,
			sortOrder: recipeIngredients.sortOrder,
			originalText: recipeIngredients.originalText,
			ingredientId: recipeIngredients.ingredientId,
			ingredientName: ingredients.name,
			ingredientNameHe: ingredients.nameHe
		})
		.from(recipeIngredients)
		.leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
		.where(eq(recipeIngredients.recipeId, params.id))
		.orderBy(recipeIngredients.sortOrder);

	const recipeIngIds = recipeIngs.map((ri) => ri.id);
	const variantsMap = await getVariantsForRecipeIngredients(recipeIngIds);

	const structuredIngredients = recipeIngs.map((ri) => ({
		quantity: ri.quantity,
		unit: ri.unit,
		name: ri.ingredientNameHe || ri.ingredientName || '',
		preparation: ri.preparation || '',
		isOptional: ri.isOptional,
		variants: (variantsMap[ri.id] || []).map((v) => ({
			name: v.nameHe || v.name,
			nameEn: v.name
		}))
	}));

	return {
		recipe: recipe[0],
		ingredients: structuredIngredients
	};
};

interface StructuredIngredient {
	quantity: number | null;
	unit: string | null;
	name: string;
	preparation: string;
	isOptional: boolean;
	variants: Array<{ name: string; nameEn: string }>;
}

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const description = (data.get('description') as string)?.trim() || null;
		const category = (data.get('category') as string) || null;
		const cuisine = (data.get('cuisine') as string) || null;
		const servings = parseInt(data.get('servings') as string) || null;
		const prepTime = parseInt(data.get('prepTime') as string) || null;
		const cookTime = parseInt(data.get('cookTime') as string) || null;
		const imageUrl = (data.get('imageUrl') as string)?.trim() || null;

		const ingredientsJson = data.get('ingredients') as string;
		const instructionsJson = data.get('instructions') as string;

		if (!title) {
			return fail(400, { error: 'נא להזין שם למתכון' });
		}

		let ingredientsList: StructuredIngredient[] = [];
		try {
			ingredientsList = ingredientsJson ? JSON.parse(ingredientsJson) : [];
		} catch {
			ingredientsList = [];
		}

		let instructionsList: string[] = [];
		try {
			instructionsList = instructionsJson ? JSON.parse(instructionsJson) : [];
		} catch {
			instructionsList = [];
		}

		const totalTime =
			prepTime && cookTime ? prepTime + cookTime : prepTime || cookTime || null;

		await db
			.update(recipes)
			.set({
				title,
				description,
				category,
				cuisine,
				servings,
				prepTimeMinutes: prepTime,
				cookTimeMinutes: cookTime,
				totalTimeMinutes: totalTime,
				instructions: instructionsList,
				imageUrl,
				updatedAt: new Date()
			})
			.where(eq(recipes.id, params.id));

		// Replace ingredients: delete old (cascade deletes variants), insert new
		await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, params.id));

		for (let i = 0; i < ingredientsList.length; i++) {
			const ing = ingredientsList[i];
			if (!ing.name?.trim()) continue;

			const { ingredientId, variantId: autoVariantId } = await resolveIngredient(ing.name);

			const recipeIngId = generateId();
			await db.insert(recipeIngredients).values({
				id: recipeIngId,
				recipeId: params.id,
				ingredientId,
				quantity: ing.quantity,
				unit: ing.unit || null,
				originalText: ing.name,
				preparation: ing.preparation?.trim() || null,
				isOptional: ing.isOptional || false,
				sortOrder: i
			});

			// Use explicit variants if provided; otherwise fall back to auto-detected variant
			if (ing.variants && ing.variants.length > 0) {
				const variantIds: string[] = [];
				for (const v of ing.variants) {
					if (!v.name?.trim()) continue;
					const vid = await findOrCreateVariant(
						ingredientId,
						v.nameEn || v.name,
						v.name
					);
					variantIds.push(vid);
				}
				if (variantIds.length > 0) {
					await setRecipeIngredientVariants(recipeIngId, variantIds);
				}
			} else if (autoVariantId) {
				await setRecipeIngredientVariants(recipeIngId, [autoVariantId]);
			}
		}

		redirect(302, `/recipes/${params.id}`);
	}
};
