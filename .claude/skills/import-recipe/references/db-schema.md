# Soul Food DB Schema & Insertion Patterns

## Tables

### recipes
```
id: text PK
title: text NOT NULL
titleHe: text
description: text
sourceUrl: text
sourceType: text NOT NULL ('url' | 'manual' | 'video' | 'cookbook')
imageUrl: text
servings: integer
prepTimeMinutes: integer
cookTimeMinutes: integer
totalTimeMinutes: integer
instructions: JSON text (string[])
tags: JSON text (string[])
category: text ('main' | 'side' | 'dessert' | 'soup' | 'salad' | 'breakfast' | 'snack')
cuisine: text ('israeli' | 'italian' | 'asian' | 'mexican' | 'french' | 'american' | 'mediterranean' | 'indian' | 'other')
isFavorite: boolean (default false)
createdBy: text FK → users.id
createdAt: timestamp
updatedAt: timestamp
```

### ingredients (canonical bank)
```
id: text PK
name: text NOT NULL UNIQUE (English, lowercase)
nameHe: text
aisleCategoryId: text FK → aisleCategories.id
defaultUnit: text
```

### recipeIngredients
```
id: text PK
recipeId: text FK → recipes.id (cascade delete)
ingredientId: text FK → ingredients.id
quantity: real
unit: text (normalized: cup, tbsp, tsp, g, kg, ml, l, oz, lb, piece, clove, package, can, bunch)
originalText: text
originalTextHe: text
preparation: text
isOptional: boolean (default false)
sortOrder: integer
```

### ingredientVariants
```
id: text PK
ingredientId: text FK → ingredients.id
name: text NOT NULL (lowercase)
nameHe: text
```

### recipeIngredientVariants
```
id: text PK
recipeIngredientId: text FK → recipeIngredients.id (cascade delete)
variantId: text FK → ingredientVariants.id
sortOrder: integer
```

### aisleCategories
```
id: text PK
name: text NOT NULL
nameHe: text NOT NULL
sortOrder: integer
icon: text
```

## Key Functions

### `findOrCreateIngredient(name, nameHe?)` → ingredient ID
Location: `src/lib/server/ingredients/normalizer.ts`
- Exact match on normalized name → Hebrew match → fuzzy (strip adjectives) → create new

### `findOrCreateVariant(ingredientId, name, nameHe?)` → variant ID
Location: `src/lib/server/ingredients/variants.ts`
- Match on (ingredientId, normalized name) → create new

### `setRecipeIngredientVariants(recipeIngredientId, variantIds[])`
Location: `src/lib/server/ingredients/variants.ts`
- Replaces all variants for a recipe ingredient

### `generateId()` → UUID string
Location: `src/lib/utils/helpers.ts`

## Insertion Pattern

```typescript
import { db } from '$lib/server/db';
import { recipes, recipeIngredients } from '$lib/server/db/schema';
import { generateId } from '$lib/utils/helpers';
import { findOrCreateIngredient } from '$lib/server/ingredients/normalizer';
import { findOrCreateVariant, setRecipeIngredientVariants } from '$lib/server/ingredients/variants';

// 1. Insert recipe
const recipeId = generateId();
await db.insert(recipes).values({
  id: recipeId,
  title, titleHe, description, sourceUrl,
  sourceType: 'url',
  imageUrl, servings,
  prepTimeMinutes, cookTimeMinutes, totalTimeMinutes,
  instructions, // string[]
  tags, // string[]
  category, cuisine,
  isFavorite: false,
  createdBy: userId
});

// 2. For each ingredient
for (let i = 0; i < ingredients.length; i++) {
  const ing = ingredients[i];
  const ingredientId = await findOrCreateIngredient(ing.canonicalName, ing.canonicalNameHe);

  const recipeIngId = generateId();
  await db.insert(recipeIngredients).values({
    id: recipeIngId,
    recipeId,
    ingredientId,
    quantity: ing.quantity,
    unit: ing.unit,
    originalText: ing.originalText,
    preparation: ing.preparation,
    isOptional: ing.isOptional,
    sortOrder: i
  });

  // 3. Create variants if any
  if (ing.variants && ing.variants.length > 0) {
    const variantIds = [];
    for (const v of ing.variants) {
      const vid = await findOrCreateVariant(ingredientId, v.name, v.nameHe);
      variantIds.push(vid);
    }
    await setRecipeIngredientVariants(recipeIngId, variantIds);
  }
}
```
