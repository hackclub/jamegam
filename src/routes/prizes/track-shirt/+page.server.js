// /prizes/track-shirt?order=NNN (Apliiq) or ?order=pNNN (Printful): a bare
// t-shirt order status lookup with no auth. That's fine because nothing
// personal reaches the page: the client only ever gets the Tracking shape below
// (stage, carrier, tracking number, dates), never a name, address, email,
// phone or size. Lookups go straight to the vendor by its own order id; this
// route never reads Airtable or accepts Airtable record ids.
//
// Tracking = { vendor, label, stage, expected, tracking, carrier, trackingUrl, shipDate }
import { lookupOrder } from '$lib/server/apliiq.js';
import { lookupPrintfulOrder } from '$lib/server/printful.js';

export const prerender = false; // overrides the layout's prerender

async function lookup(order) {
  const printful = /^p(\d+)$/i.exec(order);
  if (printful) return lookupPrintfulOrder(printful[1]);
  if (!/^\d+$/.test(order)) return { found: false };

  const r = await lookupOrder(order);
  if (!r.found) return r;
  return {
    configured: true,
    found: true,
    vendor: 'apliiq',
    label: order,
    stage: r.tracking ? 'shipped' : 'making',
    expected: r.expected,
    tracking: r.tracking,
    carrier: r.carrier,
    trackingUrl: r.trackingUrl,
    shipDate: ''
  };
}

export async function load({ url }) {
  const order = (url.searchParams.get('order') || '').trim();
  if (!order) return { order: '', result: null };
  return { order, result: await lookup(order) };
}
