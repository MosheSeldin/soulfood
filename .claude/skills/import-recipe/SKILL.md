---
name: import-recipe
description: Import a recipe from a URL into the Soul Food app with clean, structured data. Use when the user runs /import-recipe, wants to add a recipe from a URL, or says "import recipe", "add recipe from URL", "הוסף מתכון". Fetches the page, extracts structured recipe data (title, ingredients with variants, instructions), rewrites instructions for clarity, and inserts into the database.
---

# Import Recipe

Import a recipe URL into the Soul Food app with structured, clean data.

## Workflow

1. Fetch the recipe page content (use the `defuddle` skill)
2. Extract structured recipe data from the content
3. Write a JSON file matching the RecipeImport schema
4. Insert into the database via `scripts/insert-recipe.ts`

## Step 1: Fetch the Page

Use the `defuddle` skill to fetch clean content from the URL.

## Step 2: Extract Structured Data

Parse the recipe content into this exact JSON structure:

```json
{
  "title": "Grandma's Mejadra",
  "titleHe": "מג'דרה של סבתות",
  "description": "Short description in Hebrew",
  "sourceUrl": "https://...",
  "imageUrl": "https://... (og:image or first recipe image)",
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
4. **Hebrew** — match source language
5. **Practical** — doneness indicators ("until golden") not just times

## Step 3: Write JSON File

Save structured data to `/tmp/recipe-import.json`.

## Step 4: Insert into Database

```bash
cd <project-root> && npx tsx .claude/skills/import-recipe/scripts/insert-recipe.ts /tmp/recipe-import.json
```

If the script fails, read [references/db-schema.md](references/db-schema.md) for schema details and insert directly.

## Step 5: Verify

Report: recipe title, ID, ingredient count, variant count, app URL `/recipes/<id>`.
