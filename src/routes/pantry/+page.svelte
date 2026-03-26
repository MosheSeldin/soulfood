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
			class="input-glass flex-1"
		/>
		<button
			type="submit"
			disabled={!newItemName.trim()}
			class="btn-primary px-3 py-2.5 disabled:opacity-50"
		>
			<Plus size={18} />
		</button>
	</form>

	{#if data.items.length === 0}
		<div class="mt-12 text-center">
			<div class="logo-ring mx-auto inline-flex">
				<Refrigerator size={48} class="text-text-muted" />
			</div>
			<p class="mt-6 text-text-muted">עדיין לא הוספת מצרכים למלאי</p>
			<p class="mt-1 text-xs text-text-muted">מצרכים שיש בבית יוחרגו אוטומטית מרשימת הקניות</p>
		</div>
	{:else}
		<div class="space-y-1">
			{#each data.items as item}
				<div class="glass-card flex items-center justify-between px-4 py-3">
					<span class="text-sm">{item.ingredientNameHe || item.ingredientName || ''}</span>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<button class="rounded p-1 text-text-muted transition-colors hover:text-danger">
							<X size={16} />
						</button>
					</form>
				</div>
			{/each}
		</div>

		<!-- Clear all -->
		<form method="POST" action="?/clearAll" use:enhance class="mt-4">
			<button class="btn-danger flex w-full items-center justify-center gap-1">
				<Trash2 size={14} />
				נקה הכל
			</button>
		</form>
	{/if}
</div>
