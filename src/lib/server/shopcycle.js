// One lookup shared by the /prizes page and the order endpoint: everything this
// person has across the shop's open cycles, narrowed to the cycle the shop shows
// them (resolveCycle in shop.js). Both callers must agree on the cycle, so it is
// derived here on the server from their rows, never taken from the client.
import { findSubmissions, findOrders, findSubmissionsBySlack, findOrdersBySlack } from './shopdb.js';
import { SHOP, SHOP_JAMS, resolveCycle } from '$lib/shop.js';

/**
 * Their submissions + orders across every open cycle. Matched by email; when
 * the email finds nothing (they signed into HCA with a different address than
 * the one on the row), the session's slack id is tried instead, per table.
 */
export async function findMine(email, slackId) {
  let [all, orders] = await Promise.all([
    findSubmissions(email, SHOP_JAMS),
    findOrders(email, SHOP_JAMS)
  ]);
  if (slackId && (!all.length || !orders.length)) {
    [all, orders] = await Promise.all([
      all.length ? all : findSubmissionsBySlack(slackId, SHOP_JAMS),
      orders.length ? orders : findOrdersBySlack(slackId, SHOP_JAMS)
    ]);
  }
  return { all, orders };
}

export async function loadCycle(email, slackId) {
  const { all, orders } = await findMine(email, slackId);
  const jam = resolveCycle(all, orders);
  return {
    jam,
    jamName: SHOP.cycles[jam],
    submissions: all.filter((r) => r.fields.jam === jam),
    order: orders.find((o) => o.fields.jam === jam) ?? null
  };
}
