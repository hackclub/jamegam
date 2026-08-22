// Minimal Apliiq order lookup, server-only. Backs /prizes/track-shirt.
//
// Apliiq's Create Order API is HMAC-signed: the Authorization header is
// `x-apliiq-auth RTS:SIG:APPID:STATE`, where
//   SIG = base64(HMAC-SHA256(APPID + RTS + STATE + base64(body), SharedSecret))
// A GET has an empty body, so the base64-content term is "".
//
// If the creds aren't set, lookupOrder returns { configured: false } and the
// caller shows a graceful "tracking unavailable" message - the rest of the site
// never touches this.
import { createHmac, randomUUID } from 'node:crypto';
import { config } from './config.js';

const API = 'https://api.apliiq.com/v1/Order';

function authHeader(appId, secret) {
  const rts = Math.floor(Date.now() / 1000).toString();
  const state = randomUUID();
  const sig = createHmac('sha256', secret).update(appId + rts + state + '').digest('base64');
  return `x-apliiq-auth ${rts}:${sig}:${appId}:${state}`;
}

// Look up one order by its Apliiq order id. Returns:
//   { configured:false }                  - no creds
//   { found:false }                       - no such order
//   { found:true, status, expected,
//     tracking, carrier, trackingUrl }    - the bits the page shows
export async function lookupOrder(orderId) {
  const { appId, sharedSecret } = config.apliiq;
  if (!appId || !sharedSecret) return { configured: false };

  const id = String(orderId).trim();
  if (!/^\d+$/.test(id)) return { found: false };

  let res;
  try {
    res = await fetch(`${API}/${id}`, {
      headers: { Authorization: authHeader(appId, sharedSecret), Accept: 'application/json' }
    });
  } catch {
    return { configured: true, error: true };
  }
  if (res.status === 404) return { found: false };
  if (!res.ok) return { configured: true, error: true };

  let data;
  try {
    data = await res.json();
  } catch {
    return { configured: true, error: true };
  }
  const order = Array.isArray(data) ? data[0] : data;
  if (!order || !order.OrderId) return { found: false };

  const sn = (order.SN && order.SN[0]) || {};
  const tracking = (sn.TrackingNumber || '').trim();
  const carrier = (sn.Carrier || '').trim();
  return {
    configured: true,
    found: true,
    status: (order.Status || '').trim(),
    help: (sn.Helptext || '').trim(),
    expected: (order.ExpectedDate || '').trim(),
    tracking,
    carrier,
    trackingUrl: tracking ? trackingUrl(carrier, tracking) : ''
  };
}

// Best-effort carrier tracking link; falls back to empty (page shows the raw
// number) when the carrier isn't one we recognise.
function trackingUrl(carrier, num) {
  const c = carrier.toLowerCase();
  const n = encodeURIComponent(num);
  if (c.includes('usps')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  if (c.includes('dhl')) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;
  return '';
}
