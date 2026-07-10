// GET /api/signup/count - public signup total for the hero's "[n] and counting"
// note. Cached in module memory so a burst of page loads costs one Airtable
// sweep per TTL, not one per visitor. A vanity counter can be a little stale.
import { json } from '@sveltejs/kit';
import { countSignups } from '$lib/server/airtable.js';

export const prerender = false;

const TTL_MS = 5 * 60 * 1000;
let cache = { count: null, at: 0 };

export async function GET() {
  if (cache.count !== null && Date.now() - cache.at < TTL_MS) {
    return json({ ok: true, count: cache.count });
  }
  try {
    const count = await countSignups();
    cache = { count, at: Date.now() };
    return json({ ok: true, count });
  } catch (err) {
    console.error('[signup/count] failed:', err);
    // serve the stale value if we ever had one; otherwise let the client hide
    if (cache.count !== null) return json({ ok: true, count: cache.count });
    return json({ ok: false }, { status: 503 });
  }
}
