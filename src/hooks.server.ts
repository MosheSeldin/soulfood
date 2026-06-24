import type { Handle } from '@sveltejs/kit';

// Auth removed — the app is open to everyone. No session lookup, no redirects.
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	return resolve(event);
};
