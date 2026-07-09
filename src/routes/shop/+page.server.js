// /shop moved to /prizes - keep old links (DMs, slack messages) working.
import { redirect } from '@sveltejs/kit';

export const prerender = false;

export function load({ url }) {
  redirect(308, `/prizes${url.search}`);
}
