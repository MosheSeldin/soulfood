<script lang="ts">
	import { enhance } from '$app/forms';
	import { X, Plus } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let ingredientLines = $state(['']);
	let instructionLines = $state(['']);

	function addIngredient() {
		ingredientLines = [...ingredientLines, ''];
	}

	function removeIngredient(index: number) {
		ingredientLines = ingredientLines.filter((_, i) => i !== index);
	}

	function addInstruction() {
		instructionLines = [...instructionLines, ''];
	}

	function removeInstruction(index: number) {
		instructionLines = instructionLines.filter((_, i) => i !== index);
	}

	function handleSubmit(event: { formData: FormData }) {
		const filtered = ingredientLines.filter((l) => l.trim());
		event.formData.set('ingredients', JSON.stringify(filtered));
		const filteredInst = instructionLines.filter((l) => l.trim());
		event.formData.set('instructions', JSON.stringify(filteredInst));
	}
</script>

<div class="mx-auto max-w-lg">
	<h2 class="mb-4 text-xl font-bold">מתכון חדש</h2>

	<form method="POST" use:enhance={() => ({ update }) => { handleSubmit; return update(); }}>
		{#snippet submitHandler()}
			<!-- handled by enhance -->
		{/snippet}

		<input type="hidden" name="ingredients" value={JSON.stringify(ingredientLines.filter(l => l.trim()))} />
		<input type="hidden" name="instructions" value={JSON.stringify(instructionLines.filter(l => l.trim()))} />
		<input type="hidden" name="sourceType" value="manual" />

		<div class="space-y-4">
			<!-- Title -->
			<div>
				<label for="title" class="mb-1 block text-sm font-medium">שם המתכון *</label>
				<input
					id="title"
					name="title"
					type="text"
					required
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="למשל: פסטה ברוטב עגבניות"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="mb-1 block text-sm font-medium">תיאור קצר</label>
				<textarea
					id="description"
					name="description"
					rows="2"
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="תיאור קצר של המתכון..."
				></textarea>
			</div>

			<!-- Category + Cuisine -->
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label for="category" class="mb-1 block text-sm font-medium">קטגוריה</label>
					<select
						id="category"
						name="category"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="">בחר</option>
						<option value="main">מנה עיקרית</option>
						<option value="side">תוספת</option>
						<option value="soup">מרק</option>
						<option value="salad">סלט</option>
						<option value="dessert">קינוח</option>
						<option value="breakfast">ארוחת בוקר</option>
						<option value="snack">חטיף</option>
					</select>
				</div>
				<div>
					<label for="cuisine" class="mb-1 block text-sm font-medium">מטבח</label>
					<select
						id="cuisine"
						name="cuisine"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					>
						<option value="">בחר</option>
						<option value="israeli">ישראלי</option>
						<option value="italian">איטלקי</option>
						<option value="asian">אסייתי</option>
						<option value="mexican">מקסיקני</option>
						<option value="french">צרפתי</option>
						<option value="american">אמריקאי</option>
						<option value="mediterranean">ים תיכוני</option>
						<option value="indian">הודי</option>
						<option value="other">אחר</option>
					</select>
				</div>
			</div>

			<!-- Servings + Times -->
			<div class="grid grid-cols-3 gap-3">
				<div>
					<label for="servings" class="mb-1 block text-sm font-medium">מנות</label>
					<input
						id="servings"
						name="servings"
						type="number"
						min="1"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						placeholder="4"
					/>
				</div>
				<div>
					<label for="prepTime" class="mb-1 block text-sm font-medium">הכנה (דק')</label>
					<input
						id="prepTime"
						name="prepTime"
						type="number"
						min="0"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						placeholder="15"
					/>
				</div>
				<div>
					<label for="cookTime" class="mb-1 block text-sm font-medium">בישול (דק')</label>
					<input
						id="cookTime"
						name="cookTime"
						type="number"
						min="0"
						class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						placeholder="30"
					/>
				</div>
			</div>

			<!-- Ingredients -->
			<div>
				<p class="mb-1 block text-sm font-medium">מצרכים</p>
				<div class="space-y-2">
					{#each ingredientLines as line, i}
						<div class="flex gap-2">
							<input
								type="text"
								aria-label="מצרך {i + 1}"
								bind:value={ingredientLines[i]}
								class="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								placeholder="למשל: 2 כוסות קמח"
							/>
							{#if ingredientLines.length > 1}
								<button
									type="button"
									onclick={() => removeIngredient(i)}
									class="rounded-lg p-2 text-text-muted hover:bg-surface-warm hover:text-danger"
								>
									<X size={16} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={addIngredient}
					class="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
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
								class="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								placeholder="שלב הכנה..."
							></textarea>
							{#if instructionLines.length > 1}
								<button
									type="button"
									onclick={() => removeInstruction(i)}
									class="rounded-lg p-2 text-text-muted hover:bg-surface-warm hover:text-danger"
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
					class="mt-2 flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
				>
					<Plus size={14} />
					הוסף שלב
				</button>
			</div>

			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}

			<button
				type="submit"
				class="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition hover:bg-primary-dark"
			>
				שמור מתכון
			</button>
		</div>
	</form>
</div>
