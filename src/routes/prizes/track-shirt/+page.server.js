// /prizes/track-shirt?order=NNN - dead-simple t-shirt order status lookup.
// No auth: the Apliiq order response carries no PII (no name/address/email),
// just production status + tracking, so a bare order-number lookup is fine.
import { lookupOrder } from '$lib/server/apliiq.js';

export const prerender = false; // overrides the layout's prerender

export async function load({ url }) {
  const order = (url.searchParams.get('order') || '').trim();
  if (!order) return { order: '', result: null };
  return { order, result: await lookupOrder(order) };
}
