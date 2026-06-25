// Slack profile lookup via cachet (taciturnaxolotl/cachet), Hack Club's cached
// Slack profile proxy at cachet.dunkirk.sh. Public + auth-free, so no bot token
// or users:read scope needed. Used for the "signed in as <name>" card in the
// submit form (display name + avatar). On a cache miss cachet returns 202 with a
// placeholder and warms the cache in the background, so we wait briefly and retry
// once. Best-effort: returns null on any miss (it's display-only).
const CACHET = 'https://cachet.dunkirk.sh';

export async function lookupSlackProfile(slackUserId) {
  const url = `${CACHET}/users/${encodeURIComponent(slackUserId)}`;
  try {
    let res = await fetch(url);
    if (res.status === 202) {
      await new Promise((r) => setTimeout(r, 500));
      res = await fetch(url); // background fetch should be warm now
    }
    if (!res.ok) return null;
    const data = await res.json();
    return {
      handle: data.displayName || null,
      imageUrl: data.imageUrl || null,
      pronouns: data.pronouns || null
    };
  } catch {
    return null;
  }
}
