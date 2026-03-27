/**
 * Ingredient word classifier.
 *
 * Separates ingredient modifier words into three buckets:
 * - VARIANT_WORDS  : Define a distinct product type to buy → stored as an ingredientVariant
 * - PREPARATION_WORDS : Describe cooking method → strip, store in preparation field (parser already does this)
 * - QUALITY_WORDS  : Freshness / quality descriptors that don't affect shopping → strip completely
 *
 * Also exports COMPOUND_INGREDIENTS – multi-word ingredient names that must never be split.
 */

export const VARIANT_WORDS = new Set([
	// ─── Salt forms ────────────────────────────────────────────────────────────
	'גס', 'גסה', 'דק', 'דקה', 'ים', 'ורוד', 'שולחן',
	// ─── Oil / fat types ───────────────────────────────────────────────────────
	'זית', 'קנולה', 'חמניות', 'תירס', 'שומשום', 'קוקוס',
	// ─── Pepper / spice colours (used as product differentiator) ───────────────
	'שחור', 'לבן', 'אדום', 'ירוק', 'כחול', 'כתום', 'צהוב', 'חום', 'סגול', 'קאיין',
	// Gendered / plural forms of the same colours
	'שחורה', 'לבנה', 'אדומה', 'ירוקה', 'כחולה', 'כתומה', 'צהובה', 'חומה', 'סגולה',
	'שחורים', 'לבנים', 'אדומים', 'ירוקים', 'שחורות', 'לבנות', 'אדומות', 'ירוקות',
	// ─── Dairy ─────────────────────────────────────────────────────────────────
	'מלא', 'עיזים', 'כבשים', 'שקדים',
	// ─── Vinegar types ─────────────────────────────────────────────────────────
	'תפוחים', 'בלסמי', 'יין', 'אורז',
	// ─── Tomato forms ──────────────────────────────────────────────────────────
	'שרי', 'רומא',
	// ─── English equivalents ───────────────────────────────────────────────────
	'black', 'white', 'red', 'green', 'yellow', 'blue', 'brown', 'pink',
	'coarse', 'fine', 'sea', 'kosher', 'iodized',
	'extra-virgin', 'virgin', 'light', 'dark',
	'whole', 'skim', 'low-fat', 'full-fat',
	'wild', 'farmed', 'smoked', 'unsmoked',
	'balsamic', 'apple', 'rice', 'white-wine', 'red-wine',
	'cherry', 'roma', 'plum'
]);

export const PREPARATION_WORDS = new Set([
	// ─── Hebrew ────────────────────────────────────────────────────────────────
	'קצוץ', 'קצוצה', 'קצוצים', 'קצוצות',
	'מגורד', 'מגורדת', 'מגורדים', 'מגורדות',
	'פרוס', 'פרוסה', 'פרוסים', 'פרוסות',
	'שלם', 'שלמה', 'שלמים', 'שלמות',
	'קלוף', 'קלופה', 'קלופים', 'קלופות',
	'מרוסק', 'מרוסקת', 'מרוסקים',
	'חתוך', 'חתוכה', 'חתוכים', 'חתוכות',
	'מומס', 'מומסת',
	'מבושל', 'מבושלת', 'מבושלים', 'מבושלות',
	'צלוי', 'צלויה', 'צלויים', 'צלויות',
	'מושרה', 'מושרות',
	'קצוץ', 'מוחמץ', 'מוחמצת',
	'טחון', 'טחונה', 'טחונים',     // "ground" as a cooking method (e.g. meat)
	'מאודה', 'מאודות',
	// ─── English ───────────────────────────────────────────────────────────────
	'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
	'julienned', 'cubed', 'quartered', 'halved', 'peeled', 'pitted',
	'crushed', 'pressed', 'torn', 'crumbled', 'beaten', 'whisked',
	'melted', 'softened', 'roasted', 'toasted', 'blanched',
	'soaked', 'drained', 'rinsed', 'patted'
]);

