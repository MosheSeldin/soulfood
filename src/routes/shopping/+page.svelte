<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, ChevronDown, ChevronLeft, X, Pencil, Check } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let customItemName = $state('');
	let collapsedAisles = $state(new Set<string>());

	// Autocomplete state
	let searchResults = $state<Array<{ id: string; name: string; nameHe: string | null; aisleCategoryId: string | null; defaultUnit: string | null }>>([]);
	let selectedIngredient = $state<typeof searchResults[0] | null>(null);
	let addQuantity = $state('');
	let addUnit = $state('');
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	// Derived: existing item for selected ingredient
	let existingForSelected = $derived(selectedIngredient ? getExistingItemForIngredient(selectedIngredient.id) : null);

	// Inline editing state
	let editingItemId = $state<string | null>(null);
	let editQuantity = $state('');
	let editUnit = $state('');

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', oz: 'אונ\'', lb: 'ליברה',
		piece: 'יח\'', clove: 'שן', package: 'חבילה', can: 'פחית'
	};

	const unitOptions = ['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'piece', 'package', 'can'];

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

	async function searchIngredients(query: string) {
		if (query.length < 2) {
			searchResults = [];
			showDropdown = false;
			return;
		}
		const formData = new FormData();
		formData.set('q', query);
		const res = await fetch('?/searchIngredients', { method: 'POST', body: formData });
		const json = await res.json();
		// SvelteKit form action returns { type: 'success', data: ... }
		const actionData = json?.data ? JSON.parse(json.data) : null;
		searchResults = actionData?.results || [];
		showDropdown = searchResults.length > 0;
	}

	function onSearchInput() {
		selectedIngredient = null;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => searchIngredients(customItemName), 300);
	}

	function selectIngredient(ing: typeof searchResults[0]) {
		selectedIngredient = ing;
		customItemName = ing.nameHe || ing.name;
		addUnit = ing.defaultUnit || '';
		showDropdown = false;
		searchResults = [];
	}

	function clearSelection() {
		selectedIngredient = null;
		customItemName = '';
		addQuantity = '';
		addUnit = '';
		searchResults = [];
		showDropdown = false;
	}

	function getExistingItemForIngredient(ingredientId: string) {
		for (const aisle of data.aisles) {
			for (const item of aisle.items) {
				if (item.ingredientId === ingredientId) return item;
			}
		}
		return null;
	}

	function startEditItem(item: { id: string; quantity: number | null; unit: string | null }) {
		editingItemId = item.id;
		editQuantity = item.quantity?.toString() || '';
		editUnit = item.unit || '';
	}
</script>

