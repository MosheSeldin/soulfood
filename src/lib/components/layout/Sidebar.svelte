<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/recipes', he: 'מתכונים', lat: 'Recipes' },
		{ href: '/shopping', he: 'קניות', lat: 'Market' },
		{ href: '/lists', he: 'רשימות', lat: 'Lists' },
		{ href: '/pantry', he: 'מזווה', lat: 'Pantry' },
		{ href: '/ingredients', he: 'מצרכים', lat: 'Ingredients' }
	];

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<aside class="side">
	<a class="brand" href="/recipes">
		<span class="brand-orn">❧</span>
		<span class="brand-name">Soul Food</span>
		<span class="brand-sub kicker">Le Petit Carnet · est. 1952</span>
	</a>
	<nav class="side-nav">
		{#each links as link}
			<a class="side-link {isActive(link.href, page.url.pathname) ? 'on' : ''}" href={link.href}>
				<span class="side-he">{link.he}</span>
				<span class="side-lat">{link.lat}</span>
			</a>
		{/each}
	</nav>
	<div class="side-foot">
		<div class="fleuron"><span>❦</span></div>
		<p class="hand side-note">מטבח אחד,<br />אלף סיפורים.</p>
	</div>
</aside>
