<script lang="ts">
	import { enhance } from '$app/forms';
	import { UtensilsCrossed } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedName = $state(data.names[0] || '');
	let isFirstTime = $derived(!data.names.length || data.names.every(() => true));
</script>

<div class="flex min-h-[80dvh] items-center justify-center">
	<div class="w-full max-w-xs space-y-6">
		<div class="text-center">
			<UtensilsCrossed size={40} class="mx-auto text-primary" />
			<h1 class="mt-3 text-2xl font-bold text-primary">Soul Food</h1>
			<p class="mt-1 text-sm text-text-muted">ניהול מתכונים ורשימות קניות</p>
		</div>

		<form method="POST" use:enhance class="space-y-4">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium">שם</label>
				<select
					id="name"
					name="name"
					bind:value={selectedName}
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				>
					{#each data.names as name}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm font-medium">
					סיסמה
					{#if isFirstTime}
						<span class="text-xs text-text-muted">(בחר סיסמה חדשה)</span>
					{/if}
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					class="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					placeholder="הכנס סיסמה"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}

			<button
				type="submit"
				class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
			>
				כניסה
			</button>
		</form>
	</div>
</div>
