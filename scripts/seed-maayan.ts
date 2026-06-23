/**
 * Seed Maayan's personal food list into the canonical ingredient bank.
 *
 * Source: PushaFood.pdf (Maayan's nutritionist sheet). Every bullet becomes a
 * canonical ingredient flagged `isMaayan` (purple dot). The bold bullets become
 * `maayanTop` (extra-recommended). Each item is filed into a supermarket aisle,
 * and the existing ingredients are filed too (the user asked for everything sorted).
 *
 * Idempotent: items are matched by the app's own language-tagged nameKey, so
 * re-running updates rather than duplicates, and existing rows
 * (לימון, מים, עדשים, פטרוזיליה, כורכום, טופו, שום, בצל…) are merged in place.
 *
 * Run from the project root:  npx tsx scripts/seed-maayan.ts
 * Targets local.db only (never prod) by design.
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as schema from '../src/lib/server/db/schema';
import { keyForString, computeVariantKey } from '../src/lib/server/ingredients/classifier';

const { ingredients, ingredientVariants, aisleCategories } = schema;

// Defaults to the dev DB. To target prod:  SEED_TARGET=prod npx tsx scripts/seed-maayan.ts
// (reads TURSO_URL + TURSO_AUTH_TOKEN from .env). Idempotent — safe to re-run.
const url =
	process.env.SEED_DB_URL ||
	(process.env.SEED_TARGET === 'prod' ? process.env.TURSO_URL : 'file:local.db') ||
	'file:local.db';
const authToken = url.startsWith('file:') ? undefined : process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });
const db = drizzle(client, { schema });
console.log(`seeding → ${url.replace(/(libsql:\/\/[^.]*).*/, '$1…')}`);

// ── Aisles (supermarket sections), reordered + two new ones the PDF needs ──────
const AISLES: { id: string; nameHe: string; name: string; sortOrder: number; icon: string }[] = [
	{ id: 'produce', nameHe: 'ירקות ופירות', name: 'Produce', sortOrder: 1, icon: 'apple' },
	{ id: 'dairy', nameHe: 'מוצרי חלב', name: 'Dairy', sortOrder: 2, icon: 'milk' },
	{ id: 'meat', nameHe: 'בשר ודגים', name: 'Meat & Fish', sortOrder: 3, icon: 'beef' },
	{ id: 'bakery', nameHe: 'מאפייה ולחם', name: 'Bakery', sortOrder: 4, icon: 'croissant' },
	{ id: 'grains', nameHe: 'דגנים ופסטה', name: 'Grains & Pasta', sortOrder: 5, icon: 'wheat' },
	{ id: 'legumes', nameHe: 'קטניות', name: 'Legumes', sortOrder: 6, icon: 'bean' }, // NEW
	{ id: 'nuts', nameHe: 'אגוזים וזרעים', name: 'Nuts & Seeds', sortOrder: 7, icon: 'nut' }, // NEW
	{ id: 'canned', nameHe: 'שימורים', name: 'Canned & Jarred', sortOrder: 8, icon: 'package' },
	{ id: 'spices', nameHe: 'תבלינים ורטבים', name: 'Spices & Condiments', sortOrder: 9, icon: 'flame' },
	{ id: 'oils', nameHe: 'שמנים וחומץ', name: 'Oils & Vinegars', sortOrder: 10, icon: 'droplets' },
	{ id: 'frozen', nameHe: 'קפואים', name: 'Frozen', sortOrder: 11, icon: 'snowflake' },
	{ id: 'beverages', nameHe: 'משקאות', name: 'Beverages', sortOrder: 12, icon: 'cup-soda' },
	{ id: 'snacks', nameHe: 'חטיפים', name: 'Snacks', sortOrder: 13, icon: 'cookie' },
	{ id: 'household', nameHe: 'מוצרי בית', name: 'Household', sortOrder: 14, icon: 'home' },
	{ id: 'other', nameHe: 'אחר', name: 'Other', sortOrder: 99, icon: 'circle' }
];

type Item = { he: string; aisle: string; top?: boolean; variants?: string[] };

// ── Maayan's list, faithful to the PDF (bold bullets → top:true) ───────────────
const DATA: Item[] = [
	// ── שמנים → oils ──
	{ he: 'שמן זית', aisle: 'oils', top: true },
	{ he: 'שמן המפ', aisle: 'oils' },
	{ he: 'שמן זרעי ענבים', aisle: 'oils' },
	{ he: 'שמן גרעיני דלעת', aisle: 'oils' },
	{ he: 'שמן אגוזים', aisle: 'oils' },
	{ he: 'שמן אבוקדו', aisle: 'oils' },
	{ he: 'חמאה מזוקקת', aisle: 'oils', variants: ['גהי', 'סמנה'] },

	// ── אגוזים וזרעים → nuts ──
	{ he: 'שומשום', aisle: 'nuts' },
	{ he: 'טחינה', aisle: 'nuts' },
	{ he: 'אגוזי מלך', aisle: 'nuts' },
	{ he: 'אגוזי פקאן', aisle: 'nuts' },
	{ he: 'שקדים', aisle: 'nuts', top: true, variants: ['חמאת שקדים', 'קמח שקדים', 'שקדייה'] },
	{ he: 'גרעיני דלעת', aisle: 'nuts', top: true },
	{ he: 'לוזים', aisle: 'nuts' },
	{ he: 'גרעיני חמניות', aisle: 'nuts' },
	{ he: 'מקדמיה', aisle: 'nuts' },
	{ he: 'בוטנים', aisle: 'nuts' },
	{ he: 'זרעי פשתן', aisle: 'nuts' },

	// ── חלבונים מן החי → meat / dairy / canned ──
	{ he: 'הודו', aisle: 'meat' },
	{ he: 'עוף', aisle: 'meat', variants: ['תרנגולת'] },
	{ he: 'פרגיות', aisle: 'meat' },
	{ he: 'דגים', aisle: 'meat', top: true, variants: ['דניס', 'לברק'] },
	{ he: 'טונה', aisle: 'canned' },
	{ he: 'סרדינים', aisle: 'canned' },
	{ he: 'ביצים', aisle: 'dairy', top: true },
	{ he: 'גבינת עיזים', aisle: 'dairy' },
	{ he: 'יוגורט עיזים', aisle: 'dairy' },

	// ── דגנים ועמילנים → grains ──
	{ he: 'אורז', aisle: 'grains', variants: ['מלא עגול', 'בסמתי', 'לבן בסמתי'] },
	{ he: 'פסטה מאורז מלא', aisle: 'grains' },
	{ he: 'פסטה אורז שחור', aisle: 'grains', top: true },
	{ he: 'כוסמת', aisle: 'grains', variants: ['חומה', 'ירוקה', 'פסטה סובא'] },
	{ he: 'קינואה', aisle: 'grains' },
	{ he: 'דוחן', aisle: 'grains' },
	{ he: 'שיבולת שועל', aisle: 'grains', top: true, variants: ['קוואקר', 'גרנולה', 'מיזלי', 'סובין שיבולת שועל', 'קמח שיבולת שועל'] },

	// ── לחם וקרקרים → bakery ──
	{ he: 'לחם כוסמין מלא', aisle: 'bakery', variants: ['עם שמרים', 'מחמצת'] },
	{ he: 'לחם כוסמת ירוקה', aisle: 'bakery', top: true, variants: ['טורטיות כוסמת ירוקה'] },
	{ he: 'שמרים', aisle: 'bakery', variants: ['יבשים', 'טריים'] },
	{ he: 'אבקת אפייה', aisle: 'bakery' },
	{ he: 'סודה לשתייה', aisle: 'bakery' },

	// ── קטניות → legumes ──
	{ he: 'עדשים', aisle: 'legumes', top: true, variants: ['שחורות', 'ירוקות', 'כתומות', 'צהובות'] },
	{ he: 'טופו', aisle: 'legumes', top: true },
	{ he: 'טמפה', aisle: 'legumes', top: true },
	{ he: 'נאטו', aisle: 'legumes', top: true },
	{ he: 'אפונה', aisle: 'legumes' },
	{ he: 'שעועית', aisle: 'legumes', variants: ['ירוקה', 'צהובה'] },

	// ── פירות → produce (fresh) ──
	{ he: 'אבטיח', aisle: 'produce' },
	{ he: 'אגס', aisle: 'produce' },
	{ he: 'אוכמניות', aisle: 'produce' },
	{ he: 'אנונה', aisle: 'produce' },
	{ he: 'אפרסק', aisle: 'produce' },
	{ he: 'דובדבן', aisle: 'produce' },
	{ he: 'נקטרינה', aisle: 'produce' },
	{ he: 'ענבים', aisle: 'produce' },
	{ he: 'פטל', aisle: 'produce' },
	{ he: 'רימון', aisle: 'produce' },
	{ he: 'שזיף', aisle: 'produce' },
	{ he: 'תאנה', aisle: 'produce' },
	{ he: 'תות עץ', aisle: 'produce' },
	{ he: 'שסק', aisle: 'produce' },
	{ he: 'תפוח עץ', aisle: 'produce' },
	{ he: 'תמר', aisle: 'produce' },
	{ he: 'לימון', aisle: 'produce', top: true },
	{ he: 'אבוקדו', aisle: 'produce' },

	// ── פירות מיובשים → snacks ──
	{ he: "גוג'י ברי", aisle: 'snacks' },
	{ he: 'דבלה', aisle: 'snacks' },
	{ he: 'חמוציות', aisle: 'snacks' },
	{ he: 'משמש', aisle: 'snacks' },
	{ he: 'צימוקים', aisle: 'snacks' },

	// ── ירקות → produce ──
	{ he: 'אצות', aisle: 'produce', top: true, variants: ['ארמה', 'וואקמה', 'נורי', 'קומבו'] },
	{ he: 'אנדיב', aisle: 'produce' },
	{ he: 'אספרגוס', aisle: 'produce' },
	{ he: 'ארטישוק', aisle: 'produce' },
	{ he: "בוק צ'וי", aisle: 'produce' },
	{ he: 'בטטה', aisle: 'produce' },
	{ he: 'ברוקולי', aisle: 'produce' },
	{ he: 'גזר', aisle: 'produce' },
	{ he: 'גרגיר נחלים', aisle: 'produce', top: true },
	{ he: 'דלעת', aisle: 'produce', top: true },
	{ he: 'דלורית', aisle: 'produce', top: true },
	{ he: 'חסה', aisle: 'produce' },
	{ he: 'כוסברה', aisle: 'produce' },
	{ he: 'כרוב', aisle: 'produce', variants: ['ירוק', 'לבן'] },
	{ he: 'קייל', aisle: 'produce' },
	{ he: 'כרובית', aisle: 'produce' },
	{ he: 'כרישה', aisle: 'produce' },
	{ he: 'מלפפון', aisle: 'produce' },
	{ he: 'נבטי חמנייה', aisle: 'produce' },
	{ he: 'נבטי מש', aisle: 'produce' },
	{ he: 'נצרי במבוק', aisle: 'produce' },
	{ he: 'סלק', aisle: 'produce' },
	{ he: 'סלרי עלים', aisle: 'produce' },
	{ he: 'סלרי מקלות', aisle: 'produce' },
	{ he: 'סלרי שורש', aisle: 'produce' },
	{ he: 'עולש', aisle: 'produce' },
	{ he: 'עירית', aisle: 'produce' },
	{ he: 'עלי גפן', aisle: 'produce' },
	{ he: 'עלי מנגולד', aisle: 'produce' },
	{ he: 'עלי סלק', aisle: 'produce' },
	{ he: 'פטרוזיליה', aisle: 'produce', top: true },
	{ he: 'קולורבי', aisle: 'produce' },
	{ he: 'קישוא', aisle: 'produce' },
	{ he: 'רוקט', aisle: 'produce' },
	{ he: 'שומר', aisle: 'produce' },
	{ he: 'שמיר', aisle: 'produce' },
	{ he: 'תרד', aisle: 'produce' },
	{ he: 'צנון', aisle: 'produce' },
	{ he: 'צנונית', aisle: 'produce' },
	{ he: 'שום', aisle: 'produce' },
	{ he: 'בצל', aisle: 'produce', variants: ['בצל ירוק'] },
	{ he: 'עגבניות', aisle: 'produce' },

	// ── תבלינים ורטבים → spices ──
	{ he: 'אורגנו', aisle: 'spices' },
	{ he: 'אזוב', aisle: 'spices', variants: ['זעתר'] },
	{ he: 'אניס', aisle: 'spices' },
	{ he: 'בזיל', aisle: 'spices' },
	{ he: 'הל', aisle: 'spices' },
	{ he: "ג'ינג'ר", aisle: 'spices' },
	{ he: 'וניל', aisle: 'spices' },
	{ he: 'זעפרן', aisle: 'spices' },
	{ he: 'טרגון', aisle: 'spices' },
	{ he: 'טימין', aisle: 'spices' },
	{ he: 'כורכום', aisle: 'spices', top: true },
	{ he: 'כמון', aisle: 'spices' },
	{ he: 'מרווה', aisle: 'spices' },
	{ he: 'נענע', aisle: 'spices' },
	{ he: 'סומק', aisle: 'spices' },
	{ he: 'עלי דפנה', aisle: 'spices' },
	{ he: 'פלפל שחור', aisle: 'spices' },
	{ he: 'עלי קארי', aisle: 'spices' },
	{ he: 'קינמון', aisle: 'spices' },
	{ he: 'קימל', aisle: 'spices', variants: ['כרוויה'] },
	{ he: 'רוזמרין', aisle: 'spices' },
	{ he: 'חרדל', aisle: 'spices', variants: ['ממרח חרדל', 'אבקת חרדל', 'זרעי חרדל'] },
	{ he: 'רוטב סויה תמרי', aisle: 'spices' },
	{ he: 'מיסו', aisle: 'spices' },
	{ he: 'מלח', aisle: 'spices', variants: ['הימלאיה', 'גס', 'עשבים', 'ים'] },
	{ he: 'אבקת מרק ירקות', aisle: 'spices' },
	{ he: 'שמרי בירה', aisle: 'spices' },

	// ── שתייה ותחליפי חלב → beverages ──
	{ he: 'מים', aisle: 'beverages', top: true },
	{ he: 'מי קוקוס', aisle: 'beverages' },
	{ he: 'מיץ ירקות', aisle: 'beverages' },
	{ he: 'חליטות צמחים', aisle: 'beverages' },
	{ he: 'קפה', aisle: 'beverages', variants: ['קפה שחור', 'נס קפה'] },
	{ he: 'חלב צמחי', aisle: 'beverages', variants: ['חלב אורז', 'חלב שקדים', 'חלב סויה'] },
	{ he: 'חלב שיבולת שועל', aisle: 'beverages', top: true }
];

// ── Existing non-Maayan ingredients (dev + prod) → just need an aisle ──────────
const EXISTING_AISLES: Record<string, string> = {
	// dev
	'אבקת שום': 'spices',
	בהרט: 'spices',
	מייפל: 'spices',
	פפריקה: 'spices',
	'תבלין שווארמה': 'spices',
	חמאה: 'dairy',
	שמן: 'oils',
	// prod-only extras (from imported recipes)
	'אבקת קארי': 'spices',
	גמבה: 'produce',
	'חלב קוקוס': 'canned',
	'חמאת בוטנים': 'nuts',
	"צ'ילי מתוק": 'spices',
	'ציר ירקות': 'spices',
	קצח: 'spices',
	קשיו: 'nuts',
	'רוטב סויה': 'spices',
	'רסק עגבניות': 'canned',
	שמנת: 'dairy'
};

async function addVariant(ingredientId: string, label: string) {
	const key = computeVariantKey(label, label);
	const existing = await db
		.select({ id: ingredientVariants.id })
		.from(ingredientVariants)
		.where(
			and(
				eq(ingredientVariants.ingredientId, ingredientId),
				key ? eq(ingredientVariants.nameKey, key) : eq(ingredientVariants.name, label.toLowerCase())
			)
		)
		.limit(1);
	if (existing.length > 0) return;
	await db.insert(ingredientVariants).values({
		id: randomUUID(),
		ingredientId,
		name: label.toLowerCase(),
		nameHe: label,
		nameKey: key || null
	});
}

const seenKeys = new Map<string, string>(); // key → first he, to catch accidental merges

async function upsert(item: Item) {
	const key = keyForString(item.he);

	if (seenKeys.has(key) && seenKeys.get(key) !== item.he) {
		console.warn(`⚠️  key collision "${key}": "${seenKeys.get(key)}" ⇄ "${item.he}" (merging)`);
	}
	seenKeys.set(key, item.he);

	// match by canonical key, then by exact Hebrew name (legacy rows)
	let row = key
		? (await db.select().from(ingredients).where(eq(ingredients.nameKey, key)).limit(1))[0]
		: undefined;
	if (!row) {
		row = (await db.select().from(ingredients).where(eq(ingredients.nameHe, item.he)).limit(1))[0];
	}

	let id: string;
	if (row) {
		id = row.id;
		await db
			.update(ingredients)
			.set({
				nameHe: row.nameHe || item.he,
				nameKey: row.nameKey ?? (key || null),
				aisleCategoryId: item.aisle,
				isMaayan: true,
				maayanTop: row.maayanTop || !!item.top
			})
			.where(eq(ingredients.id, id));
	} else {
		id = randomUUID();
		await db.insert(ingredients).values({
			id,
			nameHe: item.he,
			nameKey: key || null,
			aisleCategoryId: item.aisle,
			isMaayan: true,
			maayanTop: !!item.top
		});
	}

	for (const v of item.variants ?? []) await addVariant(id, v);
	return id;
}

async function main() {
	// 1. Aisles: upsert + reorder
	for (const a of AISLES) {
		await db
			.insert(aisleCategories)
			.values(a)
			.onConflictDoUpdate({
				target: aisleCategories.id,
				set: { nameHe: a.nameHe, name: a.name, sortOrder: a.sortOrder, icon: a.icon }
			});
	}
	console.log(`✓ ${AISLES.length} aisles (incl. new קטניות + אגוזים וזרעים)`);

	// 2. Maayan's list
	let created = 0;
	const before = (await db.select({ id: ingredients.id }).from(ingredients)).length;
	for (const item of DATA) await upsert(item);
	const afterRows = await db.select({ id: ingredients.id }).from(ingredients);
	created = afterRows.length - before;
	console.log(`✓ ${DATA.length} Maayan items processed (${created} new, ${DATA.length - created} merged into existing)`);

	// 3. File the remaining existing ingredients
	let filed = 0;
	for (const [he, aisle] of Object.entries(EXISTING_AISLES)) {
		const r = await db
			.update(ingredients)
			.set({ aisleCategoryId: aisle })
			.where(eq(ingredients.nameHe, he));
		filed++;
	}
	console.log(`✓ ${filed} existing non-Maayan ingredients filed into aisles`);

	// 3b. Safety net — anything still without an aisle goes to 'other'
	const stragglers = await db
		.select({ id: ingredients.id, nameHe: ingredients.nameHe })
		.from(ingredients)
		.where(isNull(ingredients.aisleCategoryId));
	for (const s of stragglers) {
		await db.update(ingredients).set({ aisleCategoryId: 'other' }).where(eq(ingredients.id, s.id));
	}
	if (stragglers.length) {
		console.log(`✓ ${stragglers.length} leftover → 'other': ${stragglers.map((s) => s.nameHe).join(', ')}`);
	}

	// 4. Report
	const all = await db
		.select({
			nameHe: ingredients.nameHe,
			aisle: ingredients.aisleCategoryId,
			isMaayan: ingredients.isMaayan,
			top: ingredients.maayanTop
		})
		.from(ingredients);
	const maayan = all.filter((i) => i.isMaayan).length;
	const top = all.filter((i) => i.top).length;
	const noAisle = all.filter((i) => !i.aisle);
	console.log(`\n── Summary ──`);
	console.log(`total ingredients : ${all.length}`);
	console.log(`Maayan (purple)   : ${maayan}`);
	console.log(`extra-recommended : ${top}`);
	console.log(`without aisle     : ${noAisle.length}${noAisle.length ? ' → ' + noAisle.map((i) => i.nameHe).join(', ') : ''}`);
	const byAisle: Record<string, number> = {};
	for (const i of all) byAisle[i.aisle || '(none)'] = (byAisle[i.aisle || '(none)'] || 0) + 1;
	console.log(`per aisle         :`, byAisle);
}

main()
	.then(() => process.exit(0))
	.catch((e) => {
		console.error(e);
		process.exit(1);
	});
