import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { aisleCategories, users } from './schema';
import type * as schema from './schema';

const AISLE_DATA = [
	{ id: 'produce', name: 'Produce', nameHe: 'ירקות ופירות', sortOrder: 1, icon: 'apple' },
	{ id: 'dairy', name: 'Dairy', nameHe: 'מוצרי חלב', sortOrder: 2, icon: 'milk' },
	{ id: 'meat', name: 'Meat & Fish', nameHe: 'בשר ודגים', sortOrder: 3, icon: 'beef' },
	{ id: 'bakery', name: 'Bakery', nameHe: 'מאפייה ולחם', sortOrder: 4, icon: 'croissant' },
	{ id: 'grains', name: 'Grains & Pasta', nameHe: 'דגנים ופסטה', sortOrder: 5, icon: 'wheat' },
	{ id: 'canned', name: 'Canned & Jarred', nameHe: 'שימורים', sortOrder: 6, icon: 'package' },
	{
		id: 'spices',
		name: 'Spices & Condiments',
		nameHe: 'תבלינים ורטבים',
		sortOrder: 7,
		icon: 'flame'
	},
	{ id: 'frozen', name: 'Frozen', nameHe: 'קפואים', sortOrder: 8, icon: 'snowflake' },
	{ id: 'beverages', name: 'Beverages', nameHe: 'משקאות', sortOrder: 9, icon: 'cup-soda' },
	{ id: 'snacks', name: 'Snacks', nameHe: 'חטיפים', sortOrder: 10, icon: 'cookie' },
	{ id: 'oils', name: 'Oils & Vinegars', nameHe: 'שמנים וחומץ', sortOrder: 11, icon: 'droplets' },
	{ id: 'household', name: 'Household', nameHe: 'מוצרי בית', sortOrder: 12, icon: 'home' },
	{ id: 'other', name: 'Other', nameHe: 'אחר', sortOrder: 99, icon: 'circle' }
];

export async function seed(db: LibSQLDatabase<typeof schema>) {
	// Seed aisle categories
	for (const aisle of AISLE_DATA) {
		await db
			.insert(aisleCategories)
			.values(aisle)
			.onConflictDoNothing({ target: aisleCategories.id });
	}

	// Create default users (password will be set on first login)
	const defaultUsers = [
		{ id: 'user1', name: 'משה', passwordHash: '' },
		{ id: 'user2', name: 'מעיין', passwordHash: '' }
	];

	for (const user of defaultUsers) {
		await db.insert(users).values(user).onConflictDoNothing({ target: users.id });
	}
}
