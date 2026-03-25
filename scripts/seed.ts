import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '../src/lib/server/db/schema';
import { seed } from '../src/lib/server/db/seed';

const client = createClient({
	url: process.env.TURSO_URL || 'file:local.db',
	authToken: process.env.TURSO_AUTH_TOKEN
});

const db = drizzle(client, { schema });

async function main() {
	console.log('Seeding database...');
	try {
		await seed(db);

		// Verify data was inserted
		const count = await db.select().from(schema.aisleCategories);
		console.log(`Inserted ${count.length} aisle categories`);

		const users = await db.select().from(schema.users);
		console.log(`Inserted ${users.length} users`);

		console.log('Done!');
	} catch (error) {
		console.error('Seed error:', error);
		throw error;
	}
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
