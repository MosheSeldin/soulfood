/**
 * Add the Maayan flag columns to PROD (Turso). Idempotent — skips if already present.
 * Mirrors drizzle/0002_maayan_food_flags.sql for the push-managed prod DB.
 * Run: npx tsx scripts/add-maayan-columns-prod.ts
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_URL;
if (!url || url.startsWith('file:')) {
	console.error('TURSO_URL not set to a remote DB; aborting.');
	process.exit(1);
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const stmts = [
	'ALTER TABLE ingredients ADD COLUMN is_maayan integer NOT NULL DEFAULT 0',
	'ALTER TABLE ingredients ADD COLUMN maayan_top integer NOT NULL DEFAULT 0'
];
for (const sql of stmts) {
	try {
		await client.execute(sql);
		console.log('ok  :', sql);
	} catch (e) {
		console.log('skip:', sql, '—', String((e as Error).message || e));
	}
}
process.exit(0);
