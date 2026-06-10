/**
 * Foundation migration (idempotent). Brings an existing DB to the dedup-proof
 * schema and CLEANS existing data in one pass:
 *   1. relax ingredients.name (drop NOT NULL/UNIQUE) + add name_key
 *   2. add name_key to variants; add timestamps/version; add password_salt
 *   3. backfill canonical name/name_he/name_key (Hebrew out of the English slot)
 *   4. merge duplicate ingredients + variants; dedupe pantry & list items
 *   5. create the new UNIQUE indexes
 *
 * Shares canonicalize()/keyForString() with the live resolver so the data ends
 * up keyed exactly the way new inserts will be.
 *
 * Test:  DB_URL=file:dev.db npx tsx scripts/migrate-foundation.ts
 * Prod:  npx tsx scripts/migrate-foundation.ts        (uses TURSO_URL)
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { canonicalize, keyForString, computeVariantKey } from '../src/lib/server/ingredients/classifier';

const url = process.env.DB_URL || process.env.TURSO_URL || 'file:local.db';
const authToken = process.env.DB_URL ? undefined : process.env.TURSO_AUTH_TOKEN;
const c = createClient({ url, authToken });

const log = (...a: unknown[]) => console.log(...a);
const all = async (sql: string, args: unknown[] = []) => (await c.execute({ sql, args: args as never[] })).rows as Record<string, unknown>[];
const run = async (sql: string, args: unknown[] = []) => c.execute({ sql, args: args as never[] });

async function hasColumn(table: string, col: string): Promise<boolean> {
	const rows = await all(`PRAGMA table_info("${table}")`);
	return rows.some((r) => r.name === col);
}
async function addColumn(table: string, col: string, type: string) {
	if (!(await hasColumn(table, col))) {
		await run(`ALTER TABLE "${table}" ADD COLUMN ${col} ${type}`);
		log(`+ ${table}.${col}`);
	}
}

/** Rebuild ingredients so `name` is nullable + un-unique and name_key exists. */
async function relaxIngredientsTable() {
	const cols = await all(`PRAGMA table_info("ingredients")`);
	const nameCol = cols.find((r) => r.name === 'name');
	const hasKey = cols.some((r) => r.name === 'name_key');
	// Already relaxed if name is nullable AND name_key exists.
	if (nameCol && Number(nameCol.notnull) === 0 && hasKey) {
		log('ingredients table already relaxed');
		return;
	}
	log('rebuilding ingredients table (relax name, add name_key)…');
	await run('PRAGMA foreign_keys = OFF');
	await run(`CREATE TABLE ingredients_new (
		id text PRIMARY KEY NOT NULL,
		name text,
		name_he text,
		name_key text,
		aisle_category_id text REFERENCES aisle_categories(id),
		default_unit text
	)`);
	const keySelect = hasKey ? 'name_key' : 'NULL';
	await run(`INSERT INTO ingredients_new (id, name, name_he, name_key, aisle_category_id, default_unit)
		SELECT id, name, name_he, ${keySelect}, aisle_category_id, default_unit FROM ingredients`);
	await run('DROP TABLE ingredients');
	await run('ALTER TABLE ingredients_new RENAME TO ingredients');
}

async function backfillIngredients() {
	const rows = await all('SELECT id, name, name_he FROM ingredients');
	for (const r of rows) {
		const can = canonicalize(r.name as string | null, r.name_he as string | null);
		// canonicalize returns BASE fields; for a plain ingredient row that equals
		// the whole name, base === the cleaned name. Preserve original full names
		// but ensure Hebrew never sits in `name` and name_key is set.
		const name = r.name && /[א-ת]/.test(String(r.name)) ? null : (r.name as string | null);
		const nameHe = (r.name_he as string | null) || (r.name && /[א-ת]/.test(String(r.name)) ? (r.name as string) : null);
		await run('UPDATE ingredients SET name = ?, name_he = ?, name_key = ? WHERE id = ?', [
			name,
			nameHe,
			can.nameKey || keyForString(String(nameHe || name || r.id)),
			r.id
		]);
	}
	log(`backfilled name_key on ${rows.length} ingredients`);
}

async function backfillVariants() {
	if (!(await hasColumn('ingredient_variants', 'name_key'))) return;
	const rows = await all('SELECT id, name, name_he FROM ingredient_variants');
	for (const r of rows) {
		const key = computeVariantKey((r.name as string) || null, (r.name_he as string) || null) || keyForString(String(r.name || r.id));
		await run('UPDATE ingredient_variants SET name_key = ? WHERE id = ?', [key, r.id]);
	}
	log(`backfilled name_key on ${rows.length} variants`);
}

async function usageCounts(): Promise<Map<string, number>> {
	const rows = await all(`SELECT ingredient_id AS id, COUNT(*) AS n FROM recipe_ingredients WHERE ingredient_id IS NOT NULL GROUP BY ingredient_id`);
	return new Map(rows.map((r) => [String(r.id), Number(r.n)]));
}

