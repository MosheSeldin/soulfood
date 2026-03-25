import { redirect, fail } from '@sveltejs/kit';
import { login, getUserNames } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/');
	const names = await getUserNames();
	return { names };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const name = data.get('name') as string;
		const password = data.get('password') as string;

		if (!name || !password) {
			return fail(400, { error: 'נא למלא את כל השדות' });
		}

		const result = await login(name, password, cookies);

		if (!result.success) {
			return fail(400, { error: result.error });
		}

		redirect(302, '/');
	}
};