export const QUALITY_WORDS = new Set([
	// ─── Hebrew ────────────────────────────────────────────────────────────────
	'טרי', 'טרייה', 'טריים', 'טריות',
	'קפוא', 'קפואה', 'קפואים', 'קפואות',
	'אורגני', 'אורגנית', 'אורגניים', 'אורגניות',
	'גדול', 'גדולה', 'גדולים', 'גדולות',
	'קטן', 'קטנה', 'קטנים', 'קטנות',
	'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
	'טבעי', 'טבעית', 'טבעיים',
	'מיובש', 'מיובשת', 'מיובשים',     // "dried" as quality (not product type like "dried pasta")
	'איכותי', 'איכותית',
	'חצי',                              // "half" – prevent "חצי מלח" becoming an ingredient
	// ─── English ───────────────────────────────────────────────────────────────
	'fresh', 'frozen', 'dried', 'organic',
	'large', 'medium', 'small', 'extra-large', 'xl', 'jumbo',
	'baby', 'young', 'aged', 'mature', 'ripe', 'overripe',
	'natural', 'conventional', 'premium', 'quality',
	'boneless', 'skinless',
	'unsalted', 'salted',
	'packed', 'loosely', 'firmly', 'finely', 'roughly', 'thinly', 'lightly'
]);

/**
 * Multi-word ingredient names that must NEVER be split.
 * Checked before any word-removal attempt.
 */
export const COMPOUND_INGREDIENTS = new Set([
	'תפוח אדמה',
	'תפוחי אדמה',
	'שיבולת שועל',
	'עלי דפנה',
	'עלה דפנה',
	'שמנת חמוצה',
	'גבינה צהובה',
	'גבינה לבנה',
	'שמן זית',
	'חמאת בוטנים',
	'שמן קוקוס',
	'קמח תפוחי אדמה'
]);

// ────────────────────────────────────────────────────────────────────────────
// Pure utility functions (no DB calls)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Remove all PREPARATION and QUALITY words from an ingredient name.
 * Safe to call on both Hebrew and English text.
 */
export function stripIngredientModifiers(name: string): string {
	const words = name.split(/\s+/);
	const filtered = words.filter(
		(w) => !PREPARATION_WORDS.has(w) && !QUALITY_WORDS.has(w)
	);
	return filtered.join(' ').trim();
}

/**
 * Given a cleaned ingredient name (prep/quality already stripped),
 * attempt to extract a base ingredient name + variant label.
 *
 * Strategy: progressive right-to-left word removal.
 * If the rightmost word is in VARIANT_WORDS, the remainder is the base.
 * Only removes ONE level (the last word) to limit false positives.
 *
 * Returns { base, variant } where variant is null if no variant detected.
 *
 * Examples:
 *   "מלח גס"      → { base: "מלח",       variant: "גס" }
 *   "שמן זית"     → { base: "שמן",        variant: "זית" }
 *   "פלפל שחור"   → { base: "פלפל",      variant: "שחור" }
 *   "מלח"         → { base: "מלח",        variant: null  }
 *   "תפוח אדמה"   → { base: "תפוח אדמה", variant: null  } (compound — never split)
 */
export function extractBaseAndVariant(name: string): { base: string; variant: string | null } {
	const trimmed = name.trim();

	// Never split a known compound
	if (COMPOUND_INGREDIENTS.has(trimmed)) {
		return { base: trimmed, variant: null };
	}

	const words = trimmed.split(/\s+/);
	if (words.length < 2) return { base: trimmed, variant: null };

	const lastWord = words[words.length - 1];
	if (VARIANT_WORDS.has(lastWord)) {
		const base = words.slice(0, -1).join(' ');
		return { base, variant: lastWord };
	}

	// Also check first word (less common in Hebrew but handles English "black pepper" etc.)
	const firstWord = words[0];
	if (VARIANT_WORDS.has(firstWord) && words.length === 2) {
		const base = words.slice(1).join(' ');
		return { base, variant: firstWord };
	}

	return { base: trimmed, variant: null };
}

/**
 * Greedy base lookup: progressively remove the rightmost word regardless of
 * whether it's in VARIANT_WORDS, and return each candidate base name to try.
 * Used as a second-pass fallback in the normalizer.
 *
 * Example: ["שמן", "זית"] → ["שמן"]
 * Capped at removing up to (length - 1) words to always leave at least one word.
 */
export function greedyBaseCandidates(name: string): string[] {
	if (COMPOUND_INGREDIENTS.has(name.trim())) return [];
	const words = name.trim().split(/\s+/);
	const candidates: string[] = [];
	for (let i = words.length - 1; i >= 1; i--) {
		candidates.push(words.slice(0, i).join(' '));
	}
	return candidates;
}
