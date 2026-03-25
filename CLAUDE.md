# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript type-check (svelte-check)
npm run check:watch  # Watch mode type-checking

# Database migrations (Drizzle)
npx drizzle-kit generate   # Generate migration from schema changes
npx drizzle-kit migrate    # Apply migrations to local.db
npx drizzle-kit studio     # Open Drizzle Studio (DB browser)

# Turso (production DB)
turso db shell <db-name>   # Connect to production database
```

No test framework is configured.

## Architecture

**Soul Food** is a SvelteKit 2 / Svelte 5 PWA for recipe management and smart shopping lists. It uses **Svelte 5 runes mode** throughout (no legacy stores).

### Stack
- **Framework:** SvelteKit with Vercel adapter (Node 22)
- **Database:** SQLite via Turso (LibSQL) + Drizzle ORM — `local.db` for dev, Turso URL in production
- **Styling:** Tailwind CSS 4 (via Vite plugin)
- **PWA:** @vite-pwa/sveltekit with auto-update; default start URL is `/shopping`; Hebrew/RTL configured

### Data Flow
- All data mutations go through **SvelteKit form actions** (no API routes except `/api/scrape`)
- All reads use **server-side `load` functions** — no client-side fetching
- Auth is **session cookie** based: every protected route's `+page.server.ts` calls `getSession(cookies)` and redirects to `/login` on failure

### Database Schema (`src/lib/server/db/schema.ts`)
8 tables: `users`, `sessions`, `recipes`, `recipeIngredients`, `ingredients`, `aisleCategories`, `pantryItems`, `shoppingLists` (with `shoppingListRecipes`). The `ingredients` table is a canonical bank shared across recipes; `aisleCategories` drives sorting of shopping list items.

### Key Server Modules
| Path | Responsibility |
|------|---------------|
| `src/lib/server/auth.ts` | Session CRUD, SHA-256 password hashing, 30-day expiry |
| `src/lib/server/db/` | Drizzle schema + `initializeDb()` with seed data |
| `src/lib/server/scraper/index.ts` | Fetch URL → extract JSON-LD recipe schema → normalize |
| `src/lib/server/ingredients/parser.ts` | Parse ingredient text lines (unicode fractions, Hebrew/English units) |
| `src/lib/utils/quantities.ts` | Aggregate ingredient quantities across recipes with unit conversion |

### Shopping List Generation
1. User selects recipes → stored in `shoppingListRecipes`
2. Load function queries all `recipeIngredients` for those recipes, scaled by serving multiplier
3. `quantities.ts` aggregates identical ingredients (converting within volume/weight families)
4. Pantry items are subtracted
5. Result grouped by `aisleCategories.sortOrder` for in-store ordering

### Recipe Import Pipeline
`/api/scrape` POST → fetch URL with browser User-Agent → parse HTML for JSON-LD `Recipe` schema → normalize fields → `parser.ts` parses each ingredient line → find-or-create canonical `ingredients` records → insert `recipe` + `recipeIngredients`

### Bilingual Support
Hebrew and English are both first-class. `ingredients` has `name` (English) and `nameHe` (Hebrew). `aisleCategories` has `name` and `nameHe`. The parser handles Hebrew unit names (כוס, כף, גרם, etc.).
