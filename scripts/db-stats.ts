/**
 * Read-only DB inspector. Prints row counts + duplicate-risk signals.
 * Targets whatever TURSO_URL points at (prod) unless DB_URL overrides it.
 *
 * Run: npx tsx scripts/db-stats.ts
 *      DB_URL=file:local.db npx tsx scripts/db-stats.ts
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.DB_URL || process.env.TURSO_URL || 'file:local.db';
const authToken = process.env.DB_URL ? undefined : process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

const TABLES = [
	'users', 'recipes', 'recipe_ingredients', 'ingredients', 'ingredient_variants',
	'recipe_ingredient_variants', 'pantry_items', 'shopping_lists',
	'shopping_list_items', 'shopping_list_recipes', 'aisle_categories'
];

async function count(t: string): Promise<string> {
	try {
		const r = await client.execute(`SELECT COUNT(*) AS c FROM ${t}`);
		return String(r.rows[0].c);
	} catch (e) {
		return `(missing: ${(e as Error).message.slice(0, 40)})`;
	}
}

async function scalar(sql: string): Promise<string> {
	try {
		const r = await client.execute(sql);
		return String(r.rows[0]?.[r.columns[0]] ?? '0');
	} catch (e) {
		return `(err)`;
	}
}

async function main() {
	console.log(`\nTarget: ${url.replace(/(libsql:\/\/[^.]{0,10}).*/, '$1…')}\n`);
	for (const t of TABLES) console.log(`${t.padEnd(28)} ${await count(t)}`);
	console.log('\n── duplicate-risk signals ──');
	console.log('ingredients w/ Hebrew in name :', await scalar(`SELECT COUNT(*) FROM ingredients WHERE name GLOB '*[א-ת]*'`));
	console.log('ingredients w/ NULL name_he   :', await scalar(`SELECT COUNT(*) FROM ingredients WHERE name_he IS NULL`));
	console.log('distinct name_he values       :', await scalar(`SELECT COUNT(DISTINCT name_he) FROM ingredients`));
	console.log('ingredients w/ dup name_he    :', await scalar(`SELECT COUNT(*) FROM (SELECT name_he FROM ingredients WHERE name_he IS NOT NULL GROUP BY name_he HAVING COUNT(*)>1)`));
	const sample = await client.execute(`SELECT name, name_he FROM ingredients ORDER BY name_he LIMIT 40`);
	console.log('\n── sample ingredients ──');
	for (const row of sample.rows) console.log(`  ${String(row.name ?? '∅').padEnd(24)} | ${row.name_he ?? '∅'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
