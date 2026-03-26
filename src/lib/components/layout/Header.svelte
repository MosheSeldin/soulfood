<script lang="ts">
	import { UtensilsCrossed } from 'lucide-svelte';

	interface Props {
		title?: string;
	}

	let { title = 'Soul Food' }: Props = $props();
</script>

<header class="flex items-center gap-2 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-md md:hidden">
	<UtensilsCrossed size={22} class="text-primary" />
	<h1 class="font-heading text-lg font-bold text-primary brand-glow">{title}</h1>
</header>
