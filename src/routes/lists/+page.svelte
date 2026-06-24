<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import MaayanMark from '$lib/components/MaayanMark.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type List = PageData['lists'][number];
	type Item = List['items'][number];

	let showNew = $state(false);
	let newName = $state('');

	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

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

<div class="page lists fade">
	<div class="shop-head">
		<div>
			<p class="kicker">Mes Listes</p>
			<h2 class="lib-title">רשימות שמורות</h2>
		</div>
		<button class="btn" onclick={() => { showNew = !showNew; }}>＋ רשימה חדשה</button>
	</div>

	<p class="lists-intro hand">
		רשימות קבועות של המצרכים שאתם הכי אוהבים — למשל ״קלאסי״ — והוספה לרשימת הקניות בלחיצה אחת.
	</p>

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

					{#if list.items.length > 0}
						<ul class="list-items">
							{#each list.items as item (item.id)}
								<li class="list-item">
									<span class="li-name">
										{#if item.isMaayan}<MaayanMark top={!!item.maayanTop} />{/if}{itemName(item)}
										{#if qtyLabel(item)}<span class="li-qty kicker">{qtyLabel(item)}</span>{/if}
									</span>
									<form method="POST" action="?/removeItem" use:enhance style="display: contents">
										<input type="hidden" name="itemId" value={item.id} />
										<input type="hidden" name="listId" value={list.id} />
										<button class="shop-del" aria-label="הסר">✕</button>
									</form>
								</li>
							{/each}
						</ul>
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
							הוסף לרשימת הקניות ←
						</button>
					</form>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lists-intro {
		color: var(--ink-soft);
		margin: -0.4rem 0 1.4rem;
		max-width: 34rem;
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
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.2rem;
	}
	.list-card {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 1.1rem 1.1rem 1.2rem;
		border-radius: 4px;
	}
	.list-card-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
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
	.rename-form {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		width: 100%;
	}
	.rename-field {
		flex: 1;
	}

	.list-items {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.list-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.2rem 0;
	}
	.li-name {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.li-qty {
		opacity: 0.7;
	}
	.empty-list {
		color: var(--ink-muted);
		font-size: 0.95rem;
		padding: 0.3rem 0;
	}

	.add-wrap {
		position: relative;
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
	}
	.add-to-shop:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
