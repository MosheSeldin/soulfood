<script lang="ts">
	import { Plus, Clock, Heart, UtensilsCrossed } from 'lucide-svelte';
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
</script>

<div class="mx-auto max-w-4xl">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">המתכונים שלי</h2>
		<div class="flex gap-2">
			<a
				href="/recipes/import"
				class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
			>
				<Plus size={16} />
				ייבא מתכון
			</a>
		</div>
	</div>

	{#if data.recipes.length === 0}
		<div class="mt-12 text-center">
			<UtensilsCrossed size={48} class="mx-auto text-border" />
			<p class="mt-3 text-text-muted">עדיין אין מתכונים</p>
			<a
				href="/recipes/import"
				class="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
			>
				<Plus size={16} />
				הוסף מתכון ראשון
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.recipes as recipe}
				<a
					href="/recipes/{recipe.id}"
					class="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:shadow-md"
				>
					{#if recipe.imageUrl}
						<img
							src={recipe.imageUrl}
							alt={recipe.titleHe || recipe.title}
							class="h-40 w-full object-cover"
						/>
					{:else}
						<div class="flex h-40 items-center justify-center bg-surface-warm">
							<UtensilsCrossed size={32} class="text-border" />
						</div>
					{/if}
					<div class="p-3">
						<h3 class="font-semibold group-hover:text-primary">
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
