// GET /api/auth/callback - Hack Club Auth redirects here after the user signs in
// (or creates an account). We verify state, exchange the code, fetch the
// identity, then branch on flow:
//   - signup flow  -> upsert the signup, drop them into #jame-gam, back to the
//     site (?join=ok)
//   - submit flow  -> back into the Fillout form, identity prefilled in the URL
//     (hca_id_token carries HCA's signed id_token as the anti-forgery anchor)
//   - shop flow    -> mint the signed shop session cookie (identity + addresses
//     from this grant, no signup side effects) and land on /prizes
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
  exchangeCode,
  fetchMe,
  decodeIdToken,
  normalizeAddresses,
  tokenExpiresAt
} from '$lib/server/hca.js';
import { upsertSignup, markById } from '$lib/server/airtable.js';
import { inviteToChannel } from '$lib/server/slack.js';
import { lookupSlackProfile } from '$lib/server/cachet.js';
import { buildSubmitRedirect, submitErrorUrl } from '$lib/server/submit.js';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE } from '$lib/server/session.js';
import { config, F } from '$lib/server/config.js';

export const prerender = false;

export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = cookies.get('hca_state');
  cookies.delete('hca_state', { path: '/' });

  // Set only on the submit flow; presence is what distinguishes it from signup.
  const ret = cookies.get('hca_return');
  cookies.delete('hca_return', { path: '/' });

  // Set only on the shop flow.
  const shop = cookies.get('hca_flow') === 'shop';
  cookies.delete('hca_flow', { path: '/' });

  const site = config.origin || url.origin;
  const fail = shop ? `${site}/prizes?auth=error` : ret ? submitErrorUrl(ret) : `${site}/?join=error`;

  // bad/forged callback or user denied - bounce back with an error flag
  if (!code || !state || !saved || state !== saved) {
    redirect(302, fail);
  }

  let dest = shop ? `${site}/prizes` : `${site}/?join=ok`;
  try {
    const tokens = await exchangeCode({ code, redirectUri: `${site}/api/auth/callback` });
    // /api/v1/me returns every field the app's scopes grant, including
    // first_name/last_name (which the id_token omits for the `name` scope).
    const id = await fetchMe(tokens.access_token);
    const email = String(id?.primary_email ?? '').toLowerCase();
    if (!email) throw new Error('no email from /api/v1/me - check HCA app scopes');
    const slackId = id.slack_id ?? null;

    // Address + birthdate ride in the id_token's claims (step-up scope). Fall
    // back to /me in case HCA surfaces them there instead.
    let claims = {};
    if (shop || ret) {
      try {
        claims = decodeIdToken(tokens.id_token);
      } catch (err) {
        console.error('[callback] id_token decode failed:', err);
      }
    }
    // /api/v1/me returns `birthday` (not `birthdate`); fall back to the
    // id_token's OIDC `birthdate` claim.
    const birthday = id.birthday || claims.birthdate || '';

    if (shop) {
      // Shop flow: no signup side effects - just mint the session /prizes reads.
      // Addresses capped so the cookie stays comfortably under the 4KB limit.
      const addresses = normalizeAddresses(id.addresses, claims.address).slice(0, 5);
      cookies.set(
        SESSION_COOKIE,
        createSession({
          email,
          firstName: id.first_name ?? '',
          lastName: id.last_name ?? '',
          slackId: slackId ?? '',
          birthday,
          addresses
        }),
        { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: SESSION_MAX_AGE }
      );
    } else {
      const fields = {
        [F.email]: email,
        [F.firstName]: id.first_name ?? '',
        [F.lastName]: id.last_name ?? '',
        [F.slackId]: slackId ?? '',
        [F.status]: id.verification_status ?? 'needs_submission'
      };
      // Submit flow: keep the access token (valid ~6mo). /api/v1/me with it
      // returns their *current* HCA data, so a later pull can grab an address
      // they add after submitting - no re-auth needed. Clear the token once
      // used. A repeat auth overwrites with the same token (HCA reuses
      // unexpired tokens).
      if (ret) {
        fields[F.hcaToken] = tokens.access_token;
        fields[F.hcaTokenExpires] = tokenExpiresAt(tokens);
      }
      const rec = await upsertSignup(fields);

      // HCA account == Slack account, so slack_id is present -> auto-add to #jame-gam
      if (slackId) {
        try {
          await inviteToChannel(slackId);
          await markById(rec.id, { [F.slackInvited]: true });
        } catch (err) {
          console.error('[callback] slack invite failed:', err);
        }
      }

      // submit flow: return into the form with identity prefilled
      if (ret) {
        let slackHandle = null;
        let slackAvatar = null;
        if (slackId) {
          try {
            const prof = await lookupSlackProfile(slackId);
            slackHandle = prof?.handle ?? null;
            slackAvatar = prof?.imageUrl ?? null;
          } catch (err) {
            console.error('[callback] cachet profile lookup failed:', err);
          }
        }
        // Multiple mailing addresses possible; default to the primary, the form's
        // picker can switch among the rest.
        const addresses = normalizeAddresses(id.addresses, claims.address);
        const active = addresses.find((a) => a.primary) || addresses[0] || null;

        const d = buildSubmitRedirect(ret, {
          email,
          firstName: id.first_name,
          lastName: id.last_name,
          slackId,
          slackHandle,
          slackAvatar,
          status: id.verification_status,
          idToken: tokens.id_token,
          birthday,
          addresses,
          addrId: active?.id,
          addr1: active?.line1,
          addr2: active?.line2,
          city: active?.city,
          region: active?.region,
          postal: active?.postal,
          country: active?.country,
          phone: active?.phone
        });
        if (d) dest = d;
      }
    }
  } catch (err) {
    console.error('[callback] oauth failed:', err);
    dest = fail;
  }

  redirect(302, dest);
}
