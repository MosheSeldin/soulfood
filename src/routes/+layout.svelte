<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/layout/Header.svelte';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Soul Food</title>
	<meta name="description" content="ניהול מתכונים ורשימות קניות חכמות" />
</svelte:head>

<div class="flex min-h-dvh">
	<Sidebar />
	<div class="flex flex-1 flex-col pb-16 md:pb-0">
		<Header />
		<main class="flex-1 p-4">
			{@render children()}
		</main>
	</div>
</div>
<BottomNav />
