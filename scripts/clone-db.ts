/**
 * Read-only clone of one libsql DB into another (default: prod -> file:./dev.db).
 * Copies schema (tables + indexes + the drizzle migrations journal) and all rows,
 * so drizzle-kit treats the clone as already-migrated up to the same point.
 *
 * Source = TURSO_URL/TURSO_AUTH_TOKEN (prod) unless SRC_URL given.
 * Dest   = DEST_URL (default file:./dev.db). Delete the dest file first for a fresh clone.
 *
 * Run: rm -f dev.db && npx tsx scripts/clone-db.ts
 */
import 'dotenv/config';
import { createClient, type Client } from '@libsql/client';

const srcUrl = process.env.SRC_URL || process.env.TURSO_URL || 'file:local.db';
const srcToken = process.env.SRC_TOKEN ?? (process.env.SRC_URL ? undefined : process.env.TURSO_AUTH_TOKEN);
const destUrl = process.env.DEST_URL || 'file:./dev.db';

const src = createClient({ url: srcUrl, authToken: srcToken });
const dest = createClient({ url: destUrl });

async function objects(type: string) {
	const r = await src.execute(
		`SELECT name, sql FROM sqlite_master WHERE type='${type}' AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
	);
	return r.rows.map((row) => ({ name: String(row.name), sql: String(row.sql) }));
}

async function copyTable(name: string) {
	const data = await src.execute(`SELECT * FROM "${name}"`);
	if (data.rows.length === 0) return 0;
	const cols = data.columns;
	const placeholders = cols.map(() => '?').join(', ');
	const colList = cols.map((c) => `"${c}"`).join(', ');
	const stmts = data.rows.map((row) => ({
		sql: `INSERT INTO "${name}" (${colList}) VALUES (${placeholders})`,
		args: cols.map((c) => (row as any)[c] ?? null)
	}));
	await dest.batch(stmts, 'write');
	return data.rows.length;
}

async function main() {
	console.log(`Cloning\n  from ${srcUrl.replace(/(libsql:\/\/[^.]{0,10}).*/, '$1…')}\n  into ${destUrl}\n`);
	await dest.execute('PRAGMA foreign_keys = OFF');

	const tables = await objects('table');
	for (const t of tables) await dest.execute(t.sql);
	console.log(`Created ${tables.length} tables`);

	let total = 0;
	for (const t of tables) {
		const n = await copyTable(t.name);
		total += n;
		console.log(`  ${t.name.padEnd(28)} ${n} rows`);
	}

	const indexes = await objects('index');
	for (const i of indexes) {
		try { await dest.execute(i.sql); } catch { /* unique already satisfied or dup */ }
	}
	console.log(`Created ${indexes.length} indexes; copied ${total} rows total.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
