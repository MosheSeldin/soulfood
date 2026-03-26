<script lang="ts">
	import { X, Plus, ArrowRight } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface IngredientRow {
		quantity: number | null;
		unit: string;
		name: string;
		preparation: string;
		isOptional: boolean;
		variants: Array<{ name: string; nameEn: string }>;
	}

	let ingredientRows = $state<IngredientRow[]>(
		data.ingredients.length > 0
			? data.ingredients.map((i) => ({
					quantity: i.quantity,
					unit: i.unit || '',
					name: i.name,
					preparation: i.preparation || '',
					isOptional: i.isOptional,
					variants: i.variants.length > 0 ? [...i.variants] : []
				}))
			: [{ quantity: null, unit: '', name: '', preparation: '', isOptional: false, variants: [] }]
	);

	let instructionLines = $state(
		data.recipe.instructions && data.recipe.instructions.length > 0
			? [...data.recipe.instructions]
			: ['']
	);

	function addIngredient() {
		ingredientRows = [
			...ingredientRows,
			{ quantity: null, unit: '', name: '', preparation: '', isOptional: false, variants: [] }
		];
	}

	function removeIngredient(index: number) {
		ingredientRows = ingredientRows.filter((_, i) => i !== index);
	}

	function addVariant(ingIndex: number) {
		ingredientRows[ingIndex].variants = [
			...ingredientRows[ingIndex].variants,
			{ name: '', nameEn: '' }
		];
	}

	function removeVariant(ingIndex: number, varIndex: number) {
		ingredientRows[ingIndex].variants = ingredientRows[ingIndex].variants.filter(
			(_, i) => i !== varIndex
		);
	}

	function addInstruction() {
		instructionLines = [...instructionLines, ''];
	}

	function removeInstruction(index: number) {
		instructionLines = instructionLines.filter((_, i) => i !== index);
	}

	const unitOptions = [
		{ value: '', label: '—' },
		{ value: 'cup', label: 'כוס' },
		{ value: 'tbsp', label: 'כף' },
		{ value: 'tsp', label: 'כפית' },
		{ value: 'g', label: 'גרם' },
		{ value: 'kg', label: 'ק"ג' },
		{ value: 'ml', label: 'מ"ל' },
		{ value: 'l', label: 'ליטר' },
		{ value: 'piece', label: "יח'" },
		{ value: 'clove', label: 'שן' },
		{ value: 'package', label: 'חבילה' },
		{ value: 'can', label: 'פחית' },
		{ value: 'bunch', label: 'אגודה' }
	];

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית',
		side: 'תוספת',
		soup: 'מרק',
		salad: 'סלט',
		dessert: 'קינוח',
		breakfast: 'ארוחת בוקר',
		snack: 'חטיף'
	};

	function getIngredientsJson(): string {
		return JSON.stringify(
			ingredientRows.filter((r) => r.name.trim())
		);
	}
</script>

