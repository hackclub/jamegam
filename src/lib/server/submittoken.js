// Submit token: the only thing the token-mode submit flow puts in the form's
// URL. "base64url(payload).base64url(hmac)", payload { s: Sign Ups record id,
// iat: unix seconds }, so it carries no identity data itself; the card and
// resolve endpoints look the person up server-side from `s`. Signed with
// SESSION_SECRET under a "submit." prefix so a shop session cookie can never
// pass as a submit token (or the reverse).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

const sign = (body) =>
  createHmac('sha256', config.shop.sessionSecret).update(`submit.${body}`).digest('base64url');

export function mintSubmitToken(signupRecId) {
  const body = Buffer.from(
    JSON.stringify({ s: signupRecId, iat: Math.floor(Date.now() / 1000) })
  ).toString('base64url');
  return `${body}.${sign(body)}`;
}

// Returns { s, iat } or null on any problem (garbled, forged, too old, secret
// unset). maxAge is in seconds and is the caller's call: the card endpoint is
// browser-facing and keeps it short, resolve runs right after submit and is
// secret-gated, so it allows longer.
export function readSubmitToken(token, maxAge) {
  if (!token || !config.shop.sessionSecret) return null;
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return null;
  const given = Buffer.from(mac, 'base64url');
  const expected = Buffer.from(sign(body), 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data?.s || !data.iat) return null;
  if (Date.now() / 1000 - data.iat > maxAge) return null;
  return data;
}
