/** READ-ONLY production inspection — no writes. Run: npx tsx scripts/check-prod.ts */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_URL;
if (!url || url.startsWith('file:')) {
	console.error('TURSO_URL not set to a remote DB; aborting.');
	process.exit(1);
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const cols = await client.execute('PRAGMA table_info(ingredients)');
const hasMaayan = cols.rows.some((r: any) => r.name === 'is_maayan');
const ingCount = (await client.execute('SELECT COUNT(*) c FROM ingredients')).rows[0].c;
const noAisle = await client.execute(
	"SELECT COALESCE(name_he, name) n FROM ingredients WHERE aisle_category_id IS NULL ORDER BY n"
);
const recipes = (await client.execute('SELECT COUNT(*) c FROM recipes')).rows[0].c;
const aisles = (await client.execute('SELECT COUNT(*) c FROM aisle_categories')).rows[0].c;

const maayan = (await client.execute('SELECT COUNT(*) c FROM ingredients WHERE is_maayan=1')).rows[0].c;
const top = (await client.execute('SELECT COUNT(*) c FROM ingredients WHERE maayan_top=1')).rows[0].c;
const dups = await client.execute(
	'SELECT name_he, COUNT(*) c FROM ingredients GROUP BY name_he HAVING c>1'
);

console.log('prod host        :', url.replace(/(libsql:\/\/[^.]*).*/, '$1...'));
console.log('ingredients      :', ingCount);
console.log('recipes          :', recipes);
console.log('aisle_categories :', aisles);
console.log('has is_maayan col:', hasMaayan);
console.log('Maayan (purple)  :', maayan);
console.log('extra-recommended:', top);
console.log(`ingredients w/o aisle: ${noAisle.rows.length}`);
if (noAisle.rows.length) console.log('  ' + noAisle.rows.map((r: any) => r.n).join(', '));
console.log(`duplicate name_he groups: ${dups.rows.length}`);
if (dups.rows.length) console.log('  ' + dups.rows.map((r: any) => `${r.name_he}×${r.c}`).join(', '));
process.exit(0);
