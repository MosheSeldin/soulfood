import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import { generateId } from '$lib/utils/helpers';
import { parseIngredient } from '$lib/server/ingredients/parser';
import { findOrCreateIngredient } from '$lib/server/ingredients/normalizer';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const titleHe = (data.get('titleHe') as string)?.trim() || null;
		const description = (data.get('description') as string)?.trim() || null;
		const category = (data.get('category') as string) || null;
		const cuisine = (data.get('cuisine') as string) || null;
		const servings = parseInt(data.get('servings') as string) || null;
		const prepTime = parseInt(data.get('prepTime') as string) || null;
		const cookTime = parseInt(data.get('cookTime') as string) || null;
		const sourceUrl = (data.get('sourceUrl') as string)?.trim() || null;
		const sourceType = (data.get('sourceType') as string) || 'manual';
		const imageUrl = (data.get('imageUrl') as string)?.trim() || null;

		// Get ingredients (sent as JSON string)
		const ingredientsJson = data.get('ingredients') as string;
		// Get instructions (sent as JSON string)
		const instructionsJson = data.get('instructions') as string;

		if (!title) {
			return fail(400, { error: 'נא להזין שם למתכון' });
		}

		let ingredientsList: string[] = [];
		try {
			ingredientsList = ingredientsJson ? JSON.parse(ingredientsJson) : [];
		} catch {
			ingredientsList = [];
		}

		let instructions: string[] = [];
		try {
			instructions = instructionsJson ? JSON.parse(instructionsJson) : [];
		} catch {
			instructions = [];
		}

		const recipeId = generateId();
		const totalTime =
			prepTime && cookTime ? prepTime + cookTime : prepTime || cookTime || null;

		await db.insert(recipes).values({
			id: recipeId,
			title,
			titleHe,
			description,
			sourceUrl,
			sourceType,
			imageUrl,
			servings,
			prepTimeMinutes: prepTime,
			cookTimeMinutes: cookTime,
			totalTimeMinutes: totalTime,
			instructions,
			tags: [],
			category,
			cuisine,
			isFavorite: false,
			createdBy: locals.user.userId
		});

		// Parse and save ingredients
		for (let i = 0; i < ingredientsList.length; i++) {
			const raw = ingredientsList[i].trim();
			if (!raw) continue;

			const parsed = parseIngredient(raw);
			const ingredientId = await findOrCreateIngredient(parsed.name);

			await db.insert(recipeIngredients).values({
				id: generateId(),
				recipeId,
				ingredientId,
				quantity: parsed.quantity,
				unit: parsed.unit,
				originalText: parsed.original,
				preparation: parsed.preparation,
				sortOrder: i
			});
		}

		redirect(302, `/recipes/${recipeId}`);
	}
};
