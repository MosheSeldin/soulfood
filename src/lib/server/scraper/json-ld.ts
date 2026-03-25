import * as cheerio from 'cheerio';

export interface SchemaRecipe {
	name?: string;
	description?: string;
	image?: string | string[] | { url: string }[];
	recipeIngredient?: string[];
	recipeInstructions?: (string | { text?: string; '@type'?: string })[];
	recipeYield?: string | string[] | number;
	prepTime?: string;
	cookTime?: string;
	totalTime?: string;
	recipeCategory?: string | string[];
	recipeCuisine?: string | string[];
	keywords?: string | string[];
}

/** Extract Schema.org Recipe from JSON-LD scripts in HTML */
export function extractJsonLd(html: string): SchemaRecipe | null {
	const $ = cheerio.load(html);
	const scripts = $('script[type="application/ld+json"]');

	for (let i = 0; i < scripts.length; i++) {
		const content = $(scripts[i]).html();
		if (!content) continue;

		try {
			const data = JSON.parse(content);
			const recipe = findRecipe(data);
			if (recipe) return recipe;
		} catch {
			// Invalid JSON, skip
		}
	}

	return null;
}

function findRecipe(data: unknown): SchemaRecipe | null {
	if (!data || typeof data !== 'object') return null;

	if (Array.isArray(data)) {
		for (const item of data) {
			const found = findRecipe(item);
			if (found) return found;
		}
		return null;
	}

	const obj = data as Record<string, unknown>;

	// Direct Recipe type
	if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) {
		return obj as unknown as SchemaRecipe;
	}

	// Search in @graph
	if (Array.isArray(obj['@graph'])) {
		for (const item of obj['@graph']) {
			const found = findRecipe(item);
			if (found) return found;
		}
	}

	return null;
}
