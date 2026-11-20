// Minimal Printful order lookup, server-only. Backs /prizes/track-shirt for
// orders typed as p<printful order id>.
//
// Only status and the newest shipment's carrier, number and ship date leave
// this module. Recipient, items, costs and Printful's own tracking_url are
// never read into the result. Without a token, lookupPrintfulOrder returns
// { configured: false } and the page says tracking is unavailable.
import { config } from './config.js';
import { trackingUrl } from './apliiq.js';

const API = 'https://api.printful.com/orders';

const STAGES = {
  draft: 'ordered',
  pending: 'ordered',
  inprocess: 'making',
  onhold: 'problem',
  failed: 'problem',
  canceled: 'canceled',
  fulfilled: 'shipped'
};

// Look up one order by its numeric Printful order id. Returns:
//   { configured:false }                 when there is no token
//   { configured:true, error:true }      when Printful could not be reached
//   { found:false }                      when there is no such order
//   { configured:true, found:true, ...Tracking }
export async function lookupPrintfulOrder(orderId) {
  const { token, storeId } = config.printful;
  if (!token) return { configured: false };

  const id = String(orderId).trim();
  if (!/^\d+$/.test(id)) return { found: false };

  let res;
  try {
    res = await fetch(`${API}/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-PF-Store-Id': storeId, Accept: 'application/json' }
    });
  } catch {
    return { configured: true, error: true };
  }
  if (res.status === 404) return { found: false };
  if (!res.ok) return { configured: true, error: true };

  let order;
  try {
    order = (await res.json()).result;
  } catch {
    return { configured: true, error: true };
  }
  if (!order || !order.id) return { found: false };

  // newest first, by when it shipped (or was created, if not shipped yet)
  const shipments = (Array.isArray(order.shipments) ? order.shipments : [])
    .slice()
    .sort((a, b) => (b.shipped_at || b.created || 0) - (a.shipped_at || a.created || 0));
  // Printful creates a shipment (carrier set, no number) as soon as an order is
  // pending, so only a shipment with a tracking number counts as shipped.
  const tracked = shipments.find((s) => String(s.tracking_number || '').trim());

  const status = String(order.status || '').toLowerCase();
  let stage = STAGES[status] || 'making';
  if (status === 'archived') stage = 'canceled';
  if (tracked) stage = 'shipped';
  const shipment = tracked || (stage === 'shipped' && shipments[0]) || {};

  const tracking = String(shipment.tracking_number || '').trim();
  const carrier = String(shipment.carrier || '').trim();
  return {
    configured: true,
    found: true,
    vendor: 'printful',
    label: `p${id}`,
    stage,
    expected: '',
    tracking,
    carrier,
    trackingUrl: tracking ? trackingUrl(carrier, tracking) : '',
    shipDate: String(shipment.ship_date || '').trim()
  };
}
