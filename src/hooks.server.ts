import { redirect, type Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await getSession(event.cookies);
	event.locals.user = session;

	// Protect all routes except login and API
	if (!session && !event.url.pathname.startsWith('/login') && !event.url.pathname.startsWith('/api')) {
		redirect(302, '/login');
	}

	return resolve(event);
};
