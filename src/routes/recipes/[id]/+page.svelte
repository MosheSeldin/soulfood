<script lang="ts">
	import { enhance } from '$app/forms';
	import { Heart, Clock, ExternalLink, Trash2, ShoppingCart, ArrowRight, Pencil, ChevronDown, Plus, Check } from 'lucide-svelte';
	import { formatTime } from '$lib/utils/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Track which ingredients were just added to shopping list (for visual feedback)
	let addedItems = $state<Record<string, boolean>>({});

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית', side: 'תוספת', soup: 'מרק', salad: 'סלט',
		dessert: 'קינוח', breakfast: 'בוקר', snack: 'חטיף'
	};

	let servingsMultiplier = $state(1);
	let currentServings = $derived(
		data.recipe.servings ? data.recipe.servings * servingsMultiplier : null
	);

	// Track selected variant per ingredient (keyed by recipeIngredient ID)
	let selectedVariants = $state<Record<string, string>>({});

	function getDisplayName(ing: typeof data.ingredients[0]): string {
		const variants = ing.variants;
		if (!variants || variants.length === 0) {
			return ing.ingredientNameHe || ing.ingredientName || '';
		}
		const selectedId = selectedVariants[ing.id];
		if (selectedId) {
			const v = variants.find((v) => v.variantId === selectedId);
			if (v) return v.nameHe || v.name;
		}
		// Default to first variant
		return variants[0].nameHe || variants[0].name;
	}

	function adjustServings(delta: number) {
		const newVal = servingsMultiplier + delta * 0.5;
		if (newVal >= 0.5) servingsMultiplier = newVal;
	}

	function formatQuantity(qty: number | null): string {
		if (qty === null) return '';
		const adjusted = qty * servingsMultiplier;
		if (adjusted === Math.floor(adjusted)) return adjusted.toString();
		// Nice fractions
		const frac = adjusted - Math.floor(adjusted);
		const whole = Math.floor(adjusted);
		if (Math.abs(frac - 0.5) < 0.01) return whole ? `${whole}½` : '½';
		if (Math.abs(frac - 0.25) < 0.01) return whole ? `${whole}¼` : '¼';
		if (Math.abs(frac - 0.75) < 0.01) return whole ? `${whole}¾` : '¾';
		if (Math.abs(frac - 0.33) < 0.05) return whole ? `${whole}⅓` : '⅓';
		if (Math.abs(frac - 0.67) < 0.05) return whole ? `${whole}⅔` : '⅔';
		return adjusted.toFixed(1);
	}

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', oz: 'אונ\'', lb: 'ליברה',
		piece: 'יח\'', clove: 'שן', package: 'חבילה', can: 'פחית', bunch: 'אגודה'
	};
</script>