<div class="mx-auto max-w-lg">
	<a
		href="/recipes/{data.recipe.id}"
		class="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
	>
		<ArrowRight size={14} />
		חזרה למתכון
	</a>

	<h2 class="mb-4 text-xl font-bold">עריכת מתכון</h2>

	<form method="POST">
		<input type="hidden" name="ingredients" value={getIngredientsJson()} />
		<input
			type="hidden"
			name="instructions"
			value={JSON.stringify(instructionLines.filter((l) => l.trim()))}
		/>

		<div class="space-y-4">
			<!-- Title -->
			<div>
				<label for="title" class="mb-1 block text-sm font-medium">שם המתכון *</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					value={data.recipe.titleHe || data.recipe.title}
					class="input-glass w-full"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="mb-1 block text-sm font-medium">תיאור קצר</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					class="input-glass w-full"
				>{data.recipe.description || ''}</textarea>
			</div>

			<!-- Image URL -->
			<div>
				<label for="imageUrl" class="mb-1 block text-sm font-medium">קישור לתמונה</label>
				<input
					id="imageUrl"
					name="imageUrl"
					type="url"
					value={data.recipe.imageUrl || ''}
					class="input-glass w-full"
				/>
			</div>

			<!-- Category + Cuisine -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="category" class="mb-1 block text-sm font-medium">קטגוריה</label>
					<select id="category" name="category" class="input-glass w-full">
						<option value="">בחר</option>
						{#each Object.entries(categoryLabels) as [val, label]}
							<option value={val} selected={data.recipe.category === val}>{label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="cuisine" class="mb-1 block text-sm font-medium">מטבח</label>
					<select id="cuisine" name="cuisine" class="input-glass w-full">
						<option value="">בחר</option>
						<option value="israeli" selected={data.recipe.cuisine === 'israeli'}>ישראלי</option>
						<option value="italian" selected={data.recipe.cuisine === 'italian'}>איטלקי</option>
						<option value="asian" selected={data.recipe.cuisine === 'asian'}>אסייתי</option>
						<option value="mexican" selected={data.recipe.cuisine === 'mexican'}>מקסיקני</option>
						<option value="french" selected={data.recipe.cuisine === 'french'}>צרפתי</option>
						<option value="american" selected={data.recipe.cuisine === 'american'}>אמריקאי</option>
						<option value="mediterranean" selected={data.recipe.cuisine === 'mediterranean'}>ים תיכוני</option>
						<option value="indian" selected={data.recipe.cuisine === 'indian'}>הודי</option>
						<option value="other" selected={data.recipe.cuisine === 'other'}>אחר</option>
					</select>
				</div>
			</div>

			<!-- Servings + Times -->
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label for="servings" class="mb-1 block text-sm font-medium">מנות</label>
					<input id="servings" name="servings" type="number" min="1" value={data.recipe.servings || ''} class="input-glass w-full" />
				</div>
				<div>
					<label for="prepTime" class="mb-1 block text-sm font-medium">הכנה (דק')</label>
					<input id="prepTime" name="prepTime" type="number" min="0" value={data.recipe.prepTimeMinutes || ''} class="input-glass w-full" />
				</div>
				<div>
					<label for="cookTime" class="mb-1 block text-sm font-medium">בישול (דק')</label>
					<input id="cookTime" name="cookTime" type="number" min="0" value={data.recipe.cookTimeMinutes || ''} class="input-glass w-full" />
				</div>
			</div>

			<!-- Structured Ingredients -->
			<div>
				<p class="mb-2 block text-sm font-medium">מצרכים</p>
				<div class="space-y-3">
					{#each ingredientRows as row, i}
						<div class="glass-card p-3">
							<div class="flex gap-2">
								<input
									type="number"
									step="0.25"
									min="0"
									placeholder="כמות"
									bind:value={ingredientRows[i].quantity}
									class="input-glass w-16 px-2 py-1.5"
								/>
								<select bind:value={ingredientRows[i].unit} class="input-glass w-20 px-1 py-1.5">
									{#each unitOptions as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
								<input
									type="text"
									placeholder="שם המצרך"
									bind:value={ingredientRows[i].name}
									class="input-glass flex-1 px-2 py-1.5"
								/>
								{#if ingredientRows.length > 1}
									<button
										type="button"
										onclick={() => removeIngredient(i)}
										class="rounded p-1 text-text-muted hover:text-danger"
									>
										<X size={16} />
									</button>
								{/if}
							</div>

							<!-- Preparation + Optional -->
							<div class="mt-2 flex items-center gap-2">
								<input
									type="text"
									placeholder="הכנה (קצוץ, מומס...)"
									bind:value={ingredientRows[i].preparation}
									class="input-glass flex-1 px-2 py-1.5 text-xs"
								/>
								<label class="flex items-center gap-1 text-xs text-text-muted">
									<input
										type="checkbox"
										bind:checked={ingredientRows[i].isOptional}
										class="rounded"
									/>
									אופציונלי
								</label>
							</div>

							<!-- Variants -->
							{#if row.variants.length > 0}
								<div class="mt-2 space-y-1">
									<p class="text-xs font-medium text-text-muted">חלופות:</p>
									{#each row.variants as variant, vi}
										<div class="flex items-center gap-1">
											<input
												type="text"
												placeholder="שם החלופה"
												bind:value={ingredientRows[i].variants[vi].name}
												class="input-glass flex-1 px-2 py-1 text-xs"
											/>
											<button
												type="button"
												onclick={() => removeVariant(i, vi)}
												class="rounded p-0.5 text-text-muted hover:text-danger"
											>
												<X size={12} />
											</button>
										</div>
									{/each}
								</div>
							{/if}
							<button
								type="button"
								onclick={() => addVariant(i)}
								class="mt-1 text-xs text-primary hover:text-primary-light"
							>
								+ הוסף חלופה
							</button>
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={addIngredient}
					class="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary-light"
				>
					<Plus size={14} />
					הוסף מצרך
				</button>
			</div>

			<!-- Instructions -->
			<div>
				<p class="mb-1 block text-sm font-medium">הוראות הכנה</p>
				<div class="space-y-2">
					{#each instructionLines as line, i}
						<div class="flex gap-2">
							<span class="mt-2.5 text-sm text-text-muted">{i + 1}.</span>
							<textarea
								aria-label="שלב {i + 1}"
								bind:value={instructionLines[i]}
								rows="2"
								class="input-glass flex-1"
								placeholder="שלב הכנה..."
							></textarea>
							{#if instructionLines.length > 1}
								<button
									type="button"
									onclick={() => removeInstruction(i)}
									class="rounded-lg p-2 text-text-muted transition-colors hover:text-danger"
								>
									<X size={16} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={addInstruction}
					class="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary-light"
				>
					<Plus size={14} />
					הוסף שלב
				</button>
			</div>

			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}

			<div class="flex gap-3">
				<button type="submit" class="btn-primary flex-1">
					שמור שינויים
				</button>
				<a href="/recipes/{data.recipe.id}" class="btn-ghost px-4 py-2.5">
					ביטול
				</a>
			</div>
		</div>
	</form>
</div>
