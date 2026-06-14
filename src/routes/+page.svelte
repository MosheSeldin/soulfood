<script lang="ts">
	import Plate from '$lib/components/Plate.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const categoryLabels: Record<string, string> = {
		main: 'מנה עיקרית', side: 'תוספת', soup: 'מרק', salad: 'סלט',
		dessert: 'קינוח', breakfast: 'ארוחת בוקר', snack: 'חטיף'
	};

	let toc = $derived([
		{ he: 'המתכונים שלי', lat: 'Recipes', n: data.totalRecipes, sub: 'אוסף הבית', href: '/recipes', f: 'i' },
		{ he: 'רשימת השוק', lat: 'Market', n: data.openItems, sub: 'מה שחסר במזווה', href: '/shopping', f: 'ii' }
	]);
</script>

<div class="page home fade">
	<div class="titlepage">
		<p class="kicker tp-top">— מטבח הנשמה · ספר מתכונים —</p>
		<div class="tp-frame">
			<h1 class="tp-title">Soul&nbsp;Food</h1>
			<p class="tp-he">מטבח הנשמה</p>
			<div class="fleuron tp-fl"><span>❧</span></div>
			<p class="tp-tag title-script">recettes &amp; provisions de la maison</p>
		</div>
		<p class="kicker tp-bot">ניהול מתכונים ורשימות קניות · מהדורה ראשונה</p>
	</div>

	<div class="toc">
		<p class="toc-head"><span class="hand">תוכן העניינים</span></p>
		{#each toc as t}
			<a class="toc-row" href={t.href}>
				<span class="toc-fol">{t.f}.</span>
				<span class="toc-main">
					<span class="toc-he">{t.he}</span>
					<span class="toc-sub kicker">{t.lat} · {t.sub}</span>
				</span>
				<span class="toc-leader"></span>
				<span class="toc-n">{t.n}</span>
			</a>
		{/each}
	</div>

	{#if data.featured.length > 0}
		<div class="home-feat">
			<p class="feat-label"><span class="hand">מן המטבח השבוע</span></p>
			<div class="feat-row">
				{#each data.featured as r, i}
					<a class="feat-card sheet" href="/recipes/{r.id}">
						<span class="tape {i % 2 ? 'tr' : 'tl'}"></span>
						<Plate
							caption={r.titleHe || r.title}
							imageUrl={r.imageUrl}
							alt={r.titleHe || r.title}
							class="feat-plate"
						/>
						<div class="feat-body">
							{#if r.category}
								<span class="kicker">{categoryLabels[r.category] || r.category}</span>
							{/if}
							<h3 class="feat-title">{r.titleHe || r.title}</h3>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
