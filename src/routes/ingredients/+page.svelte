<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Check, X, Search, Trash2, Merge, ScanSearch, ChevronDown } from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let searchQuery = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editNameHe = $state('');
	let editAisleCategoryId = $state('');
	let addedItems = $state<Record<string, boolean>>({});
	let selectedVariants = $state<Record<string, string>>({});
	let mergingId = $state<string | null>(null);
	let mergeTargetId = $state('');
	let addingVariantFor = $state<string | null>(null);
	let newVariantName = $state('');
	let newVariantNameHe = $state('');

	// Dedup state
	type DupGroup = { baseKey: string; suggestedCanonicalId: string; members: { id: string; name: string; nameHe: string | null; usageCount: number }[] };
	let dupGroups = $state<DupGroup[]>([]);
	let dupCanonicals = $state<Record<string, string>>({});  // baseKey → chosen canonicalId
	let detectingDups = $state(false);
	let expandedDupGroup = $state<string | null>(null);

	$effect(() => {
		if (form?.duplicateGroups) {
			dupGroups = form.duplicateGroups as DupGroup[];
			dupCanonicals = Object.fromEntries(
				(form.duplicateGroups as DupGroup[]).map((g: DupGroup) => [g.baseKey, g.suggestedCanonicalId])
			);
			expandedDupGroup = dupGroups[0]?.baseKey || null;
		}
		if (form?.mergedCount !== undefined) {
			dupGroups = [];
		}
	});

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
			<a href="/aisles" class="btn-ghost px-3 py-1.5 text-xs">ניהול מדורים</a>
			<form method="POST" action="?/detectDuplicates" use:enhance={() => {
				detectingDups = true;
				return async ({ update }) => { detectingDups = false; await update({ reset: false }); };
			}}>
				<button type="submit" class="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs {dupGroups.length > 0 ? 'text-orange-400' : ''}" title="זיהוי כפילויות">
					<ScanSearch size={13} />
					{#if dupGroups.length > 0}
						{dupGroups.length} כפולים
					{:else}
						{detectingDups ? '...' : 'זיהוי כפילויות'}
					{/if}
				</button>
			</form>
			<span class="glass-card px-3 py-1 text-sm font-medium text-primary">
				{data.ingredients.length}
			</span>
		</div>
	</div>

	<!-- Duplicate Groups Panel -->
	{#if dupGroups.length > 0}
		<div class="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
			<p class="mb-2 text-xs font-semibold text-orange-400">
				נמצאו {dupGroups.length} קבוצות של כפילויות אפשריות — מזג כל קבוצה לכדי מצרך אחד עם גרסאות
			</p>
			<div class="space-y-2">
				{#each dupGroups as group (group.baseKey)}
					<div class="glass-card p-2.5">
						<button
							onclick={() => { expandedDupGroup = expandedDupGroup === group.baseKey ? null : group.baseKey; }}
							class="flex w-full items-center justify-between text-sm font-medium"
						>
							<span>{group.members.find(m => m.id === (dupCanonicals[group.baseKey] || group.suggestedCanonicalId))?.nameHe || group.baseKey}</span>
							<span class="flex items-center gap-1 text-xs text-text-muted">
								{group.members.length} מצרכים
								<ChevronDown size={12} class="transition-transform {expandedDupGroup === group.baseKey ? 'rotate-180' : ''}" />
							</span>
						</button>

						{#if expandedDupGroup === group.baseKey}
							<div class="mt-2 space-y-1">
								{#each group.members as member}
									<label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white/5">
										<input
											type="radio"
											name="canonical_{group.baseKey}"
											value={member.id}
											checked={dupCanonicals[group.baseKey] === member.id || (!dupCanonicals[group.baseKey] && member.id === group.suggestedCanonicalId)}
											onchange={() => { dupCanonicals[group.baseKey] = member.id; }}
											class="accent-accent"
										/>
										<span class="flex-1 text-xs">{member.nameHe || member.name}</span>
										{#if member.name && member.nameHe}
											<span class="text-xs text-text-muted">{member.name}</span>
										{/if}
										<span class="text-xs text-text-muted">×{member.usageCount}</span>
									</label>
								{/each}

								<form method="POST" action="?/autoMergeDuplicates" use:enhance={() => async ({ update }) => {
									dupGroups = dupGroups.filter(g => g.baseKey !== group.baseKey);
									await update({ reset: false });
								}}>
									<input type="hidden" name="canonicalId" value={dupCanonicals[group.baseKey] || group.suggestedCanonicalId} />
									<input type="hidden" name="memberIds" value={JSON.stringify(group.members.map(m => m.id))} />
									<button
										type="submit"
										class="mt-1 w-full rounded bg-orange-500/20 px-2 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30 transition-colors"
									>
										מזג קבוצה זו
									</button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Search -->
	<div class="relative mb-4">
		<Search size={16} class="absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" />
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="חיפוש מצרך..."
			class="input-glass w-full pe-3 ps-9"
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
				<h3 class="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-primary">
					{group.label}
					<span class="ms-1 font-normal normal-case text-text-muted">({group.items.length})</span>
				</h3>
				<div class="space-y-1">
			{#each group.items as ing}
				<div class="glass-card px-3 py-2.5 {ing.usageCount === 0 ? 'border-dashed opacity-70' : ''}">
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
									class="input-glass flex-1 px-2 py-1"
								/>
								<input
									type="text"
									name="name"
									bind:value={editName}
									placeholder="English name"
									class="input-glass flex-1 px-2 py-1"
								/>
							</div>
							<div class="flex items-center gap-2">
								<select
									name="aisleCategoryId"
									bind:value={editAisleCategoryId}
									class="input-glass flex-1 px-2 py-1"
								>
									<option value="">ללא מדור</option>
									{#each data.aisleCategories as aisle}
										<option value={aisle.id}>{aisle.nameHe || aisle.name}</option>
									{/each}
								</select>
								<button type="submit" class="rounded bg-accent p-1.5 text-surface shadow-[0_0_8px_rgba(52,211,153,0.3)]">
									<Check size={14} />
								</button>
								<button type="button" onclick={cancelEdit} class="btn-ghost p-1.5">
									<X size={14} />
								</button>
							</div>
						</form>

						<!-- Variant management -->
						<div class="mt-2 border-t border-border/50 pt-2 space-y-1">
							<p class="text-xs text-text-muted mb-1">גרסאות</p>
							{#each ing.variants as variant}
								<div class="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
									<span class="flex-1 text-xs">{variant.nameHe || variant.name}</span>
									<form method="POST" action="?/deleteVariant" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="inline">
										<input type="hidden" name="variantId" value={variant.id} />
										<button type="submit" class="p-0.5 text-text-muted hover:text-danger transition-colors">
											<X size={12} />
										</button>
									</form>
								</div>
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
									class="flex items-center gap-1 pt-0.5"
								>
									<input type="hidden" name="ingredientId" value={ing.id} />
									<input type="text" name="variantNameHe" bind:value={newVariantNameHe} placeholder="עברית" autofocus class="input-glass flex-1 px-1.5 py-0.5 text-xs" />
									<input type="text" name="variantName" bind:value={newVariantName} placeholder="English" class="input-glass flex-1 px-1.5 py-0.5 text-xs" />
									<button type="submit" class="p-0.5 text-accent"><Check size={12} /></button>
									<button type="button" onclick={() => { addingVariantFor = null; }} class="p-0.5 text-text-muted"><X size={12} /></button>
								</form>
							{:else}
								<button
									onclick={() => { addingVariantFor = ing.id; newVariantName = ''; newVariantNameHe = ''; }}
									class="text-xs text-text-muted hover:text-primary transition-colors"
								>
									+ הוסף גרסה
								</button>
							{/if}
						</div>

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
									class="input-glass flex-1 px-2 py-1"
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
								<button type="button" onclick={cancelMerge} class="btn-ghost p-1.5">
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
									{#if ing.variants.length > 0}
										<span class="text-xs text-text-muted bg-primary/10 px-1.5 py-0.5 rounded-full">{ing.variants.length} גרסאות</span>
									{/if}
									{#if ing.usageCount > 0}
										<span class="text-xs text-text-muted">×{ing.usageCount}</span>
									{/if}
								</div>

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
											class="p-1 text-text-muted hover:text-danger transition-colors"
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
									class="flex items-center gap-1"
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
									{#if ing.variants.length > 1}
										<select
											name="variantId"
											bind:value={selectedVariants[ing.id]}
											class="input-glass cursor-pointer appearance-none pe-4 ps-1.5 py-0.5 text-xs font-medium text-primary"
										>
											<option value="">כל סוג</option>
											{#each ing.variants as v}
												<option value={v.id}>{v.nameHe || v.name}</option>
											{/each}
										</select>
									{/if}
									<button class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all {addedItems[ing.id] ? 'bg-accent text-surface glow-success' : 'text-text-muted hover:bg-primary/10 hover:text-primary'}">
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
