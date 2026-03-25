/**
 * One-time migration: scan existing recipeIngredients for variant patterns
 * and create proper ingredientVariants + recipeIngredientVariants records.
 *
 * Run: npx tsx scripts/migrate-variants.ts
 *
 * Patterns detected:
 * - Parenthetical: "אורז (יסמין) (פרסי או בסמטי)"
 * - Slash: "עדשים ירוקות/חומות"
 * - "או" / "or": "שמן זית או קנולה"
 */

import { db } from '../src/lib/server/db';
import { recipeIngredients, ingredients } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { findOrCreateVariant, setRecipeIngredientVariants } from '../src/lib/server/ingredients/variants';

const OR_PATTERNS = /\s+או\s+|\s+or\s+/i;
const SLASH_PATTERN = /\//;
const PAREN_PATTERN = /\(([^)]+)\)/g;

async function main() {
	const allIngs = await db
		.select({
			id: recipeIngredients.id,
			ingredientId: recipeIngredients.ingredientId,
			originalText: recipeIngredients.originalText,
			preparation: recipeIngredients.preparation
		})
		.from(recipeIngredients);

	let migrated = 0;

	for (const ri of allIngs) {
		if (!ri.ingredientId) continue;
		const text = ri.originalText || ri.preparation || '';
		const variants: string[] = [];

		// Check for parenthetical alternatives
		const parens = [...text.matchAll(PAREN_PATTERN)].map((m) => m[1]);
		for (const p of parens) {
			if (OR_PATTERNS.test(p)) {
				variants.push(...p.split(OR_PATTERNS).map((s) => s.trim()).filter(Boolean));
			} else if (SLASH_PATTERN.test(p)) {
				variants.push(...p.split('/').map((s) => s.trim()).filter(Boolean));
			} else {
				variants.push(p.trim());
			}
		}

		// Check preparation field for "או" pattern
		if (ri.preparation && OR_PATTERNS.test(ri.preparation)) {
			const parts = ri.preparation.split(OR_PATTERNS).map((s) => s.trim()).filter(Boolean);
			if (parts.length > 1) variants.push(...parts);
		}

		if (variants.length === 0) continue;

		// Get ingredient info for naming
		const ing = await db.select().from(ingredients).where(eq(ingredients.id, ri.ingredientId)).limit(1);
		if (ing.length === 0) continue;

		const variantIds: string[] = [];
		for (const v of variants) {
			const fullName = `${ing[0].nameHe || ing[0].name} ${v}`.toLowerCase().trim();
			const vid = await findOrCreateVariant(ri.ingredientId, fullName, `${ing[0].nameHe || ''} ${v}`.trim() || undefined);
			variantIds.push(vid);
		}

		await setRecipeIngredientVariants(ri.id, variantIds);
		migrated++;
		console.log(`Migrated: "${ri.originalText}" → ${variants.length} variants`);
	}

	console.log(`\nDone. Migrated ${migrated} ingredients with variants.`);
}

main().catch(console.error);
