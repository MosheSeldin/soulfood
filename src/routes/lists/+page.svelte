<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import MaayanMark from '$lib/components/MaayanMark.svelte';
	import SectionTabs from '$lib/components/SectionTabs.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type List = PageData['lists'][number];
	type Item = List['items'][number];

	let showNew = $state(false);
	let newName = $state('');

	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	// View + editing modes
	let groupByAisle = $state(true);
	let selectingListId = $state<string | null>(null);
	let selectedIds = $state<string[]>([]);
	let addedItems = $state<Record<string, boolean>>({});
	let toast = $state<string | null>(null);

	// Shared autocomplete — `activeListId` says which card's input is in focus.
	let activeListId = $state<string | null>(null);
	let query = $state('');
	let results = $state<
		Array<{ id: string; name: string | null; nameHe: string | null; defaultUnit: string | null; isMaayan?: boolean; maayanTop?: boolean }>
	>([]);
	let showDropdown = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', piece: "יח'", clove: 'שן', package: 'חבילה', can: 'פחית'
	};

	function itemName(item: Item): string {
		return (
			item.variantNameHe || item.variantName || item.customName || item.ingredientNameHe || item.ingredientName || ''
		);
	}

	function qtyLabel(item: Item): string {
		if (!item.quantity) return '';
		const u = item.unit ? unitLabels[item.unit] || item.unit : '';
		return `${item.quantity} ${u}`.trim();
	}

	// Group a list's items under aisle headers (data is already aisle-sorted).
	function aisleGroups(list: List) {
		const groups = new Map<string, { label: string; order: number; items: Item[] }>();
		for (const it of list.items) {
			const key = it.aisleCategoryId || '__none__';
			if (!groups.has(key)) {
				groups.set(key, { label: it.aisleName || 'אחר', order: it.aisleSortOrder ?? 99, items: [] });
			}
			groups.get(key)!.items.push(it);
		}
		return [...groups.values()].sort((a, b) => a.order - b.order);
	}

	function flashAdded(id: string) {
		addedItems[id] = true;
		setTimeout(() => { addedItems[id] = false; }, 1400);
	}

	function flashToast(msg: string) {
		toast = msg;
		setTimeout(() => { if (toast === msg) toast = null; }, 2400);
	}

	// Multi-select helpers
	function toggleSelect(id: string) {
		selectedIds = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
	}
	function allSelected(list: List) {
		return list.items.length > 0 && list.items.every((i) => selectedIds.includes(i.id));
	}
	function toggleSelectAll(list: List) {
		selectedIds = allSelected(list) ? [] : list.items.map((i) => i.id);
	}
	function startSelect(list: List) {
		if (selectingListId === list.id) {
			selectingListId = null;
			selectedIds = [];
		} else {
			selectingListId = list.id;
			selectedIds = [];
		}
	}

	async function search(q: string) {
		if (q.length < 2) {
			results = [];
			showDropdown = false;
			return;
		}
		const fd = new FormData();
		fd.set('q', q);
		const res = await fetch('?/searchIngredients', { method: 'POST', body: fd });
		const result: ActionResult = deserialize(await res.text());
		results = result.type === 'success' ? ((result.data?.results as typeof results) ?? []) : [];
		showDropdown = results.length > 0 && activeListId !== null;
	}

	function onInput(listId: string) {
		activeListId = listId;
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => search(query), 250);
	}

	function resetAdd() {
		query = '';
		results = [];
		showDropdown = false;
	}

	function startRename(list: List) {
		renamingId = list.id;
		renameValue = list.name;
	}
</script>

