/**
 * One-shot, idempotent update for two features:
 *
 *  1. Split the single "produce" aisle (ירקות ופירות) into two separate aisles:
 *       • vegetables (ירקות)  — sort 1
 *       • fruits     (פירות)  — sort 2
 *     Every other aisle shifts down one slot. Existing ingredients + any open
 *     shopping-list rows are re-pointed to the correct new aisle. The old
 *     "produce" aisle is dropped once empty.
 *
 *  2. Add the `is_template` column to shopping_lists (for saved/custom lists
 *     like "קלאסי"). Existing rows default to 0 (the live shopping list).
 *
 * Safe to run multiple times. Targets the LOCAL dev DB by default; pass --prod
 * to apply against the Turso production DB from .env (TURSO_URL).
 *   npx tsx scripts/split-produce-and-add-lists.ts          # → local.db
 *   npx tsx scripts/split-produce-and-add-lists.ts --prod   # → Turso (prod)
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const useProd = process.argv.includes('--prod');
const url = useProd ? process.env.TURSO_URL : 'file:local.db';
if (useProd && (!url || url.startsWith('file:'))) {
	console.error('--prod given but TURSO_URL is not a remote DB; aborting.');
	process.exit(1);
}
console.log(`Target: ${useProd ? 'PROD (' + url + ')' : 'local.db'}\n`);
const client = createClient({
	url: url || 'file:local.db',
	authToken: useProd ? process.env.TURSO_AUTH_TOKEN : undefined
});

// The fruit names (Hebrew, as stored) that belong in the new "fruits" aisle.
// Everything else currently in "produce" becomes a vegetable.
const FRUITS = [
	'אבוקדו', 'אבטיח', 'אגס', 'אוכמניות', 'אנונה', 'אפרסק', 'דובדבן', 'לימון',
	'נקטרינה', 'ענבים', 'פטל', 'רימון', 'שזיף', 'שסק', 'תאנה', 'תות עץ', 'תמר', 'תפוח עץ'
];

// Canonical sort order after the split (absolute values → idempotent).
const SORT_ORDER: Record<string, number> = {
	vegetables: 1, fruits: 2, dairy: 3, meat: 4, bakery: 5, grains: 6,
	legumes: 7, nuts: 8, canned: 9, spices: 10, oils: 11, frozen: 12,
	beverages: 13, snacks: 14, household: 15, other: 99
};

async function run(sql: string, args: unknown[] = [], label = sql) {
	try {
		const r = await client.execute({ sql, args: args as never });
		console.log('ok  :', label, r.rowsAffected !== undefined ? `(${r.rowsAffected} rows)` : '');
	} catch (e) {
		console.log('skip:', label, '—', String((e as Error).message || e));
	}
}

// 1. is_template column on shopping_lists ────────────────────────────────────
await run(
	'ALTER TABLE shopping_lists ADD COLUMN is_template integer NOT NULL DEFAULT 0',
	[],
	'add shopping_lists.is_template'
);

// 2. Create the two new aisles ────────────────────────────────────────────────
await run(
	`INSERT OR IGNORE INTO aisle_categories (id, name, name_he, sort_order, icon)
	 VALUES ('vegetables', 'Vegetables', 'ירקות', 1, 'carrot')`,
	[],
	"insert aisle 'vegetables'"
);
await run(
	`INSERT OR IGNORE INTO aisle_categories (id, name, name_he, sort_order, icon)
	 VALUES ('fruits', 'Fruits', 'פירות', 2, 'apple')`,
	[],
	"insert aisle 'fruits'"
);

// 3. Renumber every known aisle to its canonical slot ─────────────────────────
for (const [id, order] of Object.entries(SORT_ORDER)) {
	await run('UPDATE aisle_categories SET sort_order = ? WHERE id = ?', [order, id], `sort ${id}=${order}`);
}

// 4. Move fruits out of produce/vegetables into the fruits aisle ──────────────
const placeholders = FRUITS.map(() => '?').join(', ');
await run(
	`UPDATE ingredients SET aisle_category_id = 'fruits'
	 WHERE aisle_category_id IN ('produce', 'vegetables') AND name_he IN (${placeholders})`,
	FRUITS,
	'reassign fruit ingredients → fruits'
);

// 5. Everything still in produce becomes a vegetable ──────────────────────────
await run(
	"UPDATE ingredients SET aisle_category_id = 'vegetables' WHERE aisle_category_id = 'produce'",
	[],
	'reassign remaining produce ingredients → vegetables'
);

// 6. Re-point open shopping-list rows that still say "produce" ─────────────────
await run(
	`UPDATE shopping_list_items
	 SET aisle_category_id = (SELECT aisle_category_id FROM ingredients WHERE ingredients.id = shopping_list_items.ingredient_id)
	 WHERE aisle_category_id = 'produce' AND ingredient_id IS NOT NULL`,
	[],
	'reassign shopping items (by ingredient)'
);
await run(
	"UPDATE shopping_list_items SET aisle_category_id = 'vegetables' WHERE aisle_category_id = 'produce'",
	[],
	'reassign leftover free-text shopping items → vegetables'
);

// 7. Drop the now-empty produce aisle ─────────────────────────────────────────
await run(
	`DELETE FROM aisle_categories
	 WHERE id = 'produce'
	   AND NOT EXISTS (SELECT 1 FROM ingredients WHERE aisle_category_id = 'produce')
	   AND NOT EXISTS (SELECT 1 FROM shopping_list_items WHERE aisle_category_id = 'produce')`,
	[],
	"drop old 'produce' aisle"
);

// Report ──────────────────────────────────────────────────────────────────────
const summary = await client.execute(
	`SELECT a.name_he, a.sort_order, COUNT(i.id) AS n
	 FROM aisle_categories a LEFT JOIN ingredients i ON i.aisle_category_id = a.id
	 GROUP BY a.id ORDER BY a.sort_order`
);
console.log('\nAisles now:');
for (const row of summary.rows) console.log(`  ${row.sort_order}\t${row.name_he}\t${row.n} מצרכים`);

process.exit(0);
