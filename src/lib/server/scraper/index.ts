import { extractJsonLd } from './json-ld';
import { normalizeRecipe, type NormalizedRecipe } from './normalize';
import { extractFromHtml } from './html-fallback';

export type { NormalizedRecipe };

export async function scrapeRecipe(url: string): Promise<NormalizedRecipe> {
	const response = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
		}
	});

	if (!response.ok) {
		throw new Error(`לא הצלחתי לגשת לאתר (${response.status})`);
	}

	const html = await response.text();

	// Try JSON-LD structured data first (most reliable)
	const schema = extractJsonLd(html);
	if (schema) {
		return normalizeRecipe(schema);
	}

	// Fall back to HTML parsing for sites without Recipe schema (e.g. older Hebrew blogs)
	const fromHtml = extractFromHtml(html);
	if (fromHtml) {
		return fromHtml;
	}

	throw new Error(
		'לא נמצא מתכון בדף. ודא שהקישור מוביל לדף מתכון ספציפי (לא לדף קטגוריה). נסה להוסיף את המתכון ידנית.'
	);
}
