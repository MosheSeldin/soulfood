<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', he: 'השער', lat: 'Cover' },
		{ href: '/recipes', he: 'מתכונים', lat: 'Recipes' },
		{ href: '/shopping', he: 'קניות', lat: 'Market' },
		{ href: '/pantry', he: 'מזווה', lat: 'Pantry' },
		{ href: '/ingredients', he: 'מצרכים', lat: 'Ingredients' }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<nav class="botnav">
	{#each links as link}
		<a class="bot-link {isActive(link.href, page.url.pathname) ? 'on' : ''}" href={link.href}>
			<span class="bot-he">{link.he}</span>
			<span class="bot-lat kicker">{link.lat}</span>
		</a>
	{/each}
</nav>
