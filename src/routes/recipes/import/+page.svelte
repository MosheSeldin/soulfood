<script lang="ts">
	import { enhance } from '$app/forms';
	import { Link, Loader2, X, Plus, BookOpen } from 'lucide-svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let url = $state('');
	let loading = $state(false);
	let scrapeError = $state('');

	let preview = $state<{
		title: string;
		description: string | null;
		imageUrl: string | null;
		ingredients: string[];
		instructions: string[];
		servings: number | null;
		prepTimeMinutes: number | null;
		cookTimeMinutes: number | null;
		totalTimeMinutes: number | null;
		category: string | null;
		cuisine: string | null;
		tags: string[];
	} | null>(null);

	async function handleScrape() {
		if (!url.trim()) return;
		loading = true;
		scrapeError = '';
		preview = null;

		try {
			const res = await fetch('/api/scrape', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim() })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				scrapeError = data?.message || `שגיאה (${res.status})`;
				return;
			}

			preview = await res.json();
		} catch {
			scrapeError = 'שגיאה בחיבור לשרת';
		} finally {
			loading = false;
		}
	}

	function removeIngredient(index: number) {
		if (preview) {
			preview.ingredients = preview.ingredients.filter((_, i) => i !== index);
		}
	}

	function addIngredient() {
		if (preview) {
			preview.ingredients = [...preview.ingredients, ''];
		}
	}

	function removeInstruction(index: number) {
		if (preview) {
			preview.instructions = preview.instructions.filter((_, i) => i !== index);
		}
	}
</script>

<div class="mx-auto max-w-lg">
	<h2 class="mb-4 text-xl font-bold">ייבוא מתכון</h2>

	<!-- URL Input -->
	<div class="mb-6">
		<label for="url" class="mb-1 block text-sm font-medium">הדבק קישור למתכון</label>
		<div class="flex gap-2">
			<div class="relative flex-1">
				<Link size={16} class="absolute right-3 top-3 text-text-muted" />
				<input
					id="url"
					type="url"
					bind:value={url}
					onkeydown={(e) => e.key === 'Enter' && handleScrape()}
					class="w-full rounded-lg border border-border bg-white py-2.5 pe-3 ps-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="https://www.example.com/recipe..."
					dir="ltr"
				/>
			</div>
			<button
				onclick={handleScrape}
				disabled={loading || !url.trim()}
				class="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-50"
			>
				{#if loading}
					<Loader2 size={16} class="animate-spin" />
				{/if}
				ייבא
			</button>
		</div>

		{#if scrapeError}
			<p class="mt-2 text-sm text-danger">{scrapeError}</p>
		{/if}

		<div class="mt-3 text-center">
			<a
				href="/recipes/new"
				class="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
			>
				<BookOpen size={14} />
				או הוסף מתכון ידנית
			</a>
		</div>
	</div>

	<!-- Preview & Edit -->
	{#if preview}
		<form method="POST" action="?/save" use:enhance class="space-y-4 rounded-xl border border-border bg-white p-4">
			<input type="hidden" name="sourceUrl" value={url} />
			<input type="hidden" name="ingredients" value={JSON.stringify(preview.ingredients)} />
			<input type="hidden" name="instructions" value={JSON.stringify(preview.instructions)} />
			<input type="hidden" name="tags" value={JSON.stringify(preview.tags)} />
			<input type="hidden" name="prepTime" value={preview.prepTimeMinutes ?? ''} />
			<input type="hidden" name="cookTime" value={preview.cookTimeMinutes ?? ''} />
			<input type="hidden" name="totalTime" value={preview.totalTimeMinutes ?? ''} />
			<input type="hidden" name="imageUrl" value={preview.imageUrl ?? ''} />

			{#if preview.imageUrl}
				<img
					src={preview.imageUrl}
					alt={preview.title}
					class="h-48 w-full rounded-lg object-cover"
				/>
			{/if}

			<div>
				<label for="title" class="mb-1 block text-sm font-medium">שם המתכון</label>
				<input
					id="title"
					name="title"
					type="text"
					value={preview.title}
					class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			{#if preview.description}
				<div>
					<label for="desc" class="mb-1 block text-sm font-medium">תיאור</label>
					<textarea
						id="desc"
						name="description"
						rows="2"
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					>{preview.description}</textarea>
				</div>
			{/if}

			<div class="grid grid-cols-3 gap-3">
				<div>
					<label for="servings" class="mb-1 block text-sm font-medium">מנות</label>
					<input
						id="servings"
						name="servings"
						type="number"
						value={preview.servings ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium">קטגוריה</label>
					<input
						name="category"
						type="text"
						value={preview.category ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium">מטבח</label>
					<input
						name="cuisine"
						type="text"
						value={preview.cuisine ?? ''}
						class="w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			<!-- Ingredients -->
			<div>
				<p class="mb-1 block text-sm font-medium">מצרכים ({preview.ingredients.length})</p>
				<div class="space-y-1.5">
					{#each preview.ingredients as ingredient, i}
						<div class="flex gap-1.5">
							<input
								type="text"
								aria-label="מצרך {i + 1}"
								bind:value={preview.ingredients[i]}
								class="flex-1 rounded border border-border px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
							/>
							<button
								type="button"
								onclick={() => removeIngredient(i)}
								class="rounded p-1.5 text-text-muted hover:text-danger"
							>
								<X size={14} />
							</button>
						</div>
					{/each}
				</div>
				<button
					type="button"
					onclick={addIngredient}
					class="mt-1.5 flex items-center gap-1 text-sm text-primary hover:text-primary-dark"
				>
					<Plus size={14} />
					הוסף מצרך
				</button>
			</div>

			<!-- Instructions -->
			<div>
				<p class="mb-1 block text-sm font-medium">הוראות הכנה ({preview.instructions.length})</p>
				<div class="space-y-1.5">
					{#each preview.instructions as instruction, i}
						<div class="flex gap-1.5">
							<span class="mt-1.5 text-xs text-text-muted">{i + 1}.</span>
							<textarea
								aria-label="שלב {i + 1}"
								bind:value={preview.instructions[i]}
								rows="2"
								class="flex-1 rounded border border-border px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
							></textarea>
							<button
								type="button"
								onclick={() => removeInstruction(i)}
								class="rounded p-1.5 text-text-muted hover:text-danger"
							>
								<X size={14} />
							</button>
						</div>
					{/each}
				</div>
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
		</form>
	{/if}
</div>
