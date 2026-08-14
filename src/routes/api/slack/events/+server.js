// POST /api/slack/events - the jame gam Slack app's Events API endpoint.
//
// When someone joins #jame-gam (including everyone the signup flow auto-invites)
// the bot posts WELCOME as an ephemeral, so only they see it. It has to be a bot:
// Slack's no-code Workflow Builder does exactly this, but it's disabled
// workspace-wide in the Hack Club Slack.
//
// Fires on every join, not just the first - member_joined_channel carries no
// join count, and an ephemeral is cheap enough that tracking who's been
// welcomed isn't worth a datastore.
//
// Slack app setup (api.slack.com/apps -> jame_gam):
//   Basic Information -> Signing Secret -> SLACK_SIGNING_SECRET (Vercel + .env)
//   Event Subscriptions -> Request URL: https://jamegam.hackclub.com/api/slack/events
//   Subscribe to bot events -> member_joined_channel (channels:read, already granted)
// The bot is already in #jame-gam, which it needs to be for both halves.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '$lib/server/config.js';

export const prerender = false;

// A copy of the channel's anchored message - change the pin, change this.
const WELCOME = `:jamegam-yay: welcome to jame gam!!! every month we crash a game jam together, and anyone who submits gets a prize

:jamegam-welcome: new here?
1. sign up at <https://slack-no-unfurl.vercel.app/?u=https%3A%2F%2Fjamegam.hackclub.com|jamegam.hackclub.com>,
2. *read the pinned message in <#C0BBDUFF7K8> for info on what to do!*
3. ping :jamegam-sticker-thing: <!subteam^S0BHFMR6G1E> in <#C0BBFQASBV2> if you need help, and read the faq! it's quicker than dms ;)`;

// v0 signature over the RAW body - reparsing would change the bytes.
function verify(raw, sig, ts) {
  const secret = config.slack.signingSecret;
  if (!secret || !sig || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mine = Buffer.from(`v0=${createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex')}`);
  const theirs = Buffer.from(sig);
  return mine.length === theirs.length && timingSafeEqual(mine, theirs);
}

export async function POST({ request }) {
  const raw = await request.text();
  const h = (n) => request.headers.get(n);
  if (!verify(raw, h('x-slack-signature'), h('x-slack-request-timestamp'))) {
    return new Response('bad signature', { status: 401 });
  }

  const body = JSON.parse(raw);
  // one-off handshake when the Request URL is saved in the app config
  if (body.type === 'url_verification') return new Response(String(body.challenge ?? ''));

  const e = body.event;
  // Slack retries anything not 200'd within 3s; acking retries avoids double-posting
  if (!h('x-slack-retry-num') && e?.type === 'member_joined_channel' && e.channel === config.slack.channelId) {
    const res = await fetch('https://slack.com/api/chat.postEphemeral', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.slack.botToken}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ channel: e.channel, user: e.user, text: WELCOME, unfurl_links: false })
    });
    const data = await res.json();
    // never 500 at Slack - that just buys a retry of something already broken
    if (!data.ok) console.error('[slack/events] welcome failed for', e.user, data.error);
  }

  return new Response('ok');
}
