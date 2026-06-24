<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/ingredients', he: 'בנק מצרכים', lat: 'Le Garde-Manger' },
		{ href: '/lists', he: 'רשימות', lat: 'Mes Listes' }
	];

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<nav class="sec-tabs" aria-label="ניווט מצרכים">
	{#each tabs as tab}
		<a
			href={tab.href}
			class="sec-tab {isActive(tab.href, page.url.pathname) ? 'on' : ''}"
			aria-current={isActive(tab.href, page.url.pathname) ? 'page' : undefined}
		>
			<span class="sec-he">{tab.he}</span>
			<span class="sec-lat">{tab.lat}</span>
		</a>
	{/each}
</nav>

<style>
	.sec-tabs {
		display: inline-flex;
		gap: 0.3rem;
		padding: 0.32rem;
		margin-bottom: 1.4rem;
		background: var(--card);
		border: 1px solid var(--card-edge);
		border-radius: 999px;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.5) inset,
			0 6px 16px -12px rgba(60, 40, 15, 0.5);
	}
	.sec-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.05rem;
		line-height: 1.05;
		padding: 0.4rem 1.25rem;
		border-radius: 999px;
		color: var(--ink-muted);
		transition: all 0.18s ease;
	}
	.sec-tab .sec-he {
		font-family: var(--serif);
		font-weight: 600;
		font-size: 1rem;
		color: inherit;
	}
	.sec-tab .sec-lat {
		font-family: var(--latin);
		font-style: italic;
		font-size: 0.68rem;
		letter-spacing: 0.02em;
		opacity: 0.7;
	}
	.sec-tab:not(.on):hover {
		color: var(--ink);
		background: rgba(44, 36, 26, 0.05);
	}
	.sec-tab.on {
		background: var(--rubric);
		color: var(--paper-2);
		box-shadow: 1px 1px 0 rgba(44, 36, 26, 0.18);
	}
</style>
