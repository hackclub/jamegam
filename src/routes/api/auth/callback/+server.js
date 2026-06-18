// GET /api/auth/callback - Hack Club Auth redirects here after the user signs in
// (or creates an account). We verify state, exchange the code, fetch the identity,
// save it, and drop them into #jame-gam. Then back to the site.
import { redirect } from '@sveltejs/kit';
import { exchangeCode, fetchMe } from '$lib/server/hca.js';
import { upsertSignup, markById } from '$lib/server/airtable.js';
import { inviteToChannel } from '$lib/server/slack.js';
import { config, F } from '$lib/server/config.js';

export const prerender = false;

export async function GET({ url, cookies }) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = cookies.get('hca_state');
  cookies.delete('hca_state', { path: '/' });

  const site = config.origin || url.origin;

  // bad/forged callback or user denied - bounce back with an error flag
  if (!code || !state || !saved || state !== saved) {
    redirect(302, `${site}/?join=error`);
  }

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
  } catch (err) {
    console.error('[callback] oauth failed:', err);
    redirect(302, `${site}/?join=error`);
  }

  redirect(302, `${site}/?join=ok`);
}
