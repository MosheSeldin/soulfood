<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Plus, Trash2, ChevronDown, ChevronLeft, X } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let customItemName = $state('');
	let collapsedAisles = $state(new Set<string>());

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', oz: 'אונ\'', lb: 'ליברה',
		piece: 'יח\'', clove: 'שן', package: 'חבילה', can: 'פחית'
	};

	function toggleAisle(id: string) {
		const next = new Set(collapsedAisles);
		if (next.has(id)) next.delete(id); else next.add(id);
		collapsedAisles = next;
	}

	function formatQty(qty: number | null): string {
		if (qty === null) return '';
		if (qty === Math.floor(qty)) return qty.toString();
		const frac = qty - Math.floor(qty);
		const whole = Math.floor(qty);
		if (Math.abs(frac - 0.5) < 0.01) return whole ? `${whole}½` : '½';
		if (Math.abs(frac - 0.25) < 0.01) return whole ? `${whole}¼` : '¼';
		if (Math.abs(frac - 0.75) < 0.01) return whole ? `${whole}¾` : '¾';
		return qty.toFixed(1);
	}
</script>

<div class="mx-auto max-w-lg">
	<!-- Header with progress -->
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">רשימת קניות</h2>
		{#if data.totalItems > 0}
			<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
				{data.checkedItems}/{data.totalItems}
			</span>
		{/if}
	</div>

	<!-- Progress bar -->
	{#if data.totalItems > 0}
		<div class="mb-4 h-2 overflow-hidden rounded-full bg-border">
			<div
				class="h-full rounded-full bg-accent transition-all duration-300"
				style="width: {(data.checkedItems / data.totalItems) * 100}%"
			></div>
		</div>
	{/if}

	<!-- Recipes on this list -->
	{#if data.listRecipes.length > 0}
		<div class="mb-4 flex flex-wrap gap-1.5">
			{#each data.listRecipes as recipe}
				<form method="POST" action="?/removeRecipe" use:enhance>
					<input type="hidden" name="recipeId" value={recipe.recipeId} />
					<button class="flex items-center gap-1 rounded-full bg-surface-warm px-2.5 py-1 text-xs text-text-muted hover:bg-border">
						{recipe.titleHe || recipe.title}
						<X size={12} />
					</button>
				</form>
			{/each}
		</div>
	{/if}

	<!-- Shopping items by aisle -->
	{#if data.aisles.length === 0}
		<div class="mt-12 text-center">
			<p class="text-text-muted">הרשימה ריקה</p>
			<a href="/recipes" class="mt-2 inline-block text-sm text-primary hover:text-primary-dark">
				בחר מתכונים לבישול
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each data.aisles as aisle}
				<div class="overflow-hidden rounded-xl border border-border bg-white">
					<!-- Aisle header -->
					<button
						onclick={() => toggleAisle(aisle.id)}
						class="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold hover:bg-surface-warm"
					>
						<span>{aisle.name}</span>
						<span class="flex items-center gap-2 text-text-muted">
							<span class="text-xs">{aisle.items.filter(i => !i.isChecked).length}</span>
							{#if collapsedAisles.has(aisle.id)}
								<ChevronLeft size={16} />
							{:else}
								<ChevronDown size={16} />
							{/if}
						</span>
					</button>

					{#if !collapsedAisles.has(aisle.id)}
						<div class="border-t border-border">
							{#each aisle.items.sort((a, b) => (a.isChecked ? 1 : 0) - (b.isChecked ? 1 : 0)) as item}
								<div class="border-b border-border/50 last:border-b-0">
									<form method="POST" action="?/toggleItem" use:enhance>
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="isChecked" value={String(item.isChecked)} />
										<button
											class="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-surface {item.isChecked ? 'bg-surface/50' : ''}"
											style="min-height: 48px"
										>
											<!-- Checkbox -->
											<span
												class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors {item.isChecked ? 'border-accent bg-accent' : 'border-border'}"
											>
												{#if item.isChecked}
													<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
												{/if}
											</span>

											<!-- Content -->
											<span class="flex-1 text-sm {item.isChecked ? 'shopping-item-checked' : ''}">
												{#if item.quantity}
													<strong class="font-semibold">{formatQty(item.quantity)}</strong>
													{#if item.unit}
														{unitLabels[item.unit] || item.unit}
													{/if}
												{/if}
												{#if item.variantNameHe || item.variantName}
													{item.variantNameHe || item.variantName}
												{:else}
													{item.customName || item.ingredientNameHe || item.ingredientName || ''}
												{/if}
											</span>
										</button>
									</form>

									<!-- Variant selector for items with available variants but no chosen variant -->
									{#if item.availableVariants.length > 1 && !item.chosenVariantId && !item.isChecked}
										<div class="flex flex-wrap gap-1 px-4 pb-2">
											{#each item.availableVariants as variant}
												<form method="POST" action="?/chooseVariant" use:enhance>
													<input type="hidden" name="itemId" value={item.id} />
													<input type="hidden" name="variantId" value={variant.id} />
													<button class="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/15">
														{variant.nameHe || variant.name}
													</button>
												</form>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add custom item -->
	<form method="POST" action="?/addCustomItem" use:enhance class="mt-4 flex gap-2">
		<input
			type="text"
			name="name"
			bind:value={customItemName}
			placeholder="הוסף פריט..."
			class="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		/>
		<button
			type="submit"
			disabled={!customItemName.trim()}
			class="rounded-lg bg-primary px-3 py-2.5 text-white transition hover:bg-primary-dark disabled:opacity-50"
		>
			<Plus size={18} />
		</button>
	</form>

	<!-- Actions -->
	{#if data.totalItems > 0}
		<div class="mt-4 flex gap-2">
			{#if data.checkedItems > 0}
				<form method="POST" action="?/clearChecked" use:enhance class="flex-1">
					<button class="w-full rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-surface-warm">
						הסר מסומנים ({data.checkedItems})
					</button>
				</form>
			{/if}
			<form method="POST" action="?/clearAll" use:enhance class="flex-1">
				<button class="flex w-full items-center justify-center gap-1 rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger hover:bg-danger/10">
					<Trash2 size={14} />
					נקה הכל
				</button>
			</form>
		</div>
	{/if}
</div>