async function mergeDuplicateIngredients() {
	const rows = await all('SELECT id, name, name_he, name_key FROM ingredients');
	const groups = new Map<string, Record<string, unknown>[]>();
	for (const r of rows) {
		const k = String(r.name_key || `__null__${r.id}`);
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push(r);
	}
	const usage = await usageCounts();
	let merged = 0;
	for (const [, members] of groups) {
		if (members.length < 2) continue;
		const sorted = [...members].sort((a, b) => {
			const aBoth = a.name && a.name_he ? 1 : 0;
			const bBoth = b.name && b.name_he ? 1 : 0;
			if (aBoth !== bBoth) return bBoth - aBoth;
			return (usage.get(String(b.id)) || 0) - (usage.get(String(a.id)) || 0);
		});
		const canon = sorted[0];
		for (const dup of sorted.slice(1)) {
			await run('UPDATE recipe_ingredients SET ingredient_id = ? WHERE ingredient_id = ?', [canon.id, dup.id]);
			await run('UPDATE ingredient_variants SET ingredient_id = ? WHERE ingredient_id = ?', [canon.id, dup.id]);
			await run('UPDATE pantry_items SET ingredient_id = ? WHERE ingredient_id = ?', [canon.id, dup.id]);
			await run('UPDATE shopping_list_items SET ingredient_id = ? WHERE ingredient_id = ?', [canon.id, dup.id]);
			// absorb names
			await run('UPDATE ingredients SET name = COALESCE(name, ?), name_he = COALESCE(name_he, ?) WHERE id = ?', [dup.name, dup.name_he, canon.id]);
			await run('DELETE FROM ingredients WHERE id = ?', [dup.id]);
			merged++;
		}
	}
	log(`merged ${merged} duplicate ingredient rows`);
}

async function dedupeVariants() {
	const rows = await all('SELECT id, ingredient_id, name_key FROM ingredient_variants');
	const groups = new Map<string, Record<string, unknown>[]>();
	for (const r of rows) {
		const k = `${r.ingredient_id}|${r.name_key || r.id}`;
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push(r);
	}
	let removed = 0;
	for (const [, members] of groups) {
		if (members.length < 2) continue;
		const survivor = members[0];
		for (const dup of members.slice(1)) {
			await run('UPDATE recipe_ingredient_variants SET variant_id = ? WHERE variant_id = ?', [survivor.id, dup.id]);
			await run('UPDATE shopping_list_items SET chosen_variant_id = ? WHERE chosen_variant_id = ?', [survivor.id, dup.id]);
			await run('DELETE FROM ingredient_variants WHERE id = ?', [dup.id]);
			removed++;
		}
	}
	log(`removed ${removed} duplicate variants`);
}

async function dedupePantry() {
	const rows = await all('SELECT id, ingredient_id FROM pantry_items ORDER BY updated_at DESC');
	const seen = new Set<string>();
	let removed = 0;
	for (const r of rows) {
		const k = String(r.ingredient_id);
		if (seen.has(k)) { await run('DELETE FROM pantry_items WHERE id = ?', [r.id]); removed++; }
		else seen.add(k);
	}
	log(`removed ${removed} duplicate pantry rows`);
}

async function dedupeListItems() {
	const rows = await all('SELECT id, shopping_list_id, ingredient_id, chosen_variant_id, quantity FROM shopping_list_items');
	const byKey = new Map<string, Record<string, unknown>>();
	let removed = 0;
	for (const r of rows) {
		if (!r.ingredient_id) continue; // free-text items never dedupe
		const k = `${r.shopping_list_id}|${r.ingredient_id}|${r.chosen_variant_id ?? ''}`;
		const keep = byKey.get(k);
		if (!keep) { byKey.set(k, r); continue; }
		const sum = (Number(keep.quantity) || 0) + (Number(r.quantity) || 0);
		await run('UPDATE shopping_list_items SET quantity = ? WHERE id = ?', [sum || null, keep.id]);
		await run('DELETE FROM shopping_list_items WHERE id = ?', [r.id]);
		removed++;
	}
	log(`merged ${removed} duplicate list items`);
}

async function createIndexes() {
	const stmts = [
		`CREATE UNIQUE INDEX IF NOT EXISTS ingredients_name_key_unique ON ingredients(name_key)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS ingredient_variants_ing_key_unique ON ingredient_variants(ingredient_id, name_key)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS pantry_items_ingredient_unique ON pantry_items(ingredient_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS sli_list_ing_variant_unique ON shopping_list_items(shopping_list_id, ingredient_id, chosen_variant_id)`
	];
	for (const s of stmts) {
		try { await run(s); log(`index ✓ ${s.match(/INDEX IF NOT EXISTS (\w+)/)![1]}`); }
		catch (e) { log(`index ✗ ${(e as Error).message}`); }
	}
}

async function main() {
	log(`\nMigrating ${url.replace(/(libsql:\/\/[^.]{0,10}).*/, '$1…')}\n`);

	await relaxIngredientsTable();
	await addColumn('ingredient_variants', 'name_key', 'TEXT');
	await addColumn('shopping_list_items', 'updated_at', 'INTEGER');
	await addColumn('shopping_lists', 'updated_at', 'INTEGER');
	await addColumn('shopping_lists', 'version', 'INTEGER DEFAULT 0');
	await addColumn('users', 'password_salt', 'TEXT');

	await backfillIngredients();
	await backfillVariants();
	await mergeDuplicateIngredients();
	await dedupeVariants();
	await dedupePantry();
	await dedupeListItems();
	await createIndexes();

	await run(`UPDATE shopping_list_items SET updated_at = unixepoch() WHERE updated_at IS NULL`);
	await run(`UPDATE shopping_lists SET updated_at = unixepoch() WHERE updated_at IS NULL`);
	await run(`UPDATE shopping_lists SET version = 0 WHERE version IS NULL`);

	log('\n✅ foundation migration complete\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
