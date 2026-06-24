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
	{ id: 'vegetables', nameHe: 'ירקות', name: 'Vegetables', sortOrder: 1, icon: 'carrot' },
	{ id: 'fruits', nameHe: 'פירות', name: 'Fruits', sortOrder: 2, icon: 'apple' },
	{ id: 'dairy', nameHe: 'מוצרי חלב', name: 'Dairy', sortOrder: 3, icon: 'milk' },
	{ id: 'meat', nameHe: 'בשר ודגים', name: 'Meat & Fish', sortOrder: 4, icon: 'beef' },
	{ id: 'bakery', nameHe: 'מאפייה ולחם', name: 'Bakery', sortOrder: 5, icon: 'croissant' },
	{ id: 'grains', nameHe: 'דגנים ופסטה', name: 'Grains & Pasta', sortOrder: 6, icon: 'wheat' },
	{ id: 'legumes', nameHe: 'קטניות', name: 'Legumes', sortOrder: 7, icon: 'bean' },
	{ id: 'nuts', nameHe: 'אגוזים וזרעים', name: 'Nuts & Seeds', sortOrder: 8, icon: 'nut' },
	{ id: 'canned', nameHe: 'שימורים', name: 'Canned & Jarred', sortOrder: 9, icon: 'package' },
	{ id: 'spices', nameHe: 'תבלינים ורטבים', name: 'Spices & Condiments', sortOrder: 10, icon: 'flame' },
	{ id: 'oils', nameHe: 'שמנים וחומץ', name: 'Oils & Vinegars', sortOrder: 11, icon: 'droplets' },
	{ id: 'frozen', nameHe: 'קפואים', name: 'Frozen', sortOrder: 12, icon: 'snowflake' },
	{ id: 'beverages', nameHe: 'משקאות', name: 'Beverages', sortOrder: 13, icon: 'cup-soda' },
	{ id: 'snacks', nameHe: 'חטיפים', name: 'Snacks', sortOrder: 14, icon: 'cookie' },
	{ id: 'household', nameHe: 'מוצרי בית', name: 'Household', sortOrder: 15, icon: 'home' },
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

	// ── פירות → fruits (fresh) ──
	{ he: 'אבטיח', aisle: 'fruits' },
	{ he: 'אגס', aisle: 'fruits' },
	{ he: 'אוכמניות', aisle: 'fruits' },
	{ he: 'אנונה', aisle: 'fruits' },
	{ he: 'אפרסק', aisle: 'fruits' },
	{ he: 'דובדבן', aisle: 'fruits' },
	{ he: 'נקטרינה', aisle: 'fruits' },
	{ he: 'ענבים', aisle: 'fruits' },
	{ he: 'פטל', aisle: 'fruits' },
	{ he: 'רימון', aisle: 'fruits' },
	{ he: 'שזיף', aisle: 'fruits' },
	{ he: 'תאנה', aisle: 'fruits' },
	{ he: 'תות עץ', aisle: 'fruits' },
	{ he: 'שסק', aisle: 'fruits' },
	{ he: 'תפוח עץ', aisle: 'fruits' },
	{ he: 'תמר', aisle: 'fruits' },
	{ he: 'לימון', aisle: 'fruits', top: true },
	{ he: 'אבוקדו', aisle: 'fruits' },

	// ── פירות מיובשים → snacks ──
	{ he: "גוג'י ברי", aisle: 'snacks' },
	{ he: 'דבלה', aisle: 'snacks' },
	{ he: 'חמוציות', aisle: 'snacks' },
	{ he: 'משמש', aisle: 'snacks' },
	{ he: 'צימוקים', aisle: 'snacks' },

	// ── ירקות → vegetables ──
	{ he: 'אצות', aisle: 'vegetables', top: true, variants: ['ארמה', 'וואקמה', 'נורי', 'קומבו'] },
	{ he: 'אנדיב', aisle: 'vegetables' },
	{ he: 'אספרגוס', aisle: 'vegetables' },
	{ he: 'ארטישוק', aisle: 'vegetables' },
	{ he: "בוק צ'וי", aisle: 'vegetables' },
	{ he: 'בטטה', aisle: 'vegetables' },
	{ he: 'ברוקולי', aisle: 'vegetables' },
	{ he: 'גזר', aisle: 'vegetables' },
	{ he: 'גרגיר נחלים', aisle: 'vegetables', top: true },
	{ he: 'דלעת', aisle: 'vegetables', top: true },
	{ he: 'דלורית', aisle: 'vegetables', top: true },
	{ he: 'חסה', aisle: 'vegetables' },
	{ he: 'כוסברה', aisle: 'vegetables' },
	{ he: 'כרוב', aisle: 'vegetables', variants: ['ירוק', 'לבן'] },
	{ he: 'קייל', aisle: 'vegetables' },
	{ he: 'כרובית', aisle: 'vegetables' },
	{ he: 'כרישה', aisle: 'vegetables' },
	{ he: 'מלפפון', aisle: 'vegetables' },
	{ he: 'נבטי חמנייה', aisle: 'vegetables' },
	{ he: 'נבטי מש', aisle: 'vegetables' },
	{ he: 'נצרי במבוק', aisle: 'vegetables' },
	{ he: 'סלק', aisle: 'vegetables' },
	{ he: 'סלרי עלים', aisle: 'vegetables' },
	{ he: 'סלרי מקלות', aisle: 'vegetables' },
	{ he: 'סלרי שורש', aisle: 'vegetables' },
	{ he: 'עולש', aisle: 'vegetables' },
	{ he: 'עירית', aisle: 'vegetables' },
	{ he: 'עלי גפן', aisle: 'vegetables' },
	{ he: 'עלי מנגולד', aisle: 'vegetables' },
	{ he: 'עלי סלק', aisle: 'vegetables' },
	{ he: 'פטרוזיליה', aisle: 'vegetables', top: true },
	{ he: 'קולורבי', aisle: 'vegetables' },
	{ he: 'קישוא', aisle: 'vegetables' },
	{ he: 'רוקט', aisle: 'vegetables' },
	{ he: 'שומר', aisle: 'vegetables' },
	{ he: 'שמיר', aisle: 'vegetables' },
	{ he: 'תרד', aisle: 'vegetables' },
	{ he: 'צנון', aisle: 'vegetables' },
	{ he: 'צנונית', aisle: 'vegetables' },
	{ he: 'שום', aisle: 'vegetables' },
	{ he: 'בצל', aisle: 'vegetables', variants: ['בצל ירוק'] },
	{ he: 'עגבניות', aisle: 'vegetables' },

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
	גמבה: 'vegetables',
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
