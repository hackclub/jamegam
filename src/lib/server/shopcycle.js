// One lookup shared by the /prizes page and the order endpoint: everything this
// person has across the shop's open cycles, narrowed to the cycle the shop shows
// them (resolveCycle in shop.js). Both callers must agree on the cycle, so it is
// derived here on the server from their rows, never taken from the client.
import { findSubmissions, findOrders } from './shopdb.js';
import { SHOP, SHOP_JAMS, resolveCycle } from '$lib/shop.js';

export async function loadCycle(email) {
  const [all, orders] = await Promise.all([
    findSubmissions(email, SHOP_JAMS),
    findOrders(email, SHOP_JAMS)
  ]);
  const jam = resolveCycle(all, orders);
  return {
    jam,
    jamName: SHOP.cycles[jam],
    submissions: all.filter((r) => r.fields.jam === jam),
    order: orders.find((o) => o.fields.jam === jam) ?? null
  };
}
