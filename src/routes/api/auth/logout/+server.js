// GET /api/auth/logout - clears the shop session ("not you?" on /prizes) and
// returns there so they can sign in with the right account.
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/session.js';

export const prerender = false;

export function GET({ cookies }) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  redirect(302, '/prizes');
}
