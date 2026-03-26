<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Check, X, Search, Trash2, Merge, Tag } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editNameHe = $state('');
	let editAisleCategoryId = $state('');
	let addedItems = $state<Record<string, boolean>>({});
	let mergingId = $state<string | null>(null);
	let mergeTargetId = $state('');
	let expandedVariants = $state<Record<string, boolean>>({});
	let addingVariantFor = $state<string | null>(null);
	let newVariantName = $state('');
	let newVariantNameHe = $state('');

	let filteredIngredients = $derived(
		data.ingredients.filter((ing) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				ing.name.toLowerCase().includes(q) ||
				(ing.nameHe?.toLowerCase().includes(q)) ||
				ing.variants.some(v => v.name.includes(q) || (v.nameHe?.includes(q) ?? false))
			);
		})
	);

	type Ingredient = typeof data.ingredients[0];

	let groupedByAisle = $derived(() => {
		const groups = new Map<string, { label: string; items: Ingredient[] }>();
		for (const ing of filteredIngredients) {
			const key = ing.aisleCategoryId || '__none__';
			const label = ing.aisleNameHe || ing.aisleName || 'ללא מדור';
			if (!groups.has(key)) groups.set(key, { label, items: [] });
			groups.get(key)!.items.push(ing);
		}
		// Sort groups: aisles with sortOrder first (via aisleCategories order), then unassigned last
		const aisleOrder = new Map(data.aisleCategories.map((a, i) => [a.id, i]));
		return [...groups.entries()]
			.sort(([a], [b]) => {
				if (a === '__none__') return 1;
				if (b === '__none__') return -1;
				return (aisleOrder.get(a) ?? 99) - (aisleOrder.get(b) ?? 99);
			})
			.map(([, group]) => group);
	});

	function startEdit(ing: typeof data.ingredients[0]) {
		editingId = ing.id;
		editName = ing.name;
		editNameHe = ing.nameHe || '';
		editAisleCategoryId = ing.aisleCategoryId || '';
		mergingId = null;
	}

	function cancelEdit() {
		editingId = null;
		mergingId = null;
	}

	function startMerge(ing: typeof data.ingredients[0]) {
		mergingId = ing.id;
		mergeTargetId = '';
		editingId = null;
	}

	function cancelMerge() {
		mergingId = null;
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">בנק מצרכים</h2>
		<div class="flex items-center gap-2">
			<a
				href="/aisles"
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:bg-surface-warm transition-colors"
			>
				ניהול מדורים
			</a>
			<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
				{data.ingredients.length}
			</span>
		</div>
	</div>

	<!-- Search -->
	<div class="relative mb-4">
		<Search size={16} class="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="חיפוש מצרך..."
			class="w-full rounded-lg border border-border bg-white py-2.5 pe-3 ps-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		/>
		{#if searchQuery}
			<button
				onclick={() => { searchQuery = ''; }}
				class="absolute end-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
			>
				<X size={16} />
			</button>
		{/if}
	</div>

	<!-- Ingredient list grouped by aisle -->
	{#if filteredIngredients.length === 0}
		<p class="mt-8 text-center text-text-muted">
			{searchQuery ? 'לא נמצאו מצרכים' : 'אין מצרכים במאגר'}
		</p>
	{:else}
		{#each groupedByAisle() as group}
			<div class="mb-4">
				<h3 class="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
					{group.label}
					<span class="ms-1 font-normal normal-case">({group.items.length})</span>
				</h3>
				<div class="space-y-1">
			{#each group.items as ing}
				<div class="rounded-lg border border-border bg-white px-3 py-2.5 {ing.usageCount === 0 ? 'border-dashed opacity-70' : ''}">
					{#if editingId === ing.id}
						<!-- Edit mode -->
						<form
							method="POST"
							action="?/updateIngredient"
							use:enhance={() => {
								return async ({ update }) => {
									editingId = null;
									await update();
								};
							}}
							class="space-y-2"
						>
							<input type="hidden" name="ingredientId" value={ing.id} />
							<div class="flex gap-2">
								<input
									type="text"
									name="nameHe"
									bind:value={editNameHe}
									placeholder="שם בעברית"
									class="flex-1 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
								/>
								<input
									type="text"
									name="name"
									bind:value={editName}
									placeholder="English name"
									class="flex-1 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
								/>
							</div>
							<div class="flex items-center gap-2">
								<select
									name="aisleCategoryId"
									bind:value={editAisleCategoryId}
									class="flex-1 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
								>
									<option value="">ללא מדור</option>
									{#each data.aisleCategories as aisle}
										<option value={aisle.id}>{aisle.nameHe || aisle.name}</option>
									{/each}
								</select>
								<button type="submit" class="rounded bg-accent p-1.5 text-white">
									<Check size={14} />
								</button>
								<button type="button" onclick={cancelEdit} class="rounded border border-border p-1.5 text-text-muted">
									<X size={14} />
								</button>
							</div>
						</form>

					{:else if mergingId === ing.id}
						<!-- Merge mode -->
						<form
							method="POST"
							action="?/mergeIngredient"
							use:enhance={() => {
								return async ({ update }) => {
									mergingId = null;
									mergeTargetId = '';
									await update();
								};
							}}
							class="space-y-2"
						>
							<input type="hidden" name="fromId" value={ing.id} />
							<p class="text-xs text-text-muted">מיזוג <strong>{ing.nameHe || ing.name}</strong> לתוך:</p>
							<div class="flex items-center gap-2">
								<select
									name="toId"
									bind:value={mergeTargetId}
									class="flex-1 rounded border border-border px-2 py-1 text-sm focus:border-primary focus:outline-none"
									required
								>
									<option value="">בחר מצרך יעד...</option>
									{#each data.ingredients.filter(i => i.id !== ing.id) as target}
										<option value={target.id}>{target.nameHe || target.name}</option>
									{/each}
								</select>
								<button
									type="submit"
									disabled={!mergeTargetId}
									class="rounded bg-orange-500 px-2 py-1.5 text-xs text-white disabled:opacity-40"
								>
									מזג
								</button>
								<button type="button" onclick={cancelMerge} class="rounded border border-border p-1.5 text-text-muted">
									<X size={14} />
								</button>
							</div>
						</form>

					{:else}
						<!-- Display mode -->
						<div class="flex items-center gap-2">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-1.5 flex-wrap">
									<span class="text-sm font-medium">{ing.nameHe || ing.name}</span>
									{#if ing.nameHe && ing.name}
										<span class="text-xs text-text-muted">{ing.name}</span>
									{/if}
									{#if ing.usageCount > 0}
										<span class="text-xs text-text-muted">×{ing.usageCount}</span>
									{/if}
								</div>

								<!-- Variants row -->
								{#if ing.variants.length > 0 || addingVariantFor === ing.id}
									<div class="mt-1.5 flex flex-wrap items-center gap-1">
										{#each ing.variants as variant}
											<span class="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-2 py-0.5 text-xs text-primary">
												{variant.nameHe || variant.name}
												<form method="POST" action="?/deleteVariant" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="inline">
													<input type="hidden" name="variantId" value={variant.id} />
													<button type="submit" class="hover:text-red-500 ms-0.5">
														<X size={10} />
													</button>
												</form>
											</span>
										{/each}

										{#if addingVariantFor === ing.id}
											<form
												method="POST"
												action="?/addVariant"
												use:enhance={() => async ({ update }) => {
													addingVariantFor = null;
													newVariantName = '';
													newVariantNameHe = '';
													await update({ reset: false });
												}}
												class="flex items-center gap-1"
											>
												<input type="hidden" name="ingredientId" value={ing.id} />
												<input
													type="text"
													name="variantNameHe"
													bind:value={newVariantNameHe}
													placeholder="עברית"
													autofocus
													class="w-20 rounded border border-primary px-1.5 py-0.5 text-xs focus:outline-none"
												/>
												<input
													type="text"
													name="variantName"
													bind:value={newVariantName}
													placeholder="English"
													class="w-20 rounded border border-border px-1.5 py-0.5 text-xs focus:outline-none"
												/>
												<button type="submit" class="text-accent">
													<Check size={12} />
												</button>
												<button type="button" onclick={() => { addingVariantFor = null; }} class="text-text-muted">
													<X size={12} />
												</button>
											</form>
										{:else}
											<button
												onclick={() => { addingVariantFor = ing.id; newVariantName = ''; newVariantNameHe = ''; }}
												class="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-text-muted hover:border-primary hover:text-primary"
											>
												<Plus size={9} />
												גרסה
											</button>
										{/if}
									</div>
								{:else}
									<button
										onclick={() => { addingVariantFor = ing.id; newVariantName = ''; newVariantNameHe = ''; }}
										class="mt-1 inline-flex items-center gap-0.5 text-xs text-text-muted hover:text-primary"
									>
										<Tag size={10} />
										הוסף גרסה
									</button>
								{/if}
							</div>

							<!-- Action buttons -->
							<div class="flex shrink-0 items-center gap-0.5">
								<button
									onclick={() => startEdit(ing)}
									class="p-1 text-text-muted hover:text-primary transition-colors"
									title="ערוך"
								>
									<Pencil size={14} />
								</button>
								<button
									onclick={() => startMerge(ing)}
									class="p-1 text-text-muted hover:text-orange-500 transition-colors"
									title="מזג עם מצרך אחר"
								>
									<Merge size={14} />
								</button>
								{#if ing.usageCount === 0}
									<form
										method="POST"
										action="?/deleteIngredient"
										use:enhance={() => async ({ update }) => { await update(); }}
									>
										<input type="hidden" name="ingredientId" value={ing.id} />
										<button
											type="submit"
											class="p-1 text-text-muted hover:text-red-500 transition-colors"
											title="מחק"
											onclick={(e) => { if (!confirm('למחוק את המצרך?')) e.preventDefault(); }}
										>
											<Trash2 size={14} />
										</button>
									</form>
								{/if}
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
								>
									<input type="hidden" name="ingredientId" value={ing.id} />
									<input type="hidden" name="aisleCategoryId" value={ing.aisleCategoryId || ''} />
									<input type="hidden" name="defaultUnit" value={ing.defaultUnit || ''} />
									<button class="flex h-7 w-7 items-center justify-center rounded-full transition-colors {addedItems[ing.id] ? 'bg-accent text-white' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}">
										{#if addedItems[ing.id]}
											<Check size={14} />
										{:else}
											<Plus size={14} />
										{/if}
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
