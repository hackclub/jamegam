// Slack - invite an existing member into #jame-gam by their Slack user id.
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

export async function inviteToChannel(slackUserId) {
  const res = await fetch('https://slack.com/api/conversations.invite', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.slack.botToken}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ channel: config.slack.channelId, users: slackUserId })
  });
  const data = await res.json();
  // already_in_channel is a no-op success for us
  if (!data.ok && data.error !== 'already_in_channel') {
    throw new Error(`Slack invite failed: ${data.error}`);
  }
  return data;
}
