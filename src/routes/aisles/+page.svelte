<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, X, Pencil, Trash2, Plus, GripVertical } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editingId = $state<string | null>(null);
	let editName = $state('');
	let editNameHe = $state('');
	let editSortOrder = $state(50);
	let showAdd = $state(false);
	let newName = $state('');
	let newNameHe = $state('');
	let newSortOrder = $state(50);

	function startEdit(aisle: typeof data.aisles[0]) {
		editingId = aisle.id;
		editName = aisle.name;
		editNameHe = aisle.nameHe;
		editSortOrder = aisle.sortOrder;
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold">ניהול מדורים</h2>
			<p class="text-sm text-text-muted mt-0.5">מדורי הסופרמרקט לסידור רשימת הקניות</p>
		</div>
		<button
			onclick={() => { showAdd = !showAdd; }}
			class="btn-primary flex items-center gap-1.5"
		>
			<Plus size={16} />
			מדור חדש
		</button>
	</div>

	<!-- Add new aisle form -->
	{#if showAdd}
		<form
			method="POST"
			action="?/createAisle"
			use:enhance={() => async ({ update }) => {
				showAdd = false;
				newName = '';
				newNameHe = '';
				newSortOrder = 50;
				await update();
			}}
			class="glass-card mb-4 border-primary/30 p-3 space-y-2"
		>
			<p class="text-sm font-medium">מדור חדש</p>
			<div class="flex gap-2">
				<input
					type="text"
					name="nameHe"
					bind:value={newNameHe}
					placeholder="שם בעברית *"
					required
					autofocus
					class="input-glass flex-1 px-2 py-1.5"
				/>
				<input
					type="text"
					name="name"
					bind:value={newName}
					placeholder="English name *"
					required
					class="input-glass flex-1 px-2 py-1.5"
				/>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-xs text-text-muted whitespace-nowrap">סדר מיון:</label>
				<input
					type="number"
					name="sortOrder"
					bind:value={newSortOrder}
					min="0"
					max="999"
					class="input-glass w-20 px-2 py-1.5"
				/>
				<div class="flex-1"></div>
				<button type="submit" class="btn-primary px-3 py-1.5 text-sm">
					הוסף
				</button>
				<button type="button" onclick={() => { showAdd = false; }} class="btn-ghost px-3 py-1.5 text-sm">
					ביטול
				</button>
			</div>
		</form>
	{/if}

	<!-- Aisles list -->
	<div class="space-y-1">
		{#each data.aisles as aisle}
			<div class="glass-card px-3 py-2.5">
				{#if editingId === aisle.id}
					<form
						method="POST"
						action="?/updateAisle"
						use:enhance={() => async ({ update }) => {
							editingId = null;
							await update();
						}}
						class="space-y-2"
					>
						<input type="hidden" name="id" value={aisle.id} />
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
							<label class="text-xs text-text-muted whitespace-nowrap">סדר מיון:</label>
							<input
								type="number"
								name="sortOrder"
								bind:value={editSortOrder}
								min="0"
								max="999"
								class="input-glass w-20 px-2 py-1"
							/>
							<div class="flex-1"></div>
							<button type="submit" class="rounded bg-accent p-1.5 text-surface shadow-[0_0_8px_rgba(52,211,153,0.3)]">
								<Check size={14} />
							</button>
							<button type="button" onclick={() => { editingId = null; }} class="btn-ghost p-1.5">
								<X size={14} />
							</button>
						</div>
					</form>
				{:else}
					<div class="flex items-center gap-2">
						<span class="w-7 text-center text-xs text-primary font-mono">{aisle.sortOrder}</span>
						<div class="flex-1 min-w-0">
							<span class="text-sm font-medium">{aisle.nameHe}</span>
							<span class="text-xs text-text-muted ms-1.5">{aisle.name}</span>
							{#if aisle.ingredientCount > 0}
								<span class="ms-1.5 text-xs text-text-muted">{aisle.ingredientCount} מצרכים</span>
							{/if}
						</div>
						<button
							onclick={() => startEdit(aisle)}
							class="p-1 text-text-muted hover:text-primary transition-colors"
						>
							<Pencil size={14} />
						</button>
						{#if aisle.ingredientCount === 0}
							<form
								method="POST"
								action="?/deleteAisle"
								use:enhance={() => async ({ update }) => { await update(); }}
							>
								<input type="hidden" name="id" value={aisle.id} />
								<button
									type="submit"
									class="p-1 text-text-muted hover:text-danger transition-colors"
									onclick={(e) => { if (!confirm('למחוק את המדור?')) e.preventDefault(); }}
								>
									<Trash2 size={14} />
								</button>
							</form>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<p class="mt-4 text-center text-xs text-text-muted">
		מספר הסדר קובע את סדר הופעת המדורים ברשימת הקניות
	</p>
</div>
