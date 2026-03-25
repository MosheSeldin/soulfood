<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, X, Refrigerator } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newItemName = $state('');
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">מלאי בבית</h2>
		{#if data.items.length > 0}
			<span class="text-sm text-text-muted">{data.items.length} מצרכים</span>
		{/if}
	</div>

	<!-- Add item -->
	<form method="POST" action="?/add" use:enhance class="mb-4 flex gap-2">
		<input
			type="text"
			name="name"
			bind:value={newItemName}
			placeholder="הוסף מצרך (למשל: ביצים, חלב...)"
			class="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
		/>
		<button
			type="submit"
			disabled={!newItemName.trim()}
			class="rounded-lg bg-accent px-3 py-2.5 text-white transition hover:bg-accent/90 disabled:opacity-50"
		>
			<Plus size={18} />
		</button>
	</form>

	{#if data.items.length === 0}
		<div class="mt-12 text-center">
			<Refrigerator size={48} class="mx-auto text-border" />
			<p class="mt-3 text-text-muted">עדיין לא הוספת מצרכים למלאי</p>
			<p class="mt-1 text-xs text-text-muted">מצרכים שיש בבית יוחרגו אוטומטית מרשימת הקניות</p>
		</div>
	{:else}
		<div class="space-y-1">
			{#each data.items as item}
				<div class="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3">
					<span class="text-sm">{item.ingredientNameHe || item.ingredientName || ''}</span>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<button class="rounded p-1 text-text-muted hover:text-danger">
							<X size={16} />
						</button>
					</form>
				</div>
			{/each}
		</div>

		<!-- Clear all -->
		<form method="POST" action="?/clearAll" use:enhance class="mt-4">
			<button class="flex w-full items-center justify-center gap-1 rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger hover:bg-danger/10">
				<Trash2 size={14} />
				נקה הכל
			</button>
		</form>
	{/if}
</div>
