<script lang="ts">
	import { page } from '$app/state';
	import { BookOpen, ShoppingCart, Refrigerator, Egg, UtensilsCrossed, LayoutGrid } from 'lucide-svelte';

	const links = [
		{ href: '/recipes', label: 'מתכונים', icon: BookOpen },
		{ href: '/shopping', label: 'רשימת קניות', icon: ShoppingCart },
		{ href: '/pantry', label: 'מלאי בבית', icon: Refrigerator },
		{ href: '/ingredients', label: 'מצרכים', icon: Egg },
		{ href: '/aisles', label: 'מדורים', icon: LayoutGrid }
	];
</script>

<aside class="hidden md:flex md:w-56 md:flex-col md:border-l md:border-border md:bg-white">
	<a href="/" class="flex items-center gap-2 border-b border-border px-4 py-4">
		<UtensilsCrossed size={24} class="text-primary" />
		<span class="text-lg font-bold text-primary">Soul Food</span>
	</a>
	<nav class="flex flex-1 flex-col gap-1 p-2">
		{#each links as link}
			<a
				href={link.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors {page
					.url.pathname === link.href ||
				page.url.pathname.startsWith(link.href + '/')
					? 'bg-primary/10 text-primary font-semibold'
					: 'text-text-muted hover:bg-surface-warm'}"
			>
				<link.icon size={18} />
				<span>{link.label}</span>
			</a>
		{/each}
	</nav>
</aside>