<div class="mx-auto max-w-2xl">
	<a href="/recipes" class="mb-3 inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary">
		<ArrowRight size={14} />
		חזרה למתכונים
	</a>

	{#if data.recipe.imageUrl}
		<img
			src={data.recipe.imageUrl}
			alt={data.recipe.titleHe || data.recipe.title}
			class="mb-4 h-56 w-full rounded-xl object-cover sm:h-72"
		/>
	{/if}

	<div class="flex items-start justify-between gap-3">
		<h1 class="text-2xl font-bold">{data.recipe.titleHe || data.recipe.title}</h1>
		<div class="flex gap-1">
			<form method="POST" action="?/toggleFavorite" use:enhance>
				<button class="rounded-lg p-2 hover:bg-surface-warm">
					<Heart size={20} class={data.recipe.isFavorite ? 'fill-primary text-primary' : 'text-text-muted'} />
				</button>
			</form>
		</div>
	</div>

	{#if data.recipe.description}
		<p class="mt-2 text-sm text-text-muted">{data.recipe.description}</p>
	{/if}

	<!-- Meta -->
	<div class="mt-3 flex flex-wrap gap-3 text-sm text-text-muted">
		{#if data.recipe.category}
			<span class="rounded-full bg-surface-warm px-2.5 py-0.5">{categoryLabels[data.recipe.category] || data.recipe.category}</span>
		{/if}
		{#if data.recipe.totalTimeMinutes}
			<span class="flex items-center gap-1"><Clock size={14} />{formatTime(data.recipe.totalTimeMinutes)}</span>
		{/if}
		{#if data.recipe.sourceUrl}
			<a href={data.recipe.sourceUrl} target="_blank" rel="noopener" class="flex items-center gap-1 hover:text-primary">
				<ExternalLink size={14} />מקור
			</a>
		{/if}
	</div>

	<!-- Servings adjuster -->
	{#if data.recipe.servings}
		<div class="mt-4 flex items-center gap-3 rounded-lg bg-surface-warm px-4 py-2.5">
			<span class="text-sm font-medium">מנות:</span>
			<button onclick={() => adjustServings(-1)} class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-lg hover:bg-primary hover:text-white">−</button>
			<span class="min-w-[2rem] text-center font-semibold">{currentServings}</span>
			<button onclick={() => adjustServings(1)} class="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-white text-lg hover:bg-primary hover:text-white">+</button>
		</div>
	{/if}

	<!-- Ingredients -->
	<div class="mt-6">
		<h2 class="mb-3 text-lg font-bold">מצרכים</h2>
		<ul class="space-y-2">
			{#each data.ingredients as ing}
				<li class="flex items-center gap-2 text-sm">
					<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
					<span class="flex flex-1 flex-wrap items-baseline gap-1">
						{#if ing.quantity}
							<strong>{formatQuantity(ing.quantity)}</strong>
						{/if}
						{#if ing.unit}
							{unitLabels[ing.unit] || ing.unit}
						{/if}
						{#if ing.variants && ing.variants.length > 1}
							<span class="relative inline-block">
								<select
									class="appearance-none rounded border border-border bg-surface-warm pe-5 ps-1.5 py-0.5 text-sm font-medium text-primary cursor-pointer hover:bg-primary/10 focus:border-primary focus:outline-none"
									value={selectedVariants[ing.id] || ing.variants[0].variantId}
									onchange={(e) => { selectedVariants[ing.id] = (e.target as HTMLSelectElement).value; }}
								>
									{#each ing.variants as v}
										<option value={v.variantId}>{v.nameHe || v.name}</option>
									{/each}
								</select>
							</span>
						{:else}
							{getDisplayName(ing)}
						{/if}
						{#if ing.preparation}
							<span class="text-text-muted">({ing.preparation})</span>
						{/if}
						{#if ing.isOptional}
							<span class="text-text-muted">(אופציונלי)</span>
						{/if}
					</span>
					{#if ing.ingredientId}
						<form
							method="POST"
							action="?/addToShoppingList"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										addedItems[ing.id] = true;
										setTimeout(() => { addedItems[ing.id] = false; }, 1500);
									}
									await update({ reset: false });
								};
							}}
							class="shrink-0"
						>
							<input type="hidden" name="ingredientId" value={ing.ingredientId} />
							<input type="hidden" name="quantity" value={ing.quantity ? ing.quantity * servingsMultiplier : ''} />
							<input type="hidden" name="unit" value={ing.unit || ''} />
							<input type="hidden" name="aisleCategoryId" value={ing.aisleCategoryId || ''} />
							<input type="hidden" name="variantId" value={selectedVariants[ing.id] || ''} />
							<button class="flex h-6 w-6 items-center justify-center rounded-full transition-colors {addedItems[ing.id] ? 'bg-accent text-white' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}">
								{#if addedItems[ing.id]}
									<Check size={14} />
								{:else}
									<Plus size={14} />
								{/if}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<!-- Instructions -->
	{#if data.recipe.instructions && data.recipe.instructions.length > 0}
		<div class="mt-6">
			<h2 class="mb-3 text-lg font-bold">הוראות הכנה</h2>
			<ol class="space-y-3">
				{#each data.recipe.instructions as step, i}
					<li class="flex gap-3 text-sm">
						<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
						<p class="pt-0.5">{step}</p>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<!-- Actions -->
	<div class="mt-8 flex gap-3 border-t border-border pt-4">
		<a href="/shopping?add={data.recipe.id}" class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent/90">
			<ShoppingCart size={16} />
			הוסף הכל לרשימה
		</a>
		<a href="/recipes/{data.recipe.id}/edit" class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted transition hover:bg-surface-warm">
			<Pencil size={16} />
		</a>
		<form method="POST" action="?/delete" use:enhance={() => ({ result }) => { if (result.type === 'redirect') window.location.href = '/recipes'; }}>
			<button class="rounded-lg border border-danger/30 px-4 py-2.5 text-sm text-danger transition hover:bg-danger/10">
				<Trash2 size={16} />
			</button>
		</form>
	</div>
</div>
