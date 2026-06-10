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

// ────────────────────────────────────────────────────────────────────────────
// Canonical identity key
// ────────────────────────────────────────────────────────────────────────────

/** True if the string contains any Hebrew letter. */
export function isHebrew(s: string | null | undefined): boolean {
	return !!s && /[א-ת]/.test(s);
}

/** Lowercase, collapse whitespace, drop a stray leading quantity, comma text + parentheticals. */
function normalizeRaw(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, ' ')
		.replace(/,.*$/, '')
		.replace(/\s*\(.*?\)\s*/g, '')
		// strip a leading quantity token (digits / fractions) that slipped past the parser
		.replace(/^[\d.,/\s¼½¾⅓⅔⅛⅜⅝⅞-]+/, '')
		.trim();
}

/**
 * Compute a stable, language-tagged canonical key for an ingredient.
 *
 * This is THE deduplication primitive: two ingredient strings that denote the
 * same base product must produce the same key. Hebrew is preferred when present
 * (the app is Hebrew-first), so a clean bilingual row {name:"onion", nameHe:"בצל"}
 * and a Hebrew-only row {name:"בצל"} collapse to the same key ("he:בצל").
 *
 * Returns "" only when no usable name is given.
 */
export function computeNameKey(name?: string | null, nameHe?: string | null): string {
	const he = (nameHe && nameHe.trim()) || (isHebrew(name) ? name!.trim() : '');
	const en = !isHebrew(name) ? (name?.trim() || '') : '';
	const primary = he || en;
	if (!primary) return '';
	const lang = he ? 'he' : 'en';
	const normalized = normalizeRaw(primary);
	const stripped = stripIngredientModifiers(normalized) || normalized;
	const { base } = extractBaseAndVariant(stripped);
	return `${lang}:${(base || stripped).trim()}`;
}

/**
 * Split a single user-typed/parsed name into the correct {name, nameHe} fields
 * by detecting its language. Used by callers that only have one string.
 */
export function splitByLanguage(raw: string): { name: string | null; nameHe: string | null } {
	const trimmed = raw.trim();
	if (!trimmed) return { name: null, nameHe: null };
	return isHebrew(trimmed) ? { name: null, nameHe: trimmed } : { name: trimmed, nameHe: null };
}

/** Language-tagged key for a single raw string (auto-detects he/en). */
export function keyForString(raw: string): string {
	return isHebrew(raw) ? computeNameKey(null, raw) : computeNameKey(raw, null);
}

/**
 * Key for a VARIANT (distinct product type within one ingredient), e.g. "white"
 * vs "red" onion, "olive" vs "canola" oil. Unlike computeNameKey it does NOT
 * collapse to the base — it keeps the full normalized label (prep/quality words
 * still stripped) so different variants of the same base stay distinct.
 */
export function computeVariantKey(name?: string | null, nameHe?: string | null): string {
	const he = (nameHe && nameHe.trim()) || (isHebrew(name) ? name!.trim() : '');
	const en = !isHebrew(name) ? (name?.trim() || '') : '';
	const primary = he || en;
	if (!primary) return '';
	const lang = he ? 'he' : 'en';
	const normalized = normalizeRaw(primary);
	return `${lang}:${stripIngredientModifiers(normalized) || normalized}`;
}

export interface Canonical {
	/** Base ingredient identity fields (Hebrew never stored in `name`). */
	baseName: string | null;
	baseNameHe: string | null;
	/** Canonical key for the BASE ingredient (the uniqueness anchor). */
	nameKey: string;
	/** Detected variant label, if the input named a specific product type. */
	variantName: string | null;
	variantNameHe: string | null;
}

/**
 * Decompose any {name?, nameHe?} (or messy single value) into clean base
 * ingredient fields + an optional variant, using the word classifier. This is
 * the single source of truth shared by the resolver and the data migration.
 */
export function canonicalize(name?: string | null, nameHe?: string | null): Canonical {
	let nm = name?.trim() || null;
	let he = nameHe?.trim() || null;
	// Never keep Hebrew text in the English slot.
	if (nm && isHebrew(nm)) {
		he = he || nm;
		nm = null;
	}
	const enParts = nm ? extractBaseAndVariant(stripIngredientModifiers(normalizeRaw(nm)) || normalizeRaw(nm)) : null;
	const heParts = he ? extractBaseAndVariant(stripIngredientModifiers(normalizeRaw(he)) || normalizeRaw(he)) : null;
	const baseName = enParts?.base || null;
	const baseNameHe = heParts?.base || null;
	return {
		baseName,
		baseNameHe,
		nameKey: computeNameKey(baseName, baseNameHe),
		variantName: enParts?.variant || null,
		variantNameHe: heParts?.variant || null
	};
}
