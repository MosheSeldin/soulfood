<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Soul Food · ספר מתכונים</title>
	<meta name="description" content="ניהול מתכונים ורשימות קניות חכמות" />
</svelte:head>

<div id="app" class="paper">
	<Sidebar />
	<div class="main-wrap">
		<Header />
		<main class="main scroll">
			{@render children()}
		</main>
		<BottomNav />
	</div>
</div>