{#snippet itemRow(item: Item, list: List)}
	<li class="list-item {addedItems[item.id] ? 'just-added' : ''}">
		{#if selectingListId === list.id}
			<label class="li-check">
				<input type="checkbox" checked={selectedIds.includes(item.id)} onchange={() => toggleSelect(item.id)} />
			</label>
		{/if}
		<span class="li-name">
			{#if item.isMaayan}<MaayanMark top={!!item.maayanTop} />{/if}{itemName(item)}
			{#if qtyLabel(item)}<span class="li-qty kicker">{qtyLabel(item)}</span>{/if}
		</span>
		<div class="li-actions">
			<form
				method="POST"
				action="?/addItemToShopping"
				use:enhance={() => async ({ result, update }) => {
					if (result.type === 'success') flashAdded(item.id);
					await update({ reset: false });
				}}
			>
				<input type="hidden" name="itemId" value={item.id} />
				<button
					type="submit"
					class="li-add {addedItems[item.id] ? 'done' : ''}"
					title="הוסף לרשימת הקניות"
					aria-label="הוסף לרשימת הקניות"
				>
					{#if addedItems[item.id]}✓{:else}＋{/if}
				</button>
			</form>
			<form method="POST" action="?/removeItem" use:enhance style="display: contents">
				<input type="hidden" name="itemId" value={item.id} />
				<input type="hidden" name="listId" value={list.id} />
				<button class="shop-del" aria-label="הסר מהרשימה">✕</button>
			</form>
		</div>
	</li>
{/snippet}

<div class="page lists fade">
	<SectionTabs />

	<div class="shop-head">
		<div>
			<p class="kicker">Mes Listes</p>
			<h2 class="lib-title">רשימות שמורות</h2>
		</div>
		<div class="lists-actions">
			<button
				type="button"
				class="btn ghost view-toggle {groupByAisle ? 'on' : ''}"
				onclick={() => { groupByAisle = !groupByAisle; }}
				aria-pressed={groupByAisle}
			>
				לפי מדורים
			</button>
			<button class="btn" onclick={() => { showNew = !showNew; }}>＋ רשימה חדשה</button>
		</div>
	</div>

	<p class="lists-intro hand">
		רשימות קבועות של המצרכים שאתם הכי אוהבים — הוסיפו פריט בודד, סמנו כמה ביחד, או את כל הרשימה אל רשימת הקניות.
	</p>

	{#if toast}
		<p class="lists-toast hand">{toast}</p>
	{/if}

	{#if showNew}
		<form
			method="POST"
			action="?/createList"
			class="sheet new-list"
			use:enhance={() => async ({ update }) => {
				showNew = false;
				newName = '';
				await update();
			}}
		>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				name="name"
				bind:value={newName}
				placeholder="שם הרשימה (למשל: קלאסי)"
				autofocus
				class="field"
			/>
			<button type="submit" disabled={!newName.trim()} class="stamp" aria-label="צור">＋</button>
		</form>
	{/if}

	{#if data.lists.length === 0}
		<p class="empty hand">עדיין אין רשימות שמורות — צרו את ״קלאסי״ והתחילו להוסיף מצרכים אהובים…</p>
	{:else}
		<div class="lists-grid">
			{#each data.lists as list (list.id)}
				<section class="sheet list-card">
					<header class="list-card-head">
						{#if renamingId === list.id}
							<form
								method="POST"
								action="?/renameList"
								class="rename-form"
								use:enhance={() => async ({ update }) => {
									renamingId = null;
									await update();
								}}
							>
								<input type="hidden" name="listId" value={list.id} />
								<!-- svelte-ignore a11y_autofocus -->
								<input type="text" name="name" bind:value={renameValue} class="field rename-field" autofocus />
								<button type="submit" class="stamp" aria-label="שמור">✓</button>
								<button type="button" class="shop-del" onclick={() => { renamingId = null; }} aria-label="בטל">✕</button>
							</form>
						{:else}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
							<h3 class="list-name" onclick={() => startRename(list)}>{list.name}</h3>
							<span class="list-count kicker">{list.items.length} מצרכים</span>
							{#if list.items.length > 0}
								<button
									type="button"
									class="list-tool {selectingListId === list.id ? 'on' : ''}"
									onclick={() => startSelect(list)}
									title="בחירה מרובה"
									aria-label="בחירה מרובה"
									aria-pressed={selectingListId === list.id}
								>☑</button>
							{/if}
							<form
								method="POST"
								action="?/deleteList"
								use:enhance
								onsubmit={(e) => { if (!confirm(`למחוק את הרשימה ״${list.name}״?`)) e.preventDefault(); }}
							>
								<input type="hidden" name="listId" value={list.id} />
								<button class="shop-del" aria-label="מחק רשימה">🗑</button>
							</form>
						{/if}
					</header>

					{#if selectingListId === list.id}
						<div class="select-bar">
							<form
								method="POST"
								action="?/addSelectedToShopping"
								use:enhance={() => async ({ result, update }) => {
									if (result.type === 'success') {
										const added = (result.data?.addedSelected as number) ?? 0;
										flashToast(added > 0 ? `נוספו ${added} פריטים לרשימת הקניות ✓` : 'הפריטים כבר ברשימת הקניות');
										selectingListId = null;
										selectedIds = [];
									}
									await update({ reset: false });
								}}
							>
								<input type="hidden" name="itemIds" value={JSON.stringify(selectedIds)} />
								<button type="submit" class="btn rubric sel-add" disabled={selectedIds.length === 0}>
									הוסף נבחרים ({selectedIds.length}) ←
								</button>
							</form>
							<button type="button" class="sel-link" onclick={() => toggleSelectAll(list)}>
								{allSelected(list) ? 'נקה בחירה' : 'בחר הכל'}
							</button>
							<button
								type="button"
								class="shop-del"
								onclick={() => { selectingListId = null; selectedIds = []; }}
								aria-label="בטל בחירה"
							>✕</button>
						</div>
					{/if}

					{#if list.items.length > 0}
						{#if groupByAisle}
							{#each aisleGroups(list) as group}
								<div class="li-group">
									<h4 class="li-aisle-h">
										{group.label}<span class="li-aisle-n">{group.items.length}</span>
									</h4>
									<ul class="list-items">
										{#each group.items as item (item.id)}
											{@render itemRow(item, list)}
										{/each}
									</ul>
								</div>
							{/each}
						{:else}
							<ul class="list-items">
								{#each list.items as item (item.id)}
									{@render itemRow(item, list)}
								{/each}
							</ul>
						{/if}
					{:else}
						<p class="empty-list hand">רשימה ריקה — הוסיפו מצרך למטה</p>
					{/if}

					<!-- Add item with autocomplete -->
					<div class="add-wrap">
						<form
							method="POST"
							action="?/addItem"
							class="shop-add"
							use:enhance={() => async ({ update }) => {
								resetAdd();
								await update();
							}}
						>
							<input type="hidden" name="listId" value={list.id} />
							<input
								type="text"
								name="name"
								value={activeListId === list.id ? query : ''}
								oninput={(e) => { query = e.currentTarget.value; onInput(list.id); }}
								onfocus={() => { activeListId = list.id; }}
								onblur={() => setTimeout(() => { if (activeListId === list.id) showDropdown = false; }, 200)}
								placeholder="הוסף מצרך…"
								autocomplete="off"
								class="field"
							/>
							<button type="submit" disabled={activeListId !== list.id || !query.trim()} class="stamp" aria-label="הוסף">＋</button>
						</form>

						{#if showDropdown && activeListId === list.id}
							<div class="sheet dropdown">
								{#each results as result}
									<form method="POST" action="?/addItem" use:enhance={() => async ({ update }) => { resetAdd(); await update(); }}>
										<input type="hidden" name="listId" value={list.id} />
										<input type="hidden" name="ingredientId" value={result.id} />
										<input type="hidden" name="name" value={result.nameHe || result.name} />
										<button type="submit" class="dropdown-row" onmousedown={(e) => e.preventDefault()}>
											<span>{#if result.isMaayan}<MaayanMark top={!!result.maayanTop} />{/if}{result.nameHe || result.name}</span>
										</button>
									</form>
								{/each}
							</div>
						{/if}
					</div>

					<form method="POST" action="?/addToShopping" use:enhance>
						<input type="hidden" name="listId" value={list.id} />
						<button class="btn add-to-shop" disabled={list.items.length === 0}>
							הוסף הכל לרשימת הקניות ←
						</button>
					</form>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lists-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.view-toggle {
		font-size: 0.9rem;
		padding: 0.5em 0.95em;
	}
	.view-toggle.on {
		color: var(--rubric);
		border-color: var(--rubric);
		background: rgba(45, 111, 106, 0.08);
	}

	.lists-intro {
		color: var(--ink-soft);
		margin: -0.4rem 0 1.1rem;
		max-width: 36rem;
	}
	.lists-toast {
		color: var(--rubric);
		margin: -0.3rem 0 1.1rem;
		font-size: 1.05rem;
	}
	.new-list {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.7rem 0.9rem;
		margin-bottom: 1.4rem;
		max-width: 460px;
	}
	.new-list .field {
		flex: 1;
	}

	.lists-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 1.2rem;
	}
	.list-card {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		padding: 1.1rem 1.1rem 1.2rem;
		border-radius: 4px;
	}
	.list-card-head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		border-bottom: 1px solid var(--ink-faint);
		padding-bottom: 0.6rem;
	}
	.list-name {
		font-family: var(--display, var(--latin));
		font-size: 1.3rem;
		cursor: text;
		flex: 1;
		min-width: 0;
	}
	.list-count {
		white-space: nowrap;
	}
	.list-tool {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--ink-faint);
		border-radius: 4px;
		background: transparent;
		color: var(--ink-muted);
		font-size: 0.95rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.list-tool:hover {
		color: var(--rubric);
		border-color: var(--rubric);
	}
	.list-tool.on {
		color: var(--paper-2);
		background: var(--rubric);
		border-color: var(--rubric);
	}
	.rename-form {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
	}
	.rename-field {
		flex: 1;
	}

	/* multi-select action bar */
	.select-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.6rem;
		border-radius: 4px;
		background: rgba(45, 111, 106, 0.07);
		border: 1px dashed var(--rubric-soft);
	}
	.sel-add {
		font-size: 0.92rem;
		padding: 0.45em 0.9em;
	}
	.sel-add:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.sel-link {
		font-family: var(--latin);
		font-style: italic;
		font-size: 0.88rem;
		color: var(--rubric);
		background: transparent;
		border: 0;
		cursor: pointer;
		padding: 0.2em 0.1em;
		margin-inline-start: auto;
	}
	.sel-link:hover {
		text-decoration: underline;
	}

	/* aisle grouping inside a card */
	.li-group + .li-group {
		margin-top: 0.5rem;
	}
	.li-aisle-h {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-family: var(--latin);
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--rubric);
		text-transform: uppercase;
		margin: 0.2rem 0 0.15rem;
		padding-bottom: 0.18rem;
		border-bottom: 1px dotted var(--ink-faint);
	}
	.li-aisle-n {
		font-style: italic;
		color: var(--ink-muted);
		margin-inline-start: auto;
		text-transform: none;
		font-weight: 400;
	}

	.list-items {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.list-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.22rem 0.1rem;
		border-radius: 3px;
		transition: background 0.3s ease;
	}
	.list-item.just-added {
		background: rgba(45, 111, 106, 0.1);
	}
	.li-check {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
	}
	.li-check input {
		width: 16px;
		height: 16px;
		accent-color: var(--rubric);
		cursor: pointer;
	}
	.li-name {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		flex: 1;
	}
	.li-qty {
		opacity: 0.7;
	}
	.li-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.1rem;
		flex: 0 0 auto;
	}
	.li-add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--ink-faint);
		border-radius: 50%;
		background: transparent;
		color: var(--ink-muted);
		font-family: var(--latin);
		font-size: 1.05rem;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.li-add:hover {
		color: var(--paper-2);
		background: var(--rubric);
		border-color: var(--rubric);
	}
	.li-add.done {
		color: var(--paper-2);
		background: var(--rubric);
		border-color: var(--rubric);
	}
	.empty-list {
		color: var(--ink-muted);
		font-size: 0.95rem;
		padding: 0.3rem 0;
	}

	.add-wrap {
		position: relative;
		margin-top: 0.2rem;
	}
	.dropdown {
		position: absolute;
		inset-inline: 0;
		top: 100%;
		margin-top: 0.3rem;
		z-index: 10;
		overflow: hidden;
		border-radius: 3px;
	}
	.dropdown :global(form) {
		display: block;
	}
	.dropdown-row {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.85rem;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--ink-faint);
		text-align: start;
		font-size: 1rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.dropdown-row:hover {
		background: rgba(45, 111, 106, 0.08);
	}

	.shop-del {
		flex: 0 0 auto;
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		opacity: 0.55;
		font-size: 0.9rem;
		padding: 0.2em 0.3em;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.shop-del:hover {
		opacity: 1;
		color: var(--color-danger);
	}

	.add-to-shop {
		width: 100%;
		margin-top: 0.2rem;
		justify-content: center;
	}
	.add-to-shop:disabled {
		opacity: 0.4;
		cursor: default;
	}

	@media (max-width: 640px) {
		.lists-actions {
			flex-direction: column-reverse;
			align-items: stretch;
		}
	}
</style>
