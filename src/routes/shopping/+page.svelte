<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let customItemName = $state('');
	let collapsedAisles = $state(new Set<string>());

	// Autocomplete state
	let searchResults = $state<
		Array<{ id: string; name: string; nameHe: string | null; aisleCategoryId: string | null; defaultUnit: string | null }>
	>([]);
	let selectedIngredient = $state<(typeof searchResults)[0] | null>(null);
	let addQuantity = $state('');
	let addUnit = $state('');
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	let existingForSelected = $derived(
		selectedIngredient ? getExistingItemForIngredient(selectedIngredient.id) : null
	);

	// Inline quantity editing
	let editingItemId = $state<string | null>(null);
	let editQuantity = $state('');
	let editUnit = $state('');

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', oz: "אונ'", lb: 'ליברה',
		piece: "יח'", clove: 'שן', package: 'חבילה', can: 'פחית'
	};
	const unitOptions = ['cup', 'tbsp', 'tsp', 'g', 'kg', 'ml', 'l', 'piece', 'package', 'can'];

	let pct = $derived(data.totalItems ? Math.round((data.checkedItems / data.totalItems) * 100) : 0);

	function toggleAisle(id: string) {
		const next = new Set(collapsedAisles);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsedAisles = next;
	}

	function formatQty(qty: number | null): string {
		if (qty === null) return '';
		if (qty === Math.floor(qty)) return qty.toString();
		const f = qty - Math.floor(qty);
		const whole = Math.floor(qty);
		if (Math.abs(f - 0.5) < 0.01) return whole ? `${whole}½` : '½';
		if (Math.abs(f - 0.25) < 0.01) return whole ? `${whole}¼` : '¼';
		if (Math.abs(f - 0.75) < 0.01) return whole ? `${whole}¾` : '¾';
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
		const actionData = json?.data ? JSON.parse(json.data) : null;
		searchResults = actionData?.results || [];
		showDropdown = searchResults.length > 0;
	}

	function onSearchInput() {
		selectedIngredient = null;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => searchIngredients(customItemName), 300);
	}

	function selectIngredient(ing: (typeof searchResults)[0]) {
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

	function itemName(item: (typeof data.aisles)[0]['items'][0]): string {
		return (
			item.variantNameHe || item.variantName || item.customName || item.ingredientNameHe || item.ingredientName || ''
		);
	}
</script>

<div class="page shopping fade">
	<div class="shop-head">
		<div>
			<p class="kicker">La Liste du Marché</p>
			<h2 class="lib-title">רשימת השוק</h2>
		</div>
		{#if data.totalItems > 0}
			<span class="shop-count hand">{data.checkedItems}/{data.totalItems}</span>
		{/if}
	</div>

	{#if data.totalItems > 0}
		<div class="shop-prog"><span style="width: {pct}%"></span></div>
	{/if}

	<svg class="wavy" viewBox="0 0 300 8" preserveAspectRatio="none">
		<path
			d="M0 4 Q 15 0 30 4 T 60 4 T 90 4 T 120 4 T 150 4 T 180 4 T 210 4 T 240 4 T 270 4 T 300 4"
			stroke="currentColor"
			fill="none"
			stroke-width="1.2"
		/>
	</svg>

	{#if data.listRecipes.length > 0}
		<div class="list-recipes">
			{#each data.listRecipes as recipe}
				<form method="POST" action="?/removeRecipe" use:enhance>
					<input type="hidden" name="recipeId" value={recipe.recipeId} />
					<button class="list-chip">
						{recipe.titleHe || recipe.title}
						<span class="x">✕</span>
					</button>
				</form>
			{/each}
		</div>
	{/if}

	{#if data.aisles.length === 0}
		<p class="empty hand">הרשימה ריקה — בחרו מתכונים לבישול…</p>
		<p style="text-align:center; margin-top:-1rem">
			<a href="/recipes" class="tag is-rubric">אל מדף המתכונים →</a>
		</p>
	{:else}
		<div class="shop-list">
			{#each data.aisles as aisle (aisle.id)}
				{@const openCount = aisle.items.filter((i) => !i.isChecked).length}
				{@const collapsed = collapsedAisles.has(aisle.id)}
				<section class="aisle">
					<button class="aisle-h" onclick={() => toggleAisle(aisle.id)}>
						{aisle.name}
						<i class="aisle-n">{openCount} {collapsed ? '▸' : '▾'}</i>
					</button>
					{#if !collapsed}
						<ul>
							{#each [...aisle.items].sort((a, b) => (a.isChecked ? 1 : 0) - (b.isChecked ? 1 : 0)) as item (item.id)}
								<li class="shop-item {item.isChecked ? 'is-checked' : ''}">
									<form method="POST" action="?/toggleItem" use:enhance style="display: contents">
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="isChecked" value={String(item.isChecked)} />
										<button class="shop-toggle" type="submit">
											<span class="tick">
												<svg viewBox="0 0 30 30" fill="none">
													<path d="M6 16 L12 23 L25 7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
												</svg>
											</span>
											<span class="shop-main">
												<span class="shop-n">{itemName(item)}</span>
												{#if item.sourceRecipeNames.length > 0}
													<span class="shop-from kicker">מתוך: {item.sourceRecipeNames.join(' · ')}</span>
												{/if}
											</span>
										</button>
									</form>

									{#if editingItemId === item.id}
										<form
											method="POST"
											action="?/updateQuantity"
											class="qty-edit"
											use:enhance={() => async ({ update }) => {
												editingItemId = null;
												await update();
											}}
										>
											<input type="hidden" name="itemId" value={item.id} />
											<!-- svelte-ignore a11y_autofocus -->
											<input
												type="number"
												name="quantity"
												bind:value={editQuantity}
												step="0.25"
												min="0"
												class="field-box qty-num"
												autofocus
											/>
											<select name="unit" bind:value={editUnit} class="field-box qty-unit">
												<option value="">—</option>
												{#each unitOptions as u}
													<option value={u}>{unitLabels[u]}</option>
												{/each}
											</select>
											<button type="submit" class="stamp" aria-label="שמור">✓</button>
										</form>
									{:else}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<span class="shop-q" onclick={() => startEditItem(item)}>
											{#if item.quantity}
												{formatQty(item.quantity)} {item.unit ? unitLabels[item.unit] || item.unit : ''}
											{:else}
												<span class="shop-q-add">＋ כמות</span>
											{/if}
										</span>
									{/if}

									<form method="POST" action="?/deleteItem" use:enhance style="display: contents">
										<input type="hidden" name="itemId" value={item.id} />
										<button class="shop-del" aria-label="הסר פריט">✕</button>
									</form>
								</li>

								{#if item.availableVariants.length > 1 && !item.chosenVariantId && !item.isChecked}
									<li class="variant-row">
										{#each item.availableVariants as variant}
											<form method="POST" action="?/chooseVariant" use:enhance>
												<input type="hidden" name="itemId" value={item.id} />
												<input type="hidden" name="variantId" value={variant.id} />
												<button class="tag is-rubric">{variant.nameHe || variant.name}</button>
											</form>
										{/each}
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}

	<!-- Add custom item with autocomplete -->
	<div class="shop-add-wrap">
		{#if selectedIngredient}
			<form
				method="POST"
				action="?/addCustomItem"
				class="sheet selected-card"
				use:enhance={() => async ({ update }) => {
					clearSelection();
					await update();
				}}
			>
				<input type="hidden" name="ingredientId" value={selectedIngredient.id} />
				<input type="hidden" name="name" value={selectedIngredient.nameHe || selectedIngredient.name} />
				<div class="selected-head">
					<span class="shop-n">{selectedIngredient.nameHe || selectedIngredient.name}</span>
					<button type="button" class="shop-del" onclick={clearSelection} aria-label="בטל">✕</button>
				</div>
				{#if existingForSelected}
					<p class="kicker">כבר ברשימה: {formatQty(existingForSelected.quantity)}
						{existingForSelected.unit ? unitLabels[existingForSelected.unit] || existingForSelected.unit : ''}</p>
				{/if}
				<div class="selected-inputs">
					<input type="number" name="quantity" bind:value={addQuantity} step="0.25" min="0" placeholder="כמות" class="field-box qty-num" />
					<select name="unit" bind:value={addUnit} class="field-box">
						<option value="">ללא יחידה</option>
						{#each unitOptions as u}
							<option value={u}>{unitLabels[u]}</option>
						{/each}
					</select>
					<button type="submit" class="stamp" aria-label="הוסף">＋</button>
				</div>
			</form>
		{:else}
			<form
				method="POST"
				action="?/addCustomItem"
				class="shop-add"
				use:enhance={() => async ({ update }) => {
					customItemName = '';
					showDropdown = false;
					searchResults = [];
					await update();
				}}
			>
				<input
					type="text"
					name="name"
					bind:value={customItemName}
					oninput={onSearchInput}
					onfocus={() => { if (searchResults.length > 0) showDropdown = true; }}
					onblur={() => setTimeout(() => (showDropdown = false), 200)}
					placeholder="הוסף פריט בכתב יד…"
					autocomplete="off"
					class="field"
				/>
				<button type="submit" disabled={!customItemName.trim()} class="stamp" aria-label="הוסף">＋</button>
			</form>

			{#if showDropdown}
				<div class="sheet dropdown">
					{#each searchResults as result}
						{@const existing = getExistingItemForIngredient(result.id)}
						<button type="button" class="dropdown-row" onmousedown={() => selectIngredient(result)}>
							<span>{result.nameHe || result.name}</span>
							{#if existing}
								<span class="kicker">ברשימה: {formatQty(existing.quantity)}
									{existing.unit ? unitLabels[existing.unit] || existing.unit : ''}</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	{#if data.totalItems > 0}
		<div class="shop-actions">
			{#if data.checkedItems > 0}
				<form method="POST" action="?/clearChecked" use:enhance>
					<button class="btn ghost">הסר מסומנים ({data.checkedItems})</button>
				</form>
			{/if}
			<form method="POST" action="?/clearAll" use:enhance>
				<button class="btn ghost btn-del">נקה הכול</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.list-recipes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.4rem;
	}
	.list-chip {
		font-family: var(--latin);
		font-style: italic;
		font-size: 0.85rem;
		color: var(--ink-soft);
		border: 1px solid var(--ink-faint);
		background: var(--note-bg);
		padding: 0.15em 0.7em;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		transition: all 0.15s ease;
	}
	.list-chip:hover {
		border-color: var(--rubric);
		color: var(--rubric);
	}
	.list-chip .x {
		font-size: 0.75em;
		opacity: 0.7;
	}

	.aisle-h {
		width: 100%;
		text-align: start;
		background: transparent;
		cursor: pointer;
	}

	.shop-toggle {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		background: transparent;
		border: 0;
		text-align: start;
		min-width: 0;
		padding: 0;
	}

	.shop-q {
		cursor: pointer;
		border-radius: 2px;
		padding: 0.1em 0.3em;
		transition: background 0.15s ease;
		white-space: nowrap;
	}
	.shop-q:hover {
		background: rgba(45, 111, 106, 0.08);
	}
	.shop-q-add {
		font-family: var(--latin);
		font-style: italic;
		font-size: 0.85rem;
		color: var(--ink-muted);
	}

	.shop-del {
		flex: 0 0 auto;
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		opacity: 0.55;
		font-size: 0.9rem;
		padding: 0.2em 0.3em;
		transition: all 0.15s ease;
	}
	.shop-del:hover {
		opacity: 1;
		color: var(--color-danger);
	}

	.qty-edit {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.qty-num {
		width: 4.2rem;
		text-align: center;
		padding: 0.3em 0.4em;
	}
	.qty-unit {
		width: 5rem;
		padding: 0.3em 0.4em;
	}

	.variant-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0.2rem 0 0.6rem 2.4rem;
	}

	.shop-add-wrap {
		position: relative;
		margin-top: 1.6rem;
		max-width: 460px;
	}
	.dropdown {
		position: absolute;
		inset-inline: 0;
		top: 100%;
		margin-top: 0.4rem;
		z-index: 10;
		overflow: hidden;
		border-radius: 3px;
	}
	.dropdown-row {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ink-faint);
		text-align: start;
		font-size: 1rem;
		transition: background 0.15s ease;
	}
	.dropdown-row:last-child {
		border-bottom: 0;
	}
	.dropdown-row:hover {
		background: rgba(45, 111, 106, 0.08);
	}

	.selected-card {
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border-radius: 3px;
	}
	.selected-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.selected-inputs {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.selected-inputs .field-box:nth-child(2) {
		flex: 1;
	}

	.shop-actions {
		display: flex;
		gap: 0.7rem;
		margin-top: 1.6rem;
	}
	.btn-del {
		color: var(--color-danger);
		border-color: rgba(168, 67, 47, 0.4);
	}
	.btn-del:hover {
		background: rgba(168, 67, 47, 0.08);
	}
</style>
