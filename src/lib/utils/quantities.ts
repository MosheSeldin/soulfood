/** Unit conversion and ingredient quantity aggregation */

interface QuantityItem {
	ingredientId: string | null;
	name: string;
	nameHe: string | null;
	quantity: number | null;
	unit: string | null;
	aisleCategoryId: string | null;
	chosenVariantId?: string | null;
}

export interface AggregatedItem {
	ingredientId: string | null;
	name: string;
	nameHe: string | null;
	quantity: number | null;
	unit: string | null;
	aisleCategoryId: string | null;
	sourceRecipeIds: string[];
	chosenVariantId?: string | null;
}

// Conversion factors to a base unit within each family
const VOLUME_TO_ML: Record<string, number> = {
	tsp: 5,
	tbsp: 15,
	cup: 237,
	ml: 1,
	l: 1000
};

const WEIGHT_TO_G: Record<string, number> = {
	g: 1,
	kg: 1000,
	oz: 28.35,
	lb: 453.59
};

function getConversionFamily(unit: string): 'volume' | 'weight' | null {
	if (unit in VOLUME_TO_ML) return 'volume';
	if (unit in WEIGHT_TO_G) return 'weight';
	return null;
}

function convertToBase(quantity: number, unit: string): { value: number; family: 'volume' | 'weight' } | null {
	if (unit in VOLUME_TO_ML) return { value: quantity * VOLUME_TO_ML[unit], family: 'volume' };
	if (unit in WEIGHT_TO_G) return { value: quantity * WEIGHT_TO_G[unit], family: 'weight' };
	return null;
}

function chooseBestUnit(baseValue: number, family: 'volume' | 'weight'): { quantity: number; unit: string } {
	if (family === 'volume') {
		if (baseValue >= 1000) return { quantity: baseValue / 1000, unit: 'l' };
		if (baseValue >= 237) return { quantity: baseValue / 237, unit: 'cup' };
		if (baseValue >= 15) return { quantity: baseValue / 15, unit: 'tbsp' };
		return { quantity: baseValue / 5, unit: 'tsp' };
	} else {
		if (baseValue >= 1000) return { quantity: baseValue / 1000, unit: 'kg' };
		return { quantity: baseValue, unit: 'g' };
	}
}

/** Aggregate a list of ingredient quantities, combining same ingredients */
export function aggregateIngredients(
	items: (QuantityItem & { recipeId: string })[]
): AggregatedItem[] {
	const grouped = new Map<string, (QuantityItem & { recipeId: string })[]>();

	for (const item of items) {
		// Group by ingredientId + chosenVariantId so different variants stay separate
		const baseKey = item.ingredientId || `custom:${item.name.toLowerCase()}`;
		const variantSuffix = item.chosenVariantId ? `:v:${item.chosenVariantId}` : '';
		const key = baseKey + variantSuffix;
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key)!.push(item);
	}

	const result: AggregatedItem[] = [];

	for (const [, group] of grouped) {
		const first = group[0];
		const recipeIds = [...new Set(group.map((g) => g.recipeId))];

		// If no quantities, just list once
		if (group.every((g) => g.quantity === null)) {
			result.push({
				ingredientId: first.ingredientId,
				name: first.name,
				nameHe: first.nameHe,
				quantity: null,
				unit: null,
				aisleCategoryId: first.aisleCategoryId,
				sourceRecipeIds: recipeIds,
				chosenVariantId: first.chosenVariantId
			});
			continue;
		}

		// Try to aggregate by converting to common base
		const sameUnit = group.every((g) => g.unit === first.unit);
		if (sameUnit && first.unit) {
			const total = group.reduce((sum, g) => sum + (g.quantity || 0), 0);
			result.push({
				ingredientId: first.ingredientId,
				name: first.name,
				nameHe: first.nameHe,
				quantity: roundNice(total),
				unit: first.unit,
				aisleCategoryId: first.aisleCategoryId,
				sourceRecipeIds: recipeIds,
				chosenVariantId: first.chosenVariantId
			});
			continue;
		}

		// Try to convert to common family
		const families = group
			.filter((g) => g.unit && g.quantity)
			.map((g) => getConversionFamily(g.unit!));

		if (families.length > 0 && families.every((f) => f === families[0]) && families[0]) {
			let baseTotal = 0;
			const family = families[0];
			for (const g of group) {
				if (g.quantity && g.unit) {
					const converted = convertToBase(g.quantity, g.unit);
					if (converted) baseTotal += converted.value;
				}
			}
			const best = chooseBestUnit(baseTotal, family);
			result.push({
				ingredientId: first.ingredientId,
				name: first.name,
				nameHe: first.nameHe,
				quantity: roundNice(best.quantity),
				unit: best.unit,
				aisleCategoryId: first.aisleCategoryId,
				sourceRecipeIds: recipeIds,
				chosenVariantId: first.chosenVariantId
			});
			continue;
		}

		// Incompatible units: keep separate entries
		for (const g of group) {
			result.push({
				ingredientId: g.ingredientId,
				name: g.name,
				nameHe: g.nameHe,
				quantity: g.quantity,
				unit: g.unit,
				aisleCategoryId: g.aisleCategoryId,
				sourceRecipeIds: [g.recipeId],
				chosenVariantId: g.chosenVariantId
			});
		}
	}

	return result;
}

function roundNice(n: number): number {
	if (n === Math.floor(n)) return n;
	// Round to nearest quarter
	const rounded = Math.round(n * 4) / 4;
	return rounded;
}

export interface NetResult {
	/** Remaining quantity to buy in `unit` (null = need some, amount unknown). */
	quantity: number | null;
	unit: string | null;
	/** True when the pantry already covers the need → drop from the list. */
	covered: boolean;
}

/**
 * Subtract what's on-hand (pantry) from what a recipe needs.
 * - Pantry amount unknown (qty null) → assume enough → covered.
 * - Need amount unknown → can't subtract → keep need as-is.
 * - Same unit or convertible family → real subtraction.
 * - Incompatible units → can't subtract → keep need as-is.
 */
export function subtractOnHand(
	need: { quantity: number | null; unit: string | null },
	have: { quantity: number | null; unit: string | null }
): NetResult {
	if (have.quantity == null) return { quantity: need.quantity, unit: need.unit, covered: true };
	if (need.quantity == null) return { quantity: null, unit: need.unit, covered: false };

	let haveInNeedUnit: number | null = null;
	if (need.unit === have.unit) {
		haveInNeedUnit = have.quantity;
	} else if (need.unit && have.unit) {
		const needBase = convertToBase(need.quantity, need.unit);
		const haveBase = convertToBase(have.quantity, have.unit);
		if (needBase && haveBase && needBase.family === haveBase.family) {
			// express have in need's unit via base ratio
			const oneNeedUnit = convertToBase(1, need.unit);
			if (oneNeedUnit) haveInNeedUnit = haveBase.value / oneNeedUnit.value;
		}
	}

	if (haveInNeedUnit == null) {
		// units incompatible — leave the full need on the list
		return { quantity: need.quantity, unit: need.unit, covered: false };
	}

	const remaining = need.quantity - haveInNeedUnit;
	if (remaining <= 0.0001) return { quantity: 0, unit: need.unit, covered: true };
	return { quantity: roundNice(remaining), unit: need.unit, covered: false };
}

/** Add two possibly-null quantities (null acts as 0 unless both null → null). */
export function sumNullable(a: number | null, b: number | null): number | null {
	if (a == null && b == null) return null;
	return (a || 0) + (b || 0);
}
