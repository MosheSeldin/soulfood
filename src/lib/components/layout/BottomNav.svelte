<script lang="ts">
	import { page } from '$app/state';
	import { BookOpen, ShoppingCart, Refrigerator, Egg } from 'lucide-svelte';

	const links = [
		{ href: '/recipes', label: 'מתכונים', icon: BookOpen },
		{ href: '/shopping', label: 'קניות', icon: ShoppingCart },
		{ href: '/pantry', label: 'מלאי', icon: Refrigerator },
		{ href: '/ingredients', label: 'מצרכים', icon: Egg }
	];
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white md:hidden">
	<div class="flex items-center justify-around">
		{#each links as link}
			<a
				href={link.href}
				class="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors {page.url
					.pathname === link.href ||
				page.url.pathname.startsWith(link.href + '/')
					? 'text-primary font-semibold'
					: 'text-text-muted'}"
			>
				<link.icon size={22} />
				<span>{link.label}</span>
			</a>
		{/each}
	</div>
</nav>
