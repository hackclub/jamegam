// Hack Club Auth (auth.hackclub.com) - OIDC. An HCA account == a Hack Club Slack
// account, so the public check below also tells us whether they're in the Slack.
import { config } from './config.js';

// Public, no-auth endpoint. Returns the raw result string, or 'error' if the
// call itself failed. Possible results: needs_submission | pending |
// verified_eligible | verified_but_over_18 | rejected | not_found
export async function checkAccount(email) {
  try {
    const url = `${config.hca.issuer}/api/external/check?email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    if (!res.ok) return 'error';
    const data = await res.json();
    return data.result ?? 'error';
  } catch {
    return 'error';
  }
}

// 'has' (account exists) | 'none' (no account) | 'unknown' (check failed)
export function accountState(result) {
  if (result === 'not_found') return 'none';
  if (result === 'error') return 'unknown';
  return 'has';
}

export function authorizeUrl({ redirectUri, state, loginHint, scope }) {
  const p = new URLSearchParams({
    client_id: config.hca.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope || config.hca.scope,
    state
  });
  // login_hint prefills the email on HCA's screen so they don't retype it
  if (loginHint) p.set('login_hint', loginHint);
  return `${config.hca.issuer}/oauth/authorize?${p}`;
}

// Fetch the user's identity from the REST endpoint. Returns all fields the app's
// scopes grant (primary_email, first_name, last_name, slack_id, verification_status)
// - richer than the id_token, which omits the name for the `name` scope.
export async function fetchMe(accessToken) {
  const res = await fetch(`${config.hca.issuer}/api/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`HCA /api/v1/me failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.identity ?? data;
}

// ISO expiry for a token-exchange response. Doorkeeper returns created_at and
// expires_in (both seconds); HCA's configured lifetime is 6 months, used as
// the fallback when either is missing.
export function tokenExpiresAt(tokens) {
  const created = tokens.created_at ?? Math.floor(Date.now() / 1000);
  const ttl = tokens.expires_in ?? 182 * 24 * 3600;
  return new Date((created + ttl) * 1000).toISOString();
}

export async function exchangeCode({ code, redirectUri }) {
  const res = await fetch(`${config.hca.issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.hca.clientId,
      client_secret: config.hca.clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) throw new Error(`HCA token exchange failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, id_token, ... }
}

// Decode (not cryptographically verify) the id_token payload. Safe here: the
// token arrives directly from the issuer over TLS in this server-side exchange,
// not through the browser, so the transport is the trust boundary.
export function decodeIdToken(idToken) {
  const payload = idToken.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

// Normalize HCA's `address` claim (OIDC structured object, or a plain string) into
// the parts the submission form uses, plus a one-line `text` for the card. Returns
// null when no address is set. Tolerant of key variants since the exact shape is
// only confirmable against a real grant.
export function parseAddress(addr) {
  if (!addr) return null;
  if (typeof addr === 'string') {
    const t = addr.trim();
    return t ? { line1: t, line2: '', city: '', region: '', postal: '', country: '', text: t } : null;
  }
  const street = String(addr.street_address || addr.line1 || '').trim();
  const lines = street.split(/\r?\n/).filter(Boolean);
  const city = addr.locality || addr.city || '';
  const region = addr.region || addr.state || '';
  const postal = addr.postal_code || addr.zip || '';
  const country = addr.country || '';
  const text =
    addr.formatted ||
    [street.replace(/\r?\n/g, ', '), city, region, postal, country].filter(Boolean).join(', ');
  if (!text) return null;
  return { line1: lines[0] || '', line2: lines.slice(1).join(', '), city, region, postal, country, text };
}

// HCA users can have multiple mailing addresses; /api/v1/me returns them as an
// `addresses` array (address scope), each with a `primary` flag. Normalize to the
// parts the form + picker use. Falls back to the single OIDC `address` claim if
// the array isn't present.
//
// `accountPhone` is the identity-level phone_number (`phone` scope). Addresses
// often lack their own phone (users set it on "My info", not the address), so
// it backfills any address without one - shipping requires a phone on the label.
export function normalizeAddresses(meAddresses, claimAddress, accountPhone = '') {
  const out = [];
  if (Array.isArray(meAddresses)) {
    for (const a of meAddresses) {
      out.push({
        id: String(a.id ?? out.length),
        line1: a.line_1 || '',
        line2: a.line_2 || '',
        city: a.city || '',
        region: a.state || '',
        postal: a.postal_code || '',
        country: a.country || '',
        phone: a.phone_number || accountPhone || '',
        primary: !!a.primary
      });
    }
  }
  if (!out.length) {
    const p = parseAddress(claimAddress);
    if (p) {
      out.push({
        id: '0',
        line1: p.line1,
        line2: p.line2,
        city: p.city,
        region: p.region,
        postal: p.postal,
        country: p.country,
        phone: accountPhone || '',
        primary: true
      });
    }
  }
  return out;
}
