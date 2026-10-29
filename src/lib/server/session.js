// Signed shop session: "base64url(payload).base64url(hmac-sha256)" in an
// httpOnly cookie. The payload carries the HCA identity snapshot the shop needs
// (email, name, addresses, birthday, HCA verification status + identity id) so
// we never store tokens or call HCA again mid-session. Forging it requires SESSION_SECRET; expiry rides inside the
// signed payload so a client can't stretch it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export const SESSION_COOKIE = 'shop_session';
export const SESSION_MAX_AGE = 6 * 60 * 60; // seconds - plenty to browse + pick

const sign = (data) =>
  createHmac('sha256', config.shop.sessionSecret).update(data).digest('base64url');

export function createSession(payload) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

// Returns the payload, or null on ANY problem (missing, garbled, expired,
// forged, secret unset). Callers treat null as signed out.
export function readSession(token) {
  if (!token || !config.shop.sessionSecret) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  let given, expected;
  try {
    given = Buffer.from(mac, 'base64url');
    expected = Buffer.from(sign(body), 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || Date.now() > data.exp) return null;
    // The IDV gate reads verificationStatus + hcaId from the session. One minted
    // before the gate shipped lacks them, so it counts as signed out: one
    // re-sign-in, and the shop never guesses at a status it wasn't given.
    if (typeof data.verificationStatus !== 'string' || typeof data.hcaId !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}
