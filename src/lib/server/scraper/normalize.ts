import type { SchemaRecipe } from './json-ld';
import { parseIsoDuration, parseServings } from '$lib/utils/helpers';

export interface NormalizedRecipe {
	title: string;
	description: string | null;
	imageUrl: string | null;
	ingredients: string[];
	instructions: string[];
	servings: number | null;
	prepTimeMinutes: number | null;
	cookTimeMinutes: number | null;
	totalTimeMinutes: number | null;
	category: string | null;
	cuisine: string | null;
	tags: string[];
}

export function normalizeRecipe(schema: SchemaRecipe): NormalizedRecipe {
	return {
		title: schema.name || 'מתכון ללא שם',
		description: schema.description || null,
		imageUrl: extractImage(schema.image),
		ingredients: schema.recipeIngredient || [],
		instructions: extractInstructions(schema.recipeInstructions),
		servings: parseServings(schema.recipeYield),
		prepTimeMinutes: parseIsoDuration(schema.prepTime),
		cookTimeMinutes: parseIsoDuration(schema.cookTime),
		totalTimeMinutes: parseIsoDuration(schema.totalTime),
		category: extractFirst(schema.recipeCategory),
		cuisine: extractFirst(schema.recipeCuisine),
		tags: extractTags(schema.keywords)
	};
}

function extractImage(
	image: string | string[] | { url: string }[] | undefined
): string | null {
	if (!image) return null;
	if (typeof image === 'string') return image;
	if (Array.isArray(image)) {
		const first = image[0];
		if (!first) return null;
		if (typeof first === 'string') return first;
		if (typeof first === 'object' && 'url' in first) return first.url;
	}
	return null;
}

function extractInstructions(
	instructions: (string | { text?: string; '@type'?: string })[] | undefined
): string[] {
	if (!instructions) return [];
	return instructions
		.map((item) => {
			if (typeof item === 'string') return item.trim();
			if (typeof item === 'object' && item.text) return item.text.trim();
			return '';
		})
		.filter((s) => s.length > 0);
}

function extractFirst(value: string | string[] | undefined): string | null {
	if (!value) return null;
	if (typeof value === 'string') return value;
	return value[0] || null;
}

function extractTags(keywords: string | string[] | undefined): string[] {
	if (!keywords) return [];
	if (Array.isArray(keywords)) return keywords;
	return keywords
		.split(',')
		.map((k) => k.trim())
		.filter((k) => k.length > 0);
}
