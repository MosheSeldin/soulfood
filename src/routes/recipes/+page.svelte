<script lang="ts">
	import { formatTime } from '$lib/utils/helpers';
	import Plate from '$lib/components/Plate.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית', side: 'תוספת', soup: 'מרק', salad: 'סלט',
		dessert: 'קינוח', breakfast: 'ארוחת בוקר', snack: 'חטיף'
	};

	let searchQuery = $state('');
	let favoritesOnly = $state(false);
	let activeCategory = $state<string | null>(null);

	let categories = $derived(
		[...new Set(data.recipes.map((r) => r.category).filter(Boolean))] as string[]
	);

	let filteredRecipes = $derived(
		data.recipes.filter((r) => {
			if (favoritesOnly && !r.isFavorite) return false;
			if (activeCategory && r.category !== activeCategory) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				const hay = `${r.titleHe ?? ''} ${r.title ?? ''} ${r.cuisine ?? ''}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		})
	);

	function metaParts(r: (typeof data.recipes)[number]): string[] {
		return [
			r.totalTimeMinutes ? `◷ ${formatTime(r.totalTimeMinutes)}` : null,
			r.servings ? `${r.servings} מנות` : null,
			r.cuisine || null
		].filter(Boolean) as string[];
	}
</script>

<div class="page library fade">
	<div class="lib-head">
		<div>
			<p class="kicker">L’Index · {data.recipes.length} recettes</p>
			<h2 class="lib-title">המתכונים שלי</h2>
		</div>
		<a href="/recipes/import" class="btn rubric">＋ ייבא מתכון</a>
	</div>

	<svg class="wavy" viewBox="0 0 300 8" preserveAspectRatio="none">
		<path
			d="M0 4 Q 15 0 30 4 T 60 4 T 90 4 T 120 4 T 150 4 T 180 4 T 210 4 T 240 4 T 270 4 T 300 4"
			stroke="currentColor"
			fill="none"
			stroke-width="1.2"
		/>
	</svg>

	{#if data.recipes.length === 0}
		<p class="empty hand">המחברת עדיין ריקה — הוסיפו מתכון ראשון…</p>
	{:else}
		<div class="lib-tools">
			<div class="lib-search">
				<span class="search-orn">⌕</span>
				<input class="field" bind:value={searchQuery} placeholder="חיפוש במחברת…" />
			</div>
			<div class="lib-chips">
				<button class="chip {favoritesOnly ? 'active' : ''}" onclick={() => (favoritesOnly = !favoritesOnly)}>
					♥ מועדפים
				</button>
				{#each categories as cat}
					<button
						class="chip {activeCategory === cat ? 'active' : ''}"
						onclick={() => (activeCategory = activeCategory === cat ? null : cat)}
					>
						{categoryLabels[cat] || cat}
					</button>
				{/each}
			</div>
		</div>

		<div class="lib-grid">
			{#each filteredRecipes as recipe, i (recipe.id)}
				<a class="rec-card sheet" href="/recipes/{recipe.id}">
					<span class="tape {i % 2 ? 'tr' : 'tl'}"></span>
					<Plate
						caption={recipe.titleHe || recipe.title}
						imageUrl={recipe.imageUrl}
						alt={recipe.titleHe || recipe.title}
						class="rec-plate"
					/>
					<div class="rec-body">
						<div class="rec-row">
							{#if recipe.category}
								<span class="kicker">{categoryLabels[recipe.category] || recipe.category}</span>
							{:else}
								<span></span>
							{/if}
							{#if recipe.isFavorite}<span class="rec-fav">♥</span>{/if}
						</div>
						<h3 class="rec-title">{recipe.titleHe || recipe.title}</h3>
						{#if recipe.titleHe && recipe.title}
							<p class="rec-lat title-script">{recipe.title}</p>
						{/if}
						{#if metaParts(recipe).length}
							<div class="rec-meta">
								{#each metaParts(recipe) as p, idx}
									{#if idx > 0}<span class="dot">·</span>{/if}
									<span>{p}</span>
								{/each}
							</div>
						{/if}
					</div>
				</a>
			{/each}
			{#if filteredRecipes.length === 0}
				<p class="empty hand">לא נמצא מתכון תואם…</p>
			{/if}
		</div>
	{/if}
</div>
