// POST /api/signup - the email box submits here via fetch (no page navigation).
// Captures the email instantly: check account status -> save to Airtable (which
// puts them on the Loops list) -> send the right welcome email. Returns JSON.
import { json } from '@sveltejs/kit';
import { checkAccount, accountState } from '$lib/server/hca.js';
import { findByEmail, upsertSignup } from '$lib/server/airtable.js';
import { sendTransactional } from '$lib/server/loops.js';
import { lookupSlackIdByEmail, inviteToChannel } from '$lib/server/slack.js';
import { rateLimit } from '$lib/server/ratelimit.js';
import { config, F } from '$lib/server/config.js';
import { JAM, isBetweenJams } from '$lib/jam.js';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST({ request, getClientAddress }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const honeypot = String(body?.company ?? '').trim(); // hidden field; only bots fill it

  // silently accept-and-drop bots so they don't learn they were caught
  if (honeypot) return json({ ok: true, hasAccount: true });

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: 'enter a valid email' }, { status: 422 });
  }

  if (!rateLimit(getClientAddress())) {
    return json({ ok: false, error: 'slow down a sec! try again in a moment' }, { status: 429 });
  }

  // 0. already signed up? short-circuit on a repeat submit (same email, or a
  //    second box further down the page) so we don't re-send the welcome email
  //    or re-run the Slack invite. They're already captured + on the Loops list.
  try {
    const existing = await findByEmail(email);
    if (existing) {
      return json({ ok: true, hasAccount: !!existing.fields?.[F.hadAccount], alreadySignedUp: true });
    }
  } catch (err) {
    // a find failure shouldn't block a signup - fall through to the normal path
    console.error('[signup] dedup check failed, continuing:', err);
  }

  // 1. already a Hack Club account? (an account == being in the Slack)
  const result = await checkAccount(email);
  // 'none' -> the "[action needed] create account" email. 'has'/'unknown' -> the
  // low-key one (don't risk sending "[action needed]" to an existing member on a
  // transient check failure).
  const hasAccount = accountState(result) !== 'none';

  // 2. existing Slack member? add them to #jame-gam right now (best-effort).
  //    Newcomers (not in Slack yet) return null here and get invited by the OAuth
  //    callback once their account exists. Needs bot scope users:read.email.
  let slackId = null;
  try {
    slackId = await lookupSlackIdByEmail(email);
    if (slackId) await inviteToChannel(slackId);
  } catch (err) {
    console.error('[signup] slack auto-invite skipped:', err);
  }

  // 3. durable capture. The auto "Loops List - jameGam" formula field subscribes
  //    them to the list. had_account_at_signup + signup_origin are written once
  //    here and never overwritten by the callback.
  const origin = config.origin || new URL(request.url).origin;
  const fields = {
    [F.email]: email,
    [F.hadAccount]: hasAccount,
    [F.signupOrigin]: new URL(origin).host,
    [F.jam]: [JAM.airtableRecordId] // link to the current jam (a linked-record field)
  };
  if (accountState(result) !== 'unknown') fields[F.status] = result;
  if (slackId) {
    fields[F.slackId] = slackId;
    fields[F.slackInvited] = true;
  }
  await upsertSignup(fields);

  // 4. welcome email (transactional). Best-effort: the signup is already saved
  //    and on the list, so a send failure is logged but still reports success.
  //    the normal emails assume an upcoming/running jam; between jams (ended,
  //    next not announced) send the "we'll be back" variants instead.
  const tx = isBetweenJams()
    ? (hasAccount ? config.loops.txBetweenHasAccount : config.loops.txBetweenNoAccount)
    : (hasAccount ? config.loops.txHasAccount : config.loops.txNoAccount);
  try {
    await sendTransactional({
      transactionalId: tx,
      email,
      dataVariables: {
        name: 'chat', // first email: we only have their email, not their name
        joinUrl: `${origin}/api/auth/login?email=${encodeURIComponent(email)}`
      }
    });
  } catch (err) {
    console.error('[signup] welcome email failed:', err);
  }

  return json({ ok: true, hasAccount });
}
