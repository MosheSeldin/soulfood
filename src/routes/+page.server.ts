import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The "Cover" page was removed — open the app straight onto the recipe shelf.
export const load: PageServerLoad = async () => {
	redirect(307, '/recipes');
};
