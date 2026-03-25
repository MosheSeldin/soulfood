export interface ParsedIngredient {
	quantity: number | null;
	unit: string | null;
	name: string;
	preparation: string | null;
	original: string;
}

const UNICODE_FRACTIONS: Record<string, number> = {
	'½': 0.5,
	'⅓': 1 / 3,
	'⅔': 2 / 3,
	'¼': 0.25,
	'¾': 0.75,
	'⅕': 0.2,
	'⅖': 0.4,
	'⅗': 0.6,
	'⅘': 0.8,
	'⅙': 1 / 6,
	'⅚': 5 / 6,
	'⅛': 0.125,
	'⅜': 0.375,
	'⅝': 0.625,
	'⅞': 0.875
};

const UNIT_PATTERNS = [
	// English
	'cups?',
	'c\\.',
	'tablespoons?',
	'tbsps?',
	'tbs?',
	'teaspoons?',
	'tsps?',
	'ounces?',
	'oz',
	'pounds?',
	'lbs?',
	'grams?',
	'g\\b',
	'kilograms?',
	'kg',
	'milliliters?',
	'ml',
	'liters?',
	'l\\b',
	'pinch(?:es)?',
	'cloves?',
	'bunch(?:es)?',
	'pieces?',
	'slices?',
	'cans?',
	'packages?',
	'packs?',
	// Hebrew
	'כוסות|כוס',
	'כפות|כף',
	'כפיות|כפית',
	'גרם',
	'ק"ג|קילו(?:גרם)?',
	'מ"ל|מיליליטר',
	'ליטר',
	'יחידות|יחידה',
	'שיני|שן',
	'אגודות|אגודה',
	'חבילות|חבילה',
	'פרוסות|פרוסה',
	'קופסאות|קופסה|פחית|פחיות'
];

const UNIT_REGEX = new RegExp(`^(${UNIT_PATTERNS.join('|')})\\s+`, 'i');

function parseFraction(str: string): number | null {
	// Check unicode fractions
	for (const [char, val] of Object.entries(UNICODE_FRACTIONS)) {
		if (str.includes(char)) {
			const prefix = str.replace(char, '').trim();
			const whole = prefix ? parseInt(prefix, 10) : 0;
			return (isNaN(whole) ? 0 : whole) + val;
		}
	}

	// Regular fraction like "1/2" or "1 1/2"
	const fractionMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)/);
	if (fractionMatch) {
		return parseInt(fractionMatch[1]) + parseInt(fractionMatch[2]) / parseInt(fractionMatch[3]);
	}

	const simpleFraction = str.match(/^(\d+)\/(\d+)/);
	if (simpleFraction) {
		return parseInt(simpleFraction[1]) / parseInt(simpleFraction[2]);
	}

	// Decimal or integer
	const numMatch = str.match(/^(\d+\.?\d*)/);
	if (numMatch) {
		return parseFloat(numMatch[1]);
	}

	return null;
}

export function parseIngredient(text: string): ParsedIngredient {
	const original = text.trim();
	let remaining = original;

	// Extract preparation notes (after comma or in parentheses)
	let preparation: string | null = null;
	const commaIdx = remaining.indexOf(',');
	if (commaIdx !== -1) {
		preparation = remaining.slice(commaIdx + 1).trim();
		remaining = remaining.slice(0, commaIdx).trim();
	}

	const parenMatch = remaining.match(/\(([^)]+)\)/);
	if (parenMatch) {
		preparation = preparation ? `${parenMatch[1]}, ${preparation}` : parenMatch[1];
		remaining = remaining.replace(/\([^)]+\)/, '').trim();
	}

	// Parse quantity
	let quantity: number | null = null;
	// Try unicode fractions first
	for (const char of Object.keys(UNICODE_FRACTIONS)) {
		const idx = remaining.indexOf(char);
		if (idx !== -1) {
			const before = remaining.slice(0, idx).trim();
			const whole = before ? parseInt(before, 10) : 0;
			quantity = (isNaN(whole) ? 0 : whole) + UNICODE_FRACTIONS[char];
			remaining = remaining.slice(idx + 1).trim();
			break;
		}
	}

	if (quantity === null) {
		// Try fraction patterns
		const qtyMatch = remaining.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\.?\d*)\s*/);
		if (qtyMatch) {
			quantity = parseFraction(qtyMatch[1]);
			remaining = remaining.slice(qtyMatch[0].length).trim();
		}
	}

	// Parse unit
	let unit: string | null = null;
	const unitMatch = remaining.match(UNIT_REGEX);
	if (unitMatch) {
		unit = normalizeUnit(unitMatch[1]);
		remaining = remaining.slice(unitMatch[0].length).trim();
	}

	// Remove leading "of" or "של"
	remaining = remaining.replace(/^(of|של)\s+/i, '').trim();

	return {
		quantity,
		unit,
		name: remaining || original,
		preparation,
		original
	};
}

function normalizeUnit(unit: string): string {
	const lower = unit.toLowerCase().trim();
	const map: Record<string, string> = {
		cup: 'cup',
		cups: 'cup',
		'c.': 'cup',
		tablespoon: 'tbsp',
		tablespoons: 'tbsp',
		tbsp: 'tbsp',
		tbsps: 'tbsp',
		tbs: 'tbsp',
		tb: 'tbsp',
		teaspoon: 'tsp',
		teaspoons: 'tsp',
		tsp: 'tsp',
		tsps: 'tsp',
		ounce: 'oz',
		ounces: 'oz',
		oz: 'oz',
		pound: 'lb',
		pounds: 'lb',
		lb: 'lb',
		lbs: 'lb',
		gram: 'g',
		grams: 'g',
		g: 'g',
		kilogram: 'kg',
		kilograms: 'kg',
		kg: 'kg',
		milliliter: 'ml',
		milliliters: 'ml',
		ml: 'ml',
		liter: 'l',
		liters: 'l',
		l: 'l',
		// Hebrew
		כוס: 'cup',
		כוסות: 'cup',
		כף: 'tbsp',
		כפות: 'tbsp',
		כפית: 'tsp',
		כפיות: 'tsp',
		גרם: 'g',
		'ק"ג': 'kg',
		קילוגרם: 'kg',
		קילו: 'kg',
		'מ"ל': 'ml',
		מיליליטר: 'ml',
		ליטר: 'l',
		יחידה: 'piece',
		יחידות: 'piece',
		שן: 'clove',
		שיני: 'clove',
		חבילה: 'package',
		חבילות: 'package',
		פחית: 'can',
		פחיות: 'can',
		קופסה: 'can',
		קופסאות: 'can'
	};
	return map[lower] || lower;
}
