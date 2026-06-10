<script lang="ts">
	import { Plus, Clock, Heart, UtensilsCrossed, Search, X } from 'lucide-svelte';
	import { formatTime } from '$lib/utils/helpers';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית',
		side: 'תוספת',
		soup: 'מרק',
		salad: 'סלט',
		dessert: 'קינוח',
		breakfast: 'בוקר',
		snack: 'חטיף'
	};

	let searchQuery = $state('');
	let favoritesOnly = $state(false);
	let activeCategory = $state<string | null>(null);

	// categories actually present, for the filter chips
	let categories = $derived([...new Set(data.recipes.map((r) => r.category).filter(Boolean))] as string[]);

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
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">המתכונים שלי</h2>
		<div class="flex gap-2">
			<a
				href="/recipes/import"
				class="btn-primary flex items-center gap-1.5"
			>
				<Plus size={16} />
				ייבא מתכון
			</a>
		</div>
	</div>

	{#if data.recipes.length === 0}
		<div class="mt-12 text-center">
			<div class="logo-ring mx-auto inline-flex">
				<UtensilsCrossed size={48} class="text-text-muted" />
			</div>
			<p class="mt-6 text-text-muted">עדיין אין מתכונים</p>
			<a
				href="/recipes/import"
				class="btn-primary mt-3 inline-flex items-center gap-1.5"
			>
				<Plus size={16} />
				הוסף מתכון ראשון
			</a>
		</div>
	{:else}
		<!-- Search + filters -->
		<div class="mb-3 space-y-2">
			<div class="relative">
				<Search size={16} class="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="חיפוש מתכון..."
					class="input-glass w-full pe-3 ps-9"
				/>
				{#if searchQuery}
					<button onclick={() => (searchQuery = '')} class="absolute end-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
						<X size={16} />
					</button>
				{/if}
			</div>
			<div class="flex flex-wrap gap-1.5">
				<button
					onclick={() => (favoritesOnly = !favoritesOnly)}
					class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors {favoritesOnly ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text'}"
				>
					<Heart size={12} class={favoritesOnly ? 'fill-primary' : ''} />
					מועדפים
				</button>
				{#each categories as cat}
					<button
						onclick={() => (activeCategory = activeCategory === cat ? null : cat)}
						class="rounded-full border px-2.5 py-1 text-xs transition-colors {activeCategory === cat ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text'}"
					>
						{categoryLabels[cat] || cat}
					</button>
				{/each}
			</div>
		</div>

		{#if filteredRecipes.length === 0}
			<p class="mt-8 text-center text-text-muted">לא נמצאו מתכונים תואמים</p>
		{/if}

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredRecipes as recipe}
				<a
					href="/recipes/{recipe.id}"
					class="glass-card glass-card-hover group overflow-hidden"
				>
					{#if recipe.imageUrl}
						<img
							src={recipe.imageUrl}
							alt={recipe.titleHe || recipe.title}
							class="h-40 w-full object-cover"
						/>
					{:else}
						<div class="flex h-40 items-center justify-center bg-surface-warm/30">
							<UtensilsCrossed size={32} class="text-text-muted/40" />
						</div>
					{/if}
					<div class="p-3">
						<h3 class="font-semibold transition-colors group-hover:text-primary">
							{recipe.titleHe || recipe.title}
						</h3>
						<div class="mt-1.5 flex items-center gap-3 text-xs text-text-muted">
							{#if recipe.category}
								<span>{categoryLabels[recipe.category] || recipe.category}</span>
							{/if}
							{#if recipe.totalTimeMinutes}
								<span class="flex items-center gap-0.5">
									<Clock size={12} />
									{formatTime(recipe.totalTimeMinutes)}
								</span>
							{/if}
							{#if recipe.isFavorite}
								<Heart size={12} class="fill-primary text-primary" />
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
