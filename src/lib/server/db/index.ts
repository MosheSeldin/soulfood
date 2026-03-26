import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Use process.env directly (works in both SvelteKit and CLI contexts)
const client = createClient({
	url: process.env.TURSO_URL || 'file:local.db',
	authToken: process.env.TURSO_AUTH_TOKEN
});

export const db = drizzle(client, { schema });
