// Slack - invite an existing member into the jame gam channels by their Slack
// user id (#jame-gam + #jame-gam-announcements).
import { config } from './config.js';

// Resolve a Slack user id from their email (existing members only). Returns null
// if they're not in the workspace yet (users_not_found). Needs bot scope
// users:read.email.
export async function lookupSlackIdByEmail(email) {
  const res = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${config.slack.botToken}` }
  });
  const data = await res.json();
  if (data.ok) return data.user?.id ?? null;
  if (data.error === 'users_not_found') return null;
  throw new Error(`Slack lookupByEmail failed: ${data.error}`);
}

async function inviteToOne(channel, slackUserId) {
  const res = await fetch('https://slack.com/api/conversations.invite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.slack.botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ channel, users: slackUserId })
  });
  const data = await res.json();
  // already_in_channel is a no-op success for us
  if (!data.ok && data.error !== 'already_in_channel') {
    throw new Error(`Slack invite to ${channel} failed: ${data.error}`);
  }
  return data;
}

// Add them to every jame gam channel. Each invite is attempted even if an
// earlier one fails (so a hiccup on one channel can't block the other); the
// first failure is rethrown at the end for the callers' best-effort logging.
export async function inviteToChannel(slackUserId) {
  const channels = [config.slack.channelId, config.slack.announceChannelId].filter(Boolean);
  const results = await Promise.allSettled(channels.map((c) => inviteToOne(c, slackUserId)));
  const failed = results.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}

// DM a jammer as the jame gam bot (chat.postMessage to their user id opens the
// DM; needs chat:write + im:write, which the DM automations already use). Real
// sends are gated on IDV_DMS=on: otherwise the text is only logged and nothing
// leaves the server. Returns { sent }; throws on a Slack error so callers can
// log it (every caller treats DMs as best-effort).
export async function postDM(slackId, text) {
  if (!slackId) throw new Error('postDM: no slack id');
  if (!config.slack.idvDms) {
    console.log(`[slack] DM not sent (IDV_DMS is not on) to ${slackId}:\n${text}`);
    return { sent: false };
  }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.slack.botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ channel: slackId, text, unfurl_links: false })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack DM to ${slackId} failed: ${data.error}`);
  return { sent: true };
}