<div class="mx-auto max-w-lg">
	<!-- Header with progress -->
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">רשימת קניות</h2>
		{#if data.totalItems > 0}
			<span class="glass-card px-3 py-1 text-sm font-medium text-primary">
				{data.checkedItems}/{data.totalItems}
			</span>
		{/if}
	</div>

	<!-- Progress bar -->
	{#if data.totalItems > 0}
		<div class="mb-4 h-2 overflow-hidden rounded-full bg-surface-warm">
			<div
				class="h-full rounded-full bg-linear-to-l from-primary to-accent transition-all duration-300"
				style="width: {(data.checkedItems / data.totalItems) * 100}%; box-shadow: 0 0 12px rgba(45, 212, 168, 0.4);"
			></div>
		</div>
	{/if}

	<!-- Recipes on this list -->
	{#if data.listRecipes.length > 0}
		<div class="mb-4 flex flex-wrap gap-1.5">
			{#each data.listRecipes as recipe}
				<form method="POST" action="?/removeRecipe" use:enhance>
					<input type="hidden" name="recipeId" value={recipe.recipeId} />
					<button class="flex items-center gap-1 rounded-full border border-border bg-surface-warm px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-primary/30 hover:text-text">
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
			<a href="/recipes" class="mt-2 inline-block text-sm text-primary hover:text-primary-light">
				בחר מתכונים לבישול
			</a>
		</div>
	{:else}
		<div class="space-y-2">
			{#each data.aisles as aisle}
				<div class="glass-card overflow-hidden">
					<!-- Aisle header -->
					<button
						onclick={() => toggleAisle(aisle.id)}
						class="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-warm/30"
					>
						<span class="text-primary">{aisle.name}</span>
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
									<div
										class="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors {item.isChecked ? 'opacity-60' : ''}"
										style="min-height: 48px"
									>
										<!-- Checkbox (toggle) -->
										<form method="POST" action="?/toggleItem" use:enhance class="shrink-0">
											<input type="hidden" name="itemId" value={item.id} />
											<input type="hidden" name="isChecked" value={String(item.isChecked)} />
											<button
												class="flex h-5 w-5 items-center justify-center rounded border-2 transition-all {item.isChecked ? 'border-accent bg-accent shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'border-text-muted/40 hover:border-primary'}"
											>
												{#if item.isChecked}
													<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
												{/if}
											</button>
										</form>

										<!-- Content: name -->
										<span class="flex-1 text-sm {item.isChecked ? 'shopping-item-checked' : ''}">
											{#if item.variantNameHe || item.variantName}
												{item.variantNameHe || item.variantName}
											{:else}
												{item.customName || item.ingredientNameHe || item.ingredientName || ''}
											{/if}
										</span>

										<!-- Quantity: display or edit -->
										{#if editingItemId === item.id}
											<form
												method="POST"
												action="?/updateQuantity"
												use:enhance={() => {
													return async ({ update }) => {
														editingItemId = null;
														await update();
													};
												}}
												class="flex items-center gap-1"
											>
												<input type="hidden" name="itemId" value={item.id} />
												<input
													type="number"
													name="quantity"
													bind:value={editQuantity}
													step="0.25"
													min="0"
													class="input-glass w-14 px-1.5 py-0.5 text-center text-sm"
													autofocus
												/>
												<select name="unit" bind:value={editUnit} class="input-glass px-1 py-0.5 text-xs">
													<option value="">-</option>
													{#each unitOptions as u}
														<option value={u}>{unitLabels[u]}</option>
													{/each}
												</select>
												<button type="submit" class="rounded bg-accent p-1 text-surface shadow-[0_0_8px_rgba(52,211,153,0.3)]">
													<Check size={14} />
												</button>
											</form>
										{:else}
											<!-- svelte-ignore a11y_click_events_have_key_events -->
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<span
												class="flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-sm transition-colors hover:bg-surface-warm/30"
												onclick={(e) => { e.stopPropagation(); startEditItem(item); }}
											>
												{#if item.quantity}
													<strong class="font-semibold">{formatQty(item.quantity)}</strong>
													{#if item.unit}
														{unitLabels[item.unit] || item.unit}
													{/if}
												{:else}
													<span class="text-text-muted"><Pencil size={12} /></span>
												{/if}
											</span>
										{/if}

										<!-- Delete item -->
										<form method="POST" action="?/deleteItem" use:enhance class="shrink-0">
											<input type="hidden" name="itemId" value={item.id} />
											<button class="p-1 text-text-muted transition-colors hover:text-danger">
												<X size={14} />
											</button>
										</form>
									</div>

									<!-- Variant selector for items with available variants but no chosen variant -->
									{#if item.availableVariants.length > 1 && !item.chosenVariantId && !item.isChecked}
										<div class="flex flex-wrap gap-1 px-4 pb-2">
											{#each item.availableVariants as variant}
												<form method="POST" action="?/chooseVariant" use:enhance>
													<input type="hidden" name="itemId" value={item.id} />
													<input type="hidden" name="variantId" value={variant.id} />
													<button class="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20">
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

	<!-- Add custom item with autocomplete -->
	<div class="relative mt-4">
		{#if selectedIngredient}
			<!-- Selected ingredient: show name + quantity/unit inputs -->
			<form
				method="POST"
				action="?/addCustomItem"
				use:enhance={() => {
					return async ({ update }) => {
						clearSelection();
						await update();
					};
				}}
				class="glass-card border-primary/30 p-3 space-y-2"
			>
				<input type="hidden" name="ingredientId" value={selectedIngredient.id} />
				<input type="hidden" name="name" value={selectedIngredient.nameHe || selectedIngredient.name} />
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">{selectedIngredient.nameHe || selectedIngredient.name}</span>
					<button type="button" onclick={clearSelection} class="text-text-muted hover:text-text">
						<X size={16} />
					</button>
				</div>
				{#if existingForSelected}
					<p class="text-xs text-text-muted">
						כבר ברשימה: {formatQty(existingForSelected.quantity)} {existingForSelected.unit ? unitLabels[existingForSelected.unit] || existingForSelected.unit : ''}
					</p>
				{/if}
				<div class="flex items-center gap-2">
					<input
						type="number"
						name="quantity"
						bind:value={addQuantity}
						step="0.25"
						min="0"
						placeholder="כמות"
						class="input-glass w-20"
					/>
					<select
						name="unit"
						bind:value={addUnit}
						class="input-glass flex-1"
					>
						<option value="">ללא יחידה</option>
						{#each unitOptions as u}
							<option value={u}>{unitLabels[u]}</option>
						{/each}
					</select>
					<button type="submit" class="btn-primary px-3 py-2.5">
						<Plus size={18} />
					</button>
				</div>
			</form>
		{:else}
			<!-- Search / free text input -->
			<form
				method="POST"
				action="?/addCustomItem"
				use:enhance={() => {
					return async ({ update }) => {
						customItemName = '';
						showDropdown = false;
						searchResults = [];
						await update();
					};
				}}
				class="flex gap-2"
			>
				<input
					type="text"
					name="name"
					bind:value={customItemName}
					oninput={onSearchInput}
					onfocus={() => { if (searchResults.length > 0) showDropdown = true; }}
					onblur={() => { setTimeout(() => { showDropdown = false; }, 200); }}
					placeholder="הוסף פריט..."
					autocomplete="off"
					class="input-glass flex-1"
				/>
				<button
					type="submit"
					disabled={!customItemName.trim()}
					class="btn-primary px-3 py-2.5 disabled:opacity-50"
				>
					<Plus size={18} />
				</button>
			</form>

			<!-- Autocomplete dropdown -->
			{#if showDropdown}
				<div class="glass-card absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden shadow-lg">
					{#each searchResults as result}
						{@const existing = getExistingItemForIngredient(result.id)}
						<button
							type="button"
							class="flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-surface-warm/30"
							onmousedown={() => selectIngredient(result)}
						>
							<span>{result.nameHe || result.name}</span>
							{#if existing}
								<span class="text-xs text-text-muted">ברשימה: {formatQty(existing.quantity)} {existing.unit ? unitLabels[existing.unit] || existing.unit : ''}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Actions -->
	{#if data.totalItems > 0}
		<div class="mt-4 flex gap-2">
			{#if data.checkedItems > 0}
				<form method="POST" action="?/clearChecked" use:enhance class="flex-1">
					<button class="btn-ghost w-full">
						הסר מסומנים ({data.checkedItems})
					</button>
				</form>
			{/if}
			<form method="POST" action="?/clearAll" use:enhance class="flex-1">
				<button class="btn-danger flex w-full items-center justify-center gap-1">
					<Trash2 size={14} />
					נקה הכל
				</button>
			</form>
		</div>
	{/if}
</div>
