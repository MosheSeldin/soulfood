<script lang="ts">
	import { enhance } from '$app/forms';
	import { UtensilsCrossed } from 'lucide-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedName = $state(data.names[0] || '');
	let isFirstTime = $derived(!data.names.length || data.names.every(() => true));
</script>

<div class="sacred-mandala flex min-h-[80dvh] items-center justify-center">
	<div class="relative z-10 w-full max-w-xs space-y-6">
		<div class="text-center">
			<div class="logo-ring mx-auto inline-flex">
				<UtensilsCrossed size={40} class="text-primary" />
			</div>
			<h1 class="mt-6 font-heading text-2xl font-bold text-primary brand-glow">Soul Food</h1>
			<p class="mt-1 text-sm text-text-muted">ניהול מתכונים ורשימות קניות</p>
		</div>

		<form method="POST" use:enhance class="glass-card space-y-4 p-6">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-text">שם</label>
				<select
					id="name"
					name="name"
					bind:value={selectedName}
					class="input-glass w-full"
				>
					{#each data.names as name}
						<option value={name}>{name}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-text">
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
					class="input-glass w-full"
					placeholder="הכנס סיסמה"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}

			<button type="submit" class="btn-primary w-full">
				כניסה
			</button>
		</form>
	</div>
</div>
