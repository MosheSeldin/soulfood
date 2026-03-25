import { json, error } from '@sveltejs/kit';
import { scrapeRecipe } from '$lib/server/scraper';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'לא מחובר');

	const { url } = await request.json();
	if (!url || typeof url !== 'string') {
		error(400, 'נא לספק קישור');
	}

	try {
		new URL(url);
	} catch {
		error(400, 'קישור לא תקין');
	}

	try {
		const recipe = await scrapeRecipe(url);
		return json(recipe);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'שגיאה בייבוא המתכון';
		error(422, message);
	}
};
