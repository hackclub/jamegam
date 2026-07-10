// /gallery - every approved game on one wall. The source of truth is the
// "YSWS Project Submission" table (a row there = reviewed + approved); the
// game title joins in from the linked Submission Form row. Teammates each
// submit the same game, so rows collapse by playable url, keeping everyone's
// first name. Thumbnails come from each itch page's og:image tag (those urls
// don't expire the way Airtable attachment urls do), with the submission
// screenshot as the fallback.
import { config as cfg } from '$lib/server/config.js';
import { lookupSlackProfile } from '$lib/server/cachet.js';

export const prerender = false;
// ISR: the airtable sweep + one itch fetch per game run once per window;
// everyone else gets the cached page instantly.
export const config = { isr: { expiration: 600 } };

const API = 'https://api.airtable.com/v0';

// page through a whole table (the gallery genuinely wants every row)
async function listAll(table, fields) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: '100' });
    for (const f of fields) qs.append('fields[]', f);
    if (offset) qs.set('offset', offset);
    const res = await fetch(
      `${API}/${cfg.airtable.baseId}/${encodeURIComponent(table)}?${qs}`,
      { headers: { Authorization: `Bearer ${cfg.airtable.token}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Airtable list ${table} failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...(data.records ?? []));
    offset = data.offset;
  } while (offset);
  return records;
}

// dedupe key: host + path, no www/query/trailing slash, lowercased - the same
// game submitted by two teammates (or with ?query cruft) collapses to one card
function normUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

const isItch = (raw) => {
  try {
    const h = new URL(raw).hostname;
    return h === 'itch.io' || h.endsWith('.itch.io');
  } catch {
    return false;
  }
};

// og:image straight off the itch page. Cached in module memory - cover art
// basically never changes, so a warm instance skips the fetch entirely.
const THUMB_TTL_MS = 24 * 60 * 60 * 1000;
const thumbCache = new Map(); // norm url -> { src: string|null, at }
async function itchThumb(url, key) {
  const hit = thumbCache.get(key);
  if (hit && Date.now() - hit.at < THUMB_TTL_MS) return hit.src;
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; jamegam-gallery)', accept: 'text/html' },
      signal: AbortSignal.timeout(6000)
    });
    // only a real page counts: a transient 429/5xx must not cache null for a day
    if (!res.ok) return hit?.src ?? null;
    const html = await res.text();
    const src =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      null;
    thumbCache.set(key, { src, at: Date.now() });
    return src;
  } catch {
    // a dead page just falls back to the screenshot; keep the stale cache entry
    return hit?.src ?? null;
  }
}

// names arrive with slack/HCA cruft sometimes - strip bidi control chars
const cleanName = (s) => String(s).replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();

// slack display names via cachet, same memory-cache treatment as the thumbs -
// the "by ..." line uses whatever they go by on the slack, not the form name
const nameCache = new Map(); // slack id -> { name, at }
async function slackName(slackId) {
  const hit = nameCache.get(slackId);
  if (hit && Date.now() - hit.at < THUMB_TTL_MS) return hit.name;
  const profile = await lookupSlackProfile(slackId); // best-effort, null on miss
  const name = cleanName(profile?.handle || '');
  // "Unknown" is cachet's still-warming placeholder - don't show or cache it
  if (!name || /^unknown$/i.test(name)) return null;
  nameCache.set(slackId, { name, at: Date.now() });
  return name;
}

// run fn over items, at most `limit` in flight (be polite to itch)
async function mapLimit(items, limit, fn) {
  const queue = [...items.entries()];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await fn(next[1], next[0]);
    })
  );
}

// the last good result, served if Airtable is having a moment
let stale = null;

export async function load() {
  let games;
  try {
    const [ysws, subs] = await Promise.all([
      listAll(cfg.shop.yswsTable, ['First Name', 'Playable URL', 'Screenshot', 'Submission', 'Description']),
      listAll(cfg.shop.submissionsTable, ['game_title', 'slack_id'])
    ]);
    const subById = new Map(subs.map((r) => [r.id, r.fields]));

    const byUrl = new Map();
    for (const r of ysws) {
      const url = r.fields['Playable URL'];
      const key = (url && normUrl(url)) ?? `rec:${r.id}`;
      const sub = subById.get(r.fields.Submission?.[0]);
      // title: the submission form row's game_title; failing that the first
      // line of the description (the automation writes "title\ndescription"),
      // failing that the itch slug
      const title =
        sub?.game_title ||
        (r.fields.Description || '').split('\n')[0].trim().slice(0, 80) ||
        key.split('/').at(-1)?.replaceAll('-', ' ') ||
        'mystery game';
      const shot = r.fields.Screenshot?.[0];
      const entry = byUrl.get(key) ?? {
        key,
        url,
        title,
        people: [],
        screenshot: shot?.thumbnails?.large?.url ?? shot?.url ?? null
      };
      // one person per ysws row (teammates each submit their own); the slack
      // display name resolves later, first name is the fallback
      const first = (r.fields['First Name'] || '').trim();
      const slackId = sub?.slack_id || null;
      const pid = (slackId || first).toLowerCase();
      if (pid && !entry.people.some((p) => p.pid === pid)) entry.people.push({ pid, slackId, first });
      byUrl.set(key, entry);
    }

    games = [...byUrl.values()];
    await mapLimit(games, 8, async (g) => {
      const og = g.url && isItch(g.url) ? await itchThumb(g.url, g.key) : null;
      g.thumb = og ?? g.screenshot;
      delete g.screenshot;
      const authors = [];
      for (const p of g.people) {
        const name = cleanName((p.slackId && (await slackName(p.slackId))) || p.first || '');
        if (name && !authors.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
          authors.push({ name, slackId: p.slackId });
        }
      }
      g.authors = authors;
      delete g.people;
    });

    // a fresh shuffle every regeneration - everyone gets a turn near the top
    for (let i = games.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [games[i], games[j]] = [games[j], games[i]];
    }
    stale = games;
  } catch (err) {
    console.error('[gallery] load failed:', err);
    games = stale; // null on a cold instance -> the page shows its error state
  }

  return { games };
}
