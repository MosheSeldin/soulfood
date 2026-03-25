<script lang="ts">
	import { BookOpen, ShoppingCart, Refrigerator, Plus } from 'lucide-svelte';
</script>

<div class="mx-auto max-w-lg space-y-6 pt-4">
	<div class="text-center">
		<h2 class="text-2xl font-bold text-primary">Soul Food</h2>
		<p class="mt-1 text-text-muted">ניהול מתכונים ורשימות קניות חכמות</p>
	</div>

	<div class="grid grid-cols-2 gap-3">
		<a
			href="/recipes"
			class="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
		>
			<BookOpen size={28} class="text-primary" />
			<span class="font-medium">המתכונים שלי</span>
		</a>
		<a
			href="/recipes/import"
			class="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
		>
			<Plus size={28} class="text-accent" />
			<span class="font-medium">ייבוא מתכון</span>
		</a>
		<a
			href="/shopping"
			class="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
		>
			<ShoppingCart size={28} class="text-primary" />
			<span class="font-medium">רשימת קניות</span>
		</a>
		<a
			href="/pantry"
			class="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md"
		>
			<Refrigerator size={28} class="text-accent" />
			<span class="font-medium">מלאי בבית</span>
		</a>
	</div>
</div>
