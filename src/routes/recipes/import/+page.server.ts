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
	save: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');

		const data = await request.formData();
		const title = (data.get('title') as string)?.trim();
		const description = (data.get('description') as string)?.trim() || null;
		const sourceUrl = (data.get('sourceUrl') as string)?.trim() || null;
		const imageUrl = (data.get('imageUrl') as string)?.trim() || null;
		const servings = parseInt(data.get('servings') as string) || null;
		const prepTime = parseInt(data.get('prepTime') as string) || null;
		const cookTime = parseInt(data.get('cookTime') as string) || null;
		const totalTime = parseInt(data.get('totalTime') as string) || null;
		const category = (data.get('category') as string) || null;
		const cuisine = (data.get('cuisine') as string) || null;
		const ingredientsJson = data.get('ingredients') as string;
		const instructionsJson = data.get('instructions') as string;
		const tagsJson = data.get('tags') as string;

		if (!title) return fail(400, { error: 'נא להזין שם למתכון' });

		let ingredientsList: string[] = [];
		try { ingredientsList = ingredientsJson ? JSON.parse(ingredientsJson) : []; } catch { /* */ }

		let instructions: string[] = [];
		try { instructions = instructionsJson ? JSON.parse(instructionsJson) : []; } catch { /* */ }

		let tags: string[] = [];
		try { tags = tagsJson ? JSON.parse(tagsJson) : []; } catch { /* */ }

		const recipeId = generateId();

		await db.insert(recipes).values({
			id: recipeId,
			title,
			description,
			sourceUrl,
			sourceType: 'url',
			imageUrl,
			servings,
			prepTimeMinutes: prepTime,
			cookTimeMinutes: cookTime,
			totalTimeMinutes: totalTime,
			instructions,
			tags,
			category,
			cuisine,
			isFavorite: false,
			createdBy: locals.user.userId
		});

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
