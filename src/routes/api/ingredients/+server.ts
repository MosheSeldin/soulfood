import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { ingredients } from '$lib/server/db/schema';
import { like, or } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json([]);

	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 1) return json([]);

	const results = await db
		.select({
			id: ingredients.id,
			name: ingredients.name,
			nameHe: ingredients.nameHe
		})
		.from(ingredients)
		.where(
			or(
				like(ingredients.name, `%${q}%`),
				like(ingredients.nameHe, `%${q}%`)
			)
		)
		.limit(10);

	return json(results);
};
