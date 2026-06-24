---
name: import-recipe
description: Import a recipe from a URL into the Soul Food app with clean, structured data. Use when the user runs /import-recipe, wants to add a recipe from a URL, or says "import recipe", "add recipe from URL", "הוסף מתכון". Fetches the page, extracts structured recipe data (title, ingredients with variants, instructions), rewrites instructions for clarity, finds a good image (searching the web when the page has none), and inserts into the database.
---

# Import Recipe

Import a recipe URL into the Soul Food app with structured, clean, Hebrew-first data.

## Workflow

1. Fetch the recipe page content
2. Extract structured recipe data
3. **Make sure there's a good image** — find one on the web if the page has none
4. Write a JSON file matching the RecipeImport schema
5. Insert into the database via `scripts/insert-recipe.ts`
6. Verify and report

## Step 1: Fetch the Page

Use the `defuddle` skill to fetch clean content from the URL.

- If defuddle returns empty / broken / clearly truncated content, fall back to the
  `firecrawl-scrape` skill (handles JS-heavy SPAs and anti-bot pages).
- Keep the raw page metadata too — `firecrawl-scrape` returns `metadata.ogImage`,
  `metadata.title`, etc., which are the most reliable source for the recipe image.

## Step 2: Extract Structured Data

Parse the recipe content into this exact JSON structure:

```json
{
  "title": "Grandma's Mejadra",
  "titleHe": "מג'דרה של סבתות",
  "description": "Short description in Hebrew",
  "sourceUrl": "https://...",
  "imageUrl": "https://... (see Step 3 — never leave empty if a good image exists)",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 45,
  "totalTimeMinutes": 60,
  "category": "main",
  "cuisine": "israeli",
  "tags": [],
  "instructions": ["step 1...", "step 2..."],
  "ingredients": [...]
}
```

**Bilingual is mandatory.** The app is Hebrew-first. Always provide `titleHe`. If the
source is English-only, translate the title to natural Hebrew. Write `description` and
all `instructions` in Hebrew regardless of the source language.

**Category** — infer one of: `main`, `side`, `soup`, `salad`, `dessert`, `breakfast`,
`snack`. **Tags** — short Hebrew labels (e.g. "טבעוני", "ללא גלוטן", "מהיר", "חגיגי")
when clearly applicable; otherwise leave `[]`.

### Ingredient Extraction Rules

Each ingredient must be structured as:

```json
{
  "quantity": 1.5,
  "unit": "cup",
  "canonicalName": "rice",
  "canonicalNameHe": "אורז",
  "variants": [
    { "name": "jasmine rice", "nameHe": "אורז יסמין" },
    { "name": "persian rice", "nameHe": "אורז פרסי" },
    { "name": "basmati rice", "nameHe": "אורז בסמטי" }
  ],
  "preparation": null,
  "isOptional": false,
  "originalText": "1½ כוסות אורז (יסמין) (פרסי או בסמטי)"
}
```

**Critical rules:**

- **Canonical name** = the base ingredient without variety/type qualifier. Examples: "rice" not "jasmine rice", "lentils" not "green lentils", "oil" not "olive oil"
- **Variants** = specific types/varieties. Extract from parenthetical notes, slash-separated options, or "או"/"or" patterns
- **When NO alternatives exist**, still create a single variant if a type is specified. E.g., "2 כף שמן זית" → canonicalName: "oil", variants: [{name: "olive oil", nameHe: "שמן זית"}]
- **When the type IS the ingredient** (no broader category), use no variants. E.g., "מלח", "מים", "ביצים"
- **Unit normalization**: Use only: `cup`, `tbsp`, `tsp`, `g`, `kg`, `ml`, `l`, `oz`, `lb`, `piece`, `clove`, `package`, `can`, `bunch`. Hebrew mapping: כוס→cup, כף→tbsp, כפית→tsp, גרם→g, ק"ג→kg, מ"ל→ml, ליטר→l
- **Quantity**: Handle Unicode fractions (½=0.5, ¼=0.25, ¾=0.75, ⅓=0.333, ⅔=0.667), ranges (use lower value), "כמה"/"קצת" → null
- **Clean up** HTML entities, `&nbsp;`, encoding artifacts
- **Preparation** = how ingredient is prepared ("קצוץ", "מומס", "chopped"), NOT what type it is

### Instruction Rewriting Rules

Do NOT copy instructions verbatim. Rewrite them to be:

1. **Clear and concise** — remove filler, chatty tone, narrative
2. **Efficiently ordered** — group prep, combine where logical
3. **Actionable** — start with verb, include temperatures, times, visual cues
4. **Hebrew** — always Hebrew, regardless of source language
5. **Practical** — doneness indicators ("until golden") not just times

## Step 3: Image — always try to end up with a good one

A recipe with no image looks broken in the app. Resolve `imageUrl` in this order:

1. **From the page.** Prefer, in order: `metadata.ogImage` (from `firecrawl-scrape`),
   the JSON-LD recipe `image`, then the first large in-content image. Skip logos,
   avatars, icons, ads, and tiny thumbnails.
2. **If the page has no usable image, search the web.** Use the `firecrawl-search`
   skill (or `WebSearch`) for the dish, e.g. `"<dish name> recipe"` or the Hebrew
   `"<titleHe> מתכון"`. Pick a clear, appetizing photo of *this* dish from a
   reputable food site.
3. **Validate** the chosen URL before using it:
   - It must be a direct image (ends in `.jpg`/`.jpeg`/`.png`/`.webp`, or a known
     image CDN URL), not an HTML page.
   - Confirm it actually loads, e.g.
     `curl -sIL "<url>" | grep -i "content-type:"` → must be `image/*`.
   - Prefer a reasonably large image (food photo, not a 50×50 thumbnail).
4. Only leave `imageUrl` null if every attempt fails — and mention that in the report
   so the user can add one manually.

When in doubt between two images, prefer the one that best matches the actual dish in
the recipe over a generic stock photo.

## Step 4: Write JSON File

Save structured data to `/tmp/recipe-import.json`.

## Step 5: Insert into Database

```bash
cd <project-root> && npx tsx .claude/skills/import-recipe/scripts/insert-recipe.ts /tmp/recipe-import.json
```

If the script fails, read [references/db-schema.md](references/db-schema.md) for schema details and insert directly.

## Step 6: Verify & Report

Report:
- recipe title (Hebrew), ID, ingredient count, variant count
- whether the image came from the page or a web search (and the URL)
- app URL `/recipes/<id>`

If `imageUrl` ended up null, say so explicitly and suggest the user add one.
