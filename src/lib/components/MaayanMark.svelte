<script lang="ts">
	// Purple marker for Maayan's foods.
	//  · regular  → a small filled plum dot ("one of Maayan's foods")
	//  · top=true → a glowing little gem ("extra-recommended" — the bold items)
	let { top = false, size = 9 }: { top?: boolean | null; size?: number } = $props();

	const label = $derived(top ? 'מומלץ במיוחד למעיין' : 'מהמזונות של מעיין');
</script>

<span
	class="mm"
	class:mm-top={top}
	style="--mm-size:{size}px"
	title={label}
	role="img"
	aria-label={label}
></span>

<style>
	.mm {
		display: inline-block;
		width: var(--mm-size, 9px);
		height: var(--mm-size, 9px);
		border-radius: 50%;
		background: var(--maayan, #8a4fa0);
		vertical-align: middle;
		flex: 0 0 auto;
	}
	.mm-top {
		/* a touch larger, with a soft gem highlight + halo ring */
		width: calc(var(--mm-size, 9px) + 2px);
		height: calc(var(--mm-size, 9px) + 2px);
		background: radial-gradient(circle at 34% 30%, var(--maayan-bright, #b274c8), var(--maayan, #8a4fa0) 68%);
		box-shadow:
			0 0 0 2px var(--maayan-ring, rgba(138, 79, 160, 0.22)),
			0 0 6px -1px var(--maayan, #8a4fa0);
	}
</style>
