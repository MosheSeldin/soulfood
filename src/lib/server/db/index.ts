import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Use process.env directly (works in both SvelteKit and CLI contexts)
const client = createClient({
	url: process.env.TURSO_URL || 'file:local.db',
	authToken: process.env.TURSO_AUTH_TOKEN
});

export const db = drizzle(client, { schema });

/** The root database handle type. */
export type DB = typeof db;
/** The transaction handle passed into db.transaction(async (tx) => …). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
/** Anything that can run queries — the root db or an open transaction. */
export type Executor = DB | Tx;
