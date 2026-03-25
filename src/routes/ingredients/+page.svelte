<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Pencil, Check, X, Search } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editNameHe = $state('');
	let editAisleCategoryId = $state('');
	let addedItems = $state<Record<string, boolean>>({});

	let filteredIngredients = $derived(
		data.ingredients.filter((ing) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				ing.name.toLowerCase().includes(q) ||
				(ing.nameHe?.toLowerCase().includes(q))
			);
		})
	);

	function startEdit(ing: typeof data.ingredients[0]) {
		editingId = ing.id;
		editName = ing.name;
		editNameHe = ing.nameHe || '';
		editAisleCategoryId = ing.aisleCategoryId || '';
	}

	function cancelEdit() {
		editingId = null;
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">בנק מצרכים</h2>
		<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
			{data.ingredients.length}
		</span>
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

	<!-- Ingredient list -->
	{#if filteredIngredients.length === 0}
		<p class="mt-8 text-center text-text-muted">
			{searchQuery ? 'לא נמצאו מצרכים' : 'אין מצרכים במאגר'}
		</p>
	{:else}
		<div class="space-y-1">
			{#each filteredIngredients as ing}
				<div class="rounded-lg border border-border bg-white px-3 py-2.5">
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
					{:else}
						<!-- Display mode -->
						<div class="flex items-center gap-2">
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium">{ing.nameHe || ing.name}</span>
								{#if ing.nameHe && ing.name}
									<span class="text-xs text-text-muted ms-1">{ing.name}</span>
								{/if}
								{#if ing.aisleNameHe || ing.aisleName}
									<span class="ms-1.5 inline-block rounded-full bg-surface-warm px-2 py-0.5 text-xs text-text-muted">
										{ing.aisleNameHe || ing.aisleName}
									</span>
								{/if}
							</div>
							<button
								onclick={() => startEdit(ing)}
								class="shrink-0 p-1 text-text-muted hover:text-primary transition-colors"
							>
								<Pencil size={14} />
							</button>
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
								class="shrink-0"
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
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
