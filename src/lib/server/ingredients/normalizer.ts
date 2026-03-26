import { db } from '../db';
import { ingredients, ingredientVariants } from '../db/schema';
import { eq, like } from 'drizzle-orm';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateVariant } from './variants';

/** Try to find an existing ingredient by name, or create a new one with variant detection */
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

	// Try to extract variant from Hebrew name
	if (nameHe) {
		const { base, variant } = extractVariant(nameHe);
		if (variant) {
			// Look for base ingredient
			const baseMatch = await db
				.select()
				.from(ingredients)
				.where(eq(ingredients.nameHe, base))
				.limit(1);

			if (baseMatch.length > 0) {
				// Found base ingredient, create variant
				await findOrCreateVariant(baseMatch[0].id, variant, variant);
				return baseMatch[0].id;
			}
		}
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

const HEBREW_VARIANTS = [
	// Colors
	'שחור', 'לבן', 'אדום', 'צהוב', 'ירוק', 'כחול', 'חום', 'כתום',
	// Freshness
	'טרי', 'קפוא', 'מיובש', 'טחון',
	// Position/form
	'תחתון', 'עליון', 'קלוף', 'שלם', 'פיצוח', 'פצוח',
	// Type
	'אורגני', 'דגנים', 'מלח', 'סוכר', 'חמוץ',
	// Size
	'קטן', 'גדול', 'בינוני',
	// Processing
	'מטחון', 'מרוסק', 'קצוץ', 'פרוס'
];

/**
 * Extract variant from Hebrew ingredient name
 * e.g., "סוכר שחור" -> { base: "סוכר", variant: "שחור" }
 */
function extractVariant(nameHe: string): { base: string; variant: string | null } {
	const parts = nameHe.trim().split(/\s+/);
	if (parts.length < 2) return { base: nameHe, variant: null };

	// Check if last part is a known variant
	const lastPart = parts[parts.length - 1];
	if (HEBREW_VARIANTS.includes(lastPart)) {
		const base = parts.slice(0, -1).join(' ');
		return { base, variant: lastPart };
	}

	// Check if first part is a variant (less common but possible)
	const firstPart = parts[0];
	if (HEBREW_VARIANTS.includes(firstPart) && parts.length > 1) {
		const base = parts.slice(1).join(' ');
		return { base, variant: firstPart };
	}

	return { base: nameHe, variant: null };
}

function stripAdjectives(name: string): string {
	let result = name;
	for (const adj of ADJECTIVES) {
		result = result.replace(new RegExp(`\\b${adj}\\b`, 'gi'), '');
	}
	return result.replace(/\s+/g, ' ').trim();
}
