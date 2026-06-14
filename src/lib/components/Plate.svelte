<script lang="ts">
	// Engraving-style "plate" — shows a real photo when one exists,
	// otherwise a sepia cross-hatch placeholder with a printed caption.
	interface Props {
		caption?: string;
		imageUrl?: string | null;
		alt?: string;
		class?: string;
	}
	let { caption = '', imageUrl = null, alt = '', class: cls = '' }: Props = $props();
</script>

<div class="plate {cls} {imageUrl ? 'has-img' : ''}">
	<span class="corner a"></span><span class="corner b"></span>
	<span class="corner c"></span><span class="corner d"></span>
	{#if imageUrl}
		<img src={imageUrl} alt={alt || caption} />
	{:else if caption}
		<span class="cap">{caption}</span>
	{/if}
</div>
