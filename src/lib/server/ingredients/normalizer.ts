import { db } from '../db';
import { ingredients } from '../db/schema';
import { eq, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';

/** Try to find an existing ingredient by name, or create a new one */
export async function findOrCreateIngredient(
	name: string,
	nameHe?: string
): Promise<string> {
	const normalized = normalizeName(name);

	// Exact match
	const exact = await db
		.select()
		.from(ingredients)
		.where(eq(ingredients.name, normalized))
		.limit(1);
	if (exact.length > 0) return exact[0].id;

	// Try Hebrew name match
	if (nameHe) {
		const heMatch = await db
			.select()
			.from(ingredients)
			.where(eq(ingredients.nameHe, nameHe))
			.limit(1);
		if (heMatch.length > 0) return heMatch[0].id;
	}

	// Fuzzy: try without common prefixes/adjectives
	const stripped = stripAdjectives(normalized);
	if (stripped !== normalized) {
		const fuzzy = await db
			.select()
			.from(ingredients)
			.where(like(ingredients.name, `%${stripped}%`))
			.limit(1);
		if (fuzzy.length > 0) return fuzzy[0].id;
	}

	// Create new ingredient
	const id = generateId();
	await db.insert(ingredients).values({
		id,
		name: normalized,
		nameHe: nameHe || null
	});
	return id;
}

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/,.*$/, '') // remove trailing comma text
		.replace(/\s*\(.*?\)\s*/g, '') // remove parenthetical
		.trim();
}

const ADJECTIVES = [
	'fresh',
	'dried',
	'organic',
	'large',
	'medium',
	'small',
	'chopped',
	'diced',
	'minced',
	'sliced',
	'grated',
	'shredded',
	'ground',
	'whole',
	'boneless',
	'skinless',
	'extra-virgin',
	'unsalted',
	'salted',
	'raw',
	'cooked',
	'frozen',
	'canned',
	'packed',
	'loosely',
	'firmly',
	'finely',
	'roughly',
	'thinly',
	'ripe'
];

function stripAdjectives(name: string): string {
	let result = name;
	for (const adj of ADJECTIVES) {
		result = result.replace(new RegExp(`\\b${adj}\\b`, 'gi'), '');
	}
	return result.replace(/\s+/g, ' ').trim();
}
