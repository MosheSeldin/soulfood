import * as cheerio from 'cheerio';
import type { NormalizedRecipe } from './normalize';

// Hebrew (and common English) keywords for recipe sections
const INGREDIENT_SECTION_KEYWORDS = ['מצרכים', 'מרכיבים', 'חומרים', 'נדרש', 'ingredients'];
const INSTRUCTION_SECTION_KEYWORDS = ['אופן הכנה', 'הכנה', 'הוראות הכנה', 'preparation', 'instructions', 'directions'];
const STOP_KEYWORDS = ['הערות', 'הארות', 'שדרוגים', 'טיפים', 'notes', 'tips'];

function stripHtml(html: string): string {
	return html.replace(/<[^>]+>/g, '').trim();
}

function splitByBr(html: string): string[] {
	return html
		.split(/<br\s*\/?>/i)
		.map((s) => stripHtml(s))
		.filter((s) => s.length > 0);
}

function sectionType(headingText: string): 'ingredients' | 'instructions' | 'stop' | 'other' {
	const t = headingText.toLowerCase();
	if (STOP_KEYWORDS.some((k) => t.includes(k.toLowerCase()))) return 'stop';
	if (INSTRUCTION_SECTION_KEYWORDS.some((k) => t.includes(k.toLowerCase()))) return 'instructions';
	if (INGREDIENT_SECTION_KEYWORDS.some((k) => t.includes(k.toLowerCase()))) return 'ingredients';
	return 'other';
}

/**
 * Fallback extractor for sites without Recipe JSON-LD schema.
 * Parses Hebrew recipe pages using common structural patterns.
 */
export function extractFromHtml(html: string): NormalizedRecipe | null {
	const $ = cheerio.load(html);

	// Title: prefer h1 in post area, fall back to og:title / <title>
	const title =
		$('h1.post-title, h1.entry-title, h1.penci-post-title, h1').first().text().trim() ||
		$('meta[property="og:title"]').attr('content')?.split('|')[0]?.split('–')[0]?.trim() ||
		$('title').text().split('|')[0].split('–')[0].trim();

	if (!title) return null;

	// Image
	const imageUrl =
		$('meta[property="og:image"]').attr('content') ||
		$('meta[property="og:image:secure_url"]').attr('content') ||
		null;

	// Description
	const description =
		$('meta[property="og:description"]').attr('content') ||
		$('meta[name="description"]').attr('content') ||
		null;

	// Find the main content container
	const contentArea = $(
		'.pf-content, .entry-content, .post-entry, .post-content, article .content, article'
	).first();

	const ingredients: string[] = [];
	const instructions: string[] = [];

	// Track current section as we walk through paragraphs
	let currentSection: 'ingredients' | 'instructions' | 'stop' | null = null;

	contentArea.find('p, li, ul, ol').each((_, el) => {
		if (currentSection === 'stop') return false; // stop traversal

		const elHtml = $(el).html() || '';
		const elText = stripHtml(elHtml);
		if (!elText) return;

		// Check if this element has a <strong> heading that signals a new section
		const strongText = $(el).find('strong').first().text().trim();
		if (strongText) {
			const type = sectionType(strongText);
			if (type === 'stop') {
				currentSection = 'stop';
				return false;
			}
			if (type !== 'other') {
				currentSection = type;
			}
			// even if 'other' (e.g. sub-section like "לבצל המטוגן:"), keep current section
		}

		// Parse lines from this element
		const lines = splitByBr(elHtml).filter(
			(line) =>
				line.length > 1 &&
				// exclude the heading text itself
				!INGREDIENT_SECTION_KEYWORDS.some((k) => line.includes(k)) &&
				!INSTRUCTION_SECTION_KEYWORDS.some((k) => line.includes(k)) &&
				!STOP_KEYWORDS.some((k) => line.includes(k))
		);

		if (currentSection === 'ingredients' && lines.length > 0) {
			ingredients.push(...lines);
		} else if (currentSection === 'instructions' && lines.length > 0) {
			instructions.push(...lines);
		}
	});

	if (ingredients.length === 0 && instructions.length === 0) return null;

	return {
		title,
		description: description || null,
		imageUrl,
		ingredients,
		instructions,
		servings: null,
		prepTimeMinutes: null,
		cookTimeMinutes: null,
		totalTimeMinutes: null,
		category: null,
		cuisine: null,
		tags: []
	};
}
