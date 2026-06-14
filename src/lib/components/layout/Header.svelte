<script lang="ts">
	import { page } from '$app/state';

	function sectionTitle(pathname: string): string {
		if (pathname === '/') return 'השער';
		if (pathname === '/recipes') return 'המתכונים שלי';
		if (pathname.startsWith('/recipes/import')) return 'ייבוא מתכון';
		if (pathname.startsWith('/recipes/new')) return 'מתכון חדש';
		if (pathname.endsWith('/edit')) return 'עריכת מתכון';
		if (pathname.startsWith('/recipes/')) return 'מתכון';
		if (pathname.startsWith('/shopping')) return 'רשימת השוק';
		if (pathname.startsWith('/pantry')) return 'המזווה';
		if (pathname.startsWith('/ingredients')) return 'מצרכים';
		if (pathname.startsWith('/aisles')) return 'מדורים';
		if (pathname.startsWith('/login')) return 'כניסה';
		return '';
	}
</script>

<header class="topbar">
	<a href="/" class="flex items-baseline gap-2">
		<span class="top-orn">❧</span>
		<span class="top-title title-script">Soul Food</span>
	</a>
	<span class="folio">{sectionTitle(page.url.pathname)}</span>
</header>
