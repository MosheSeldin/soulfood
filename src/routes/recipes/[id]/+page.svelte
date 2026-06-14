<script lang="ts">
	import { enhance } from '$app/forms';
	import Plate from '$lib/components/Plate.svelte';
	import { formatTime } from '$lib/utils/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Track which ingredients were just added to the shopping list (visual feedback)
	let addedItems = $state<Record<string, boolean>>({});

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית', side: 'תוספת', soup: 'מרק', salad: 'סלט',
		dessert: 'קינוח', breakfast: 'ארוחת בוקר', snack: 'חטיף'
	};

	let servingsMultiplier = $state(1);
	let currentServings = $derived(
		data.recipe.servings ? data.recipe.servings * servingsMultiplier : null
	);

	// Track selected variant per ingredient (keyed by recipeIngredient ID)
	let selectedVariants = $state<Record<string, string>>({});

	function getDisplayName(ing: (typeof data.ingredients)[0]): string {
		const variants = ing.variants;
		if (!variants || variants.length === 0) {
			return ing.ingredientNameHe || ing.ingredientName || '';
		}
		const selectedId = selectedVariants[ing.id];
		if (selectedId) {
			const v = variants.find((v) => v.variantId === selectedId);
			if (v) return v.nameHe || v.name;
		}
		return variants[0].nameHe || variants[0].name;
	}

	function adjustServings(delta: number) {
		const newVal = servingsMultiplier + delta * 0.5;
		if (newVal >= 0.5) servingsMultiplier = newVal;
	}

	function frac(qty: number | null): string {
		if (qty === null) return '';
		const adjusted = qty * servingsMultiplier;
		if (adjusted === Math.floor(adjusted)) return adjusted.toString();
		const f = adjusted - Math.floor(adjusted);
		const whole = Math.floor(adjusted);
		if (Math.abs(f - 0.5) < 0.01) return whole ? `${whole}½` : '½';
		if (Math.abs(f - 0.25) < 0.01) return whole ? `${whole}¼` : '¼';
		if (Math.abs(f - 0.75) < 0.01) return whole ? `${whole}¾` : '¾';
		if (Math.abs(f - 0.33) < 0.05) return whole ? `${whole}⅓` : '⅓';
		if (Math.abs(f - 0.67) < 0.05) return whole ? `${whole}⅔` : '⅔';
		return adjusted.toFixed(1);
	}

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', oz: "אונ'", lb: 'ליברה',
		piece: "יח'", clove: 'שן', package: 'חבילה', can: 'פחית', bunch: 'אגודה'
	};

	let title = $derived(data.recipe.titleHe || data.recipe.title);
	let metaTop = $derived(
		[data.recipe.category ? categoryLabels[data.recipe.category] || data.recipe.category : null, data.recipe.cuisine]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<div class="page recipe fade">
	<a class="back" href="/recipes">→ חזרה למתכונים</a>

	<div class="rec-spread">
		<div class="rec-hero">
			<div class="rec-plate-wrap">
				<span class="tape tl"></span><span class="tape tr"></span>
				<Plate caption={title} imageUrl={data.recipe.imageUrl} alt={title} class="hero-plate" />
				<p class="plate-cap hand">{title}</p>
			</div>
		</div>

		<div class="rec-intro">
			{#if metaTop}<p class="kicker">{metaTop}</p>{/if}
			<h1 class="rec-h1">{title}</h1>
			{#if data.recipe.titleHe && data.recipe.title}
				<p class="rec-h1-lat title-script">{data.recipe.title}</p>
			{/if}
			<div class="rec-meta-row">
				{#if data.recipe.totalTimeMinutes}
					<span class="meta-pill">◷ {formatTime(data.recipe.totalTimeMinutes)}</span>
				{/if}
				{#if data.recipe.servings}
					<span class="meta-pill">{data.recipe.servings} מנות</span>
				{/if}
				{#if data.recipe.sourceUrl}
					<a class="meta-pill" href={data.recipe.sourceUrl} target="_blank" rel="noopener">מקור ↗</a>
				{/if}
				<form method="POST" action="?/toggleFavorite" use:enhance>
					<button class="meta-fav {data.recipe.isFavorite ? 'on' : ''}" aria-label="מועדף">♥</button>
				</form>
			</div>
			{#if data.recipe.description}
				<p class="rec-desc dropcap">{data.recipe.description}</p>
			{/if}
		</div>
	</div>

	<div class="fleuron rec-div"><span>❧</span></div>

	<div class="rec-cols">
		<section class="col-ing">
			<div class="col-head">
				<h2 class="col-h2">מצרכים</h2>
				{#if data.recipe.servings}
					<div class="serv">
						<button class="stamp" onclick={() => adjustServings(-1)} aria-label="פחות מנות">−</button>
						<span class="serv-n">{frac(data.recipe.servings)}<i>מנות</i></span>
						<button class="stamp" onclick={() => adjustServings(1)} aria-label="עוד מנות">＋</button>
					</div>
				{/if}
			</div>

			<ul class="ing-list ruled">
				{#each data.ingredients as ing}
					<li class="ing">
						<span class="ing-q">
							{#if ing.quantity}{frac(ing.quantity)} {ing.unit ? unitLabels[ing.unit] || ing.unit : ''}{/if}
						</span>
						<span class="ing-n">
							{#if ing.variants && ing.variants.length > 1}
								<select
									class="ing-variant"
									value={selectedVariants[ing.id] || ing.variants[0].variantId}
									onchange={(e) => (selectedVariants[ing.id] = (e.target as HTMLSelectElement).value)}
								>
									{#each ing.variants as v}
										<option value={v.variantId}>{v.nameHe || v.name}</option>
									{/each}
								</select>
							{:else}
								{getDisplayName(ing)}
							{/if}
							{#if ing.preparation}<i class="ing-prep">, {ing.preparation}</i>{/if}
							{#if ing.isOptional}<i class="ing-prep"> (לפי הטעם)</i>{/if}
						</span>
						{#if ing.ingredientId}
							<form
								method="POST"
								action="?/addToShoppingList"
								style="display: contents"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'success') {
											addedItems[ing.id] = true;
											setTimeout(() => (addedItems[ing.id] = false), 1500);
										}
										await update({ reset: false });
									};
								}}
							>
								<input type="hidden" name="ingredientId" value={ing.ingredientId} />
								<input type="hidden" name="quantity" value={ing.quantity ? ing.quantity * servingsMultiplier : ''} />
								<input type="hidden" name="unit" value={ing.unit || ''} />
								<input type="hidden" name="aisleCategoryId" value={ing.aisleCategoryId || ''} />
								<input type="hidden" name="variantId" value={selectedVariants[ing.id] || ''} />
								<button class="ing-add" title="הוסף לרשימה" aria-label="הוסף לרשימה">
									{addedItems[ing.id] ? '✓' : '＋'}
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		{#if data.recipe.instructions && data.recipe.instructions.length > 0}
			<section class="col-method">
				<h2 class="col-h2">אופן ההכנה</h2>
				<ol class="step-list">
					{#each data.recipe.instructions as step, i}
						<li class="step">
							<span class="step-n">{i + 1}</span>
							<p class="step-t">{step}</p>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>

	<div class="rec-foot">
		<div class="rec-foot-actions">
			<a href="/shopping?add={data.recipe.id}" class="btn rubric">＋ הוסף הכול לרשימת השוק</a>
			<a href="/recipes/{data.recipe.id}/edit" class="btn ghost">עריכה</a>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => ({ result }) => {
					if (result.type === 'redirect') window.location.href = '/recipes';
				}}
			>
				<button class="btn ghost btn-del">מחיקה</button>
			</form>
		</div>
		<span class="folio">— Soul Food —</span>
	</div>
</div>

<style>
	.ing-variant {
		font-family: var(--serif);
		font-size: 1.06rem;
		color: var(--rubric);
		background: transparent;
		border: 0;
		border-bottom: 1px dashed var(--rubric);
		padding: 0 0.1em;
		cursor: pointer;
	}
	.ing-variant:focus {
		outline: none;
		border-bottom-style: solid;
	}
	.rec-foot-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
	}
	.btn-del {
		color: var(--color-danger);
		border-color: rgba(168, 67, 47, 0.4);
	}
	.btn-del:hover {
		background: rgba(168, 67, 47, 0.08);
	}
</style>
