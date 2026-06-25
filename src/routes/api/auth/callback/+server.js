// GET /api/auth/callback - Hack Club Auth redirects here after the user signs in
// (or creates an account). We verify state, exchange the code, fetch the identity,
// save it, and drop them into #jame-gam. Then:
//   - signup flow  -> back to the site (?join=ok)
//   - submit flow  -> back into the Fillout form, identity prefilled in the URL
//     (hca_token carries HCA's signed id_token as the anti-forgery anchor).
import { redirect } from '@sveltejs/kit';
import { exchangeCode, fetchMe, decodeIdToken, parseAddress } from '$lib/server/hca.js';
import { upsertSignup, markById } from '$lib/server/airtable.js';
import { inviteToChannel } from '$lib/server/slack.js';
import { lookupSlackProfile } from '$lib/server/cachet.js';
import { buildSubmitRedirect, submitErrorUrl } from '$lib/server/submit.js';
import { config, F } from '$lib/server/config.js';

export const prerender = false;

export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = cookies.get('hca_state');
  cookies.delete('hca_state', { path: '/' });

  // Set only on the submit flow; presence is what distinguishes the two paths.
  const ret = cookies.get('hca_return');
  cookies.delete('hca_return', { path: '/' });

  const site = config.origin || url.origin;
  const fail = ret ? submitErrorUrl(ret) : `${site}/?join=error`;

  // bad/forged callback or user denied - bounce back with an error flag
  if (!code || !state || !saved || state !== saved) {
    redirect(302, fail);
  }

  let dest = `${site}/?join=ok`;
  try {
    const tokens = await exchangeCode({ code, redirectUri: `${site}/api/auth/callback` });
    // /api/v1/me returns every field the app's scopes grant, including
    // first_name/last_name (which the id_token omits for the `name` scope).
    const id = await fetchMe(tokens.access_token);
    const email = String(id?.primary_email ?? '').toLowerCase();
    if (!email) throw new Error('no email from /api/v1/me - check HCA app scopes');
    const slackId = id.slack_id ?? null;

    const rec = await upsertSignup({
      [F.email]: email,
      [F.firstName]: id.first_name ?? '',
      [F.lastName]: id.last_name ?? '',
      [F.slackId]: slackId ?? '',
      [F.status]: id.verification_status ?? 'needs_submission'
    });

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
      // Address + birthdate ride in the id_token's claims (submit-flow scope).
      // Fall back to /me in case HCA surfaces them there instead.
      let claims = {};
      try {
        claims = decodeIdToken(tokens.id_token);
      } catch (err) {
        console.error('[callback] id_token decode failed:', err);
      }
      const birthday = id.birthdate || claims.birthdate || '';
      const addr = parseAddress(id.address || claims.address);

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
        addr1: addr?.line1,
        addr2: addr?.line2,
        city: addr?.city,
        region: addr?.region,
        postal: addr?.postal,
        country: addr?.country,
        addressText: addr?.text
      });
      if (d) dest = d;
    }
  } catch (err) {
    console.error('[callback] oauth failed:', err);
    dest = fail;
  }

  redirect(302, dest);
}
