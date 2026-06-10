<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, X, Refrigerator } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newItemName = $state('');
	let newQuantity = $state('');
	let newUnit = $state('');

	const unitLabels: Record<string, string> = {
		cup: 'כוס', tbsp: 'כף', tsp: 'כפית', g: 'גרם', kg: 'ק"ג',
		ml: 'מ"ל', l: 'ליטר', piece: 'יח\'', clove: 'שן', package: 'חבילה', can: 'פחית'
	};
	const unitOptions = ['piece', 'g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'package', 'can'];

	function formatQty(qty: number | null): string {
		if (qty === null) return '';
		if (qty === Math.floor(qty)) return qty.toString();
		return qty.toFixed(2).replace(/\.?0+$/, '');
	}
</script>

<div class="mx-auto max-w-lg">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl font-bold">מלאי בבית</h2>
		{#if data.items.length > 0}
			<span class="text-sm text-text-muted">{data.items.length} מצרכים</span>
		{/if}
	</div>

	<!-- Add item (optional quantity → smarter shopping list) -->
	<form
		method="POST"
		action="?/add"
		use:enhance={() => async ({ update }) => { newItemName = ''; newQuantity = ''; newUnit = ''; await update(); }}
		class="mb-4 flex gap-2"
	>
		<input
			type="text"
			name="name"
			bind:value={newItemName}
			placeholder="הוסף מצרך (ביצים, חלב...)"
			class="input-glass flex-1"
		/>
		<input
			type="number"
			name="quantity"
			bind:value={newQuantity}
			step="0.25"
			min="0"
			placeholder="כמות"
			class="input-glass w-16"
		/>
		<select name="unit" bind:value={newUnit} class="input-glass w-20">
			<option value="">יח'</option>
			{#each unitOptions as u}
				<option value={u}>{unitLabels[u]}</option>
			{/each}
		</select>
		<button
			type="submit"
			disabled={!newItemName.trim()}
			class="btn-primary px-3 py-2.5 disabled:opacity-50"
		>
			<Plus size={18} />
		</button>
	</form>
	<p class="mb-3 -mt-2 text-xs text-text-muted">טיפ: הזן כמות כדי שהרשימה תחשב כמה חסר לקנות (יש 1, צריך 6 → קנה 5)</p>

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
					<div class="flex items-center gap-3">
						{#if item.quantity}
							<span class="text-xs text-text-muted">
								{formatQty(item.quantity)}{item.unit ? ' ' + (unitLabels[item.unit] || item.unit) : ''}
							</span>
						{/if}
						<form method="POST" action="?/remove" use:enhance>
							<input type="hidden" name="itemId" value={item.id} />
							<button class="rounded p-1 text-text-muted transition-colors hover:text-danger">
								<X size={16} />
							</button>
						</form>
					</div>
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
