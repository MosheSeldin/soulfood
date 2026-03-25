import { extractJsonLd } from './json-ld';
import { normalizeRecipe, type NormalizedRecipe } from './normalize';

export type { NormalizedRecipe };

export async function scrapeRecipe(url: string): Promise<NormalizedRecipe> {
	const response = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (compatible; SoulFood/1.0; +https://soulfood.app)',
			Accept: 'text/html,application/xhtml+xml'
		}
	});

	if (!response.ok) {
		throw new Error(`לא הצלחתי לגשת לאתר (${response.status})`);
	}

	const html = await response.text();

	const schema = extractJsonLd(html);
	if (!schema) {
		throw new Error('לא נמצא מתכון בדף. ודא שהקישור מוביל לדף מתכון ספציפי (לא לדף קטגוריה). נסה להוסיף את המתכון ידנית.');
	}

	return normalizeRecipe(schema);
}
