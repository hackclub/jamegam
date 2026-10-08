// /gallery - every approved game on one wall, newest jam first. The source of
// truth is "Submission Form": a game is on the wall when a reviewer said yes
// (GALLERY_STATUSES) *and* Augie spotchecked it.
//
// It deliberately does NOT read "YSWS Project Submission" (which it used to).
// That table is the staging queue for the unified YSWS DB, and the two sets
// disagree in both directions: "Prize Only" games are approved but never stage,
// so they were missing from the wall, and a row that stages and is later
// rejected keeps its staged row if it was already submitted, so a rejected game
// could sit on the wall. Reading the reviewer's actual verdict fixes both.
//
// Teammates each submit the same game, so rows collapse by playable url,
// keeping everyone's first name.
//
// Thumbnails: the cover is the itch page's og:image, stored on the row in
// `itch_thumb` the first time it is scraped so each game costs one itch fetch
// ever (itch 429s a burst of page fetches, and a cold instance has no memory).
// Rows with no cover yet fall back to the submission screenshot, served through
// /gallery/thumb/<rec> rather than linked directly: Airtable attachment urls
// expire after a couple of hours, and this page is ISR-cached and served stale
// first, so a direct link breaks for the first visitor after a quiet stretch.
// Nothing embedded in the page may expire.
import { config as cfg } from '$lib/server/config.js';
import { lookupSlackProfile } from '$lib/server/cachet.js';
import { GALLERY_STATUSES } from '$lib/shop.js';

export const prerender = false;
// ISR: the airtable sweep + one itch fetch per game run once per window;
// everyone else gets the cached page instantly.
// maxDuration: a regeneration is two airtable sweeps, up to SCRAPE_BUDGET itch
// fetches and a cachet lookup per author, ~10-20s cold; Vercel's default
// limit is in that range, and a timed-out regeneration keeps serving stale.
export const config = { isr: { expiration: 600 }, maxDuration: 60 };

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

// shippers type the url by hand, so a scheme-less "foo.itch.io/bar" shows up
// now and then - left alone it links relative to jamegam.hackclub.com (and
// breaks the dedupe key and the thumbnail fetch too)
function withScheme(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
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

// og:image straight off the itch page. The durable copy lives in Airtable
// (`itch_thumb`); this memory cache only bridges a regeneration whose
// write-back failed. Returns { src } on a real page, { throttled: true } on a
// 429, null otherwise. Only successes are cached.
const THUMB_TTL_MS = 24 * 60 * 60 * 1000;
const thumbCache = new Map(); // norm url -> { src, at }
async function itchThumb(url, key) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; jamegam-gallery)', accept: 'text/html' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.status === 429) return { throttled: true };
    if (!res.ok) return null;
    const html = await res.text();
    const src =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      null;
    if (!src) return null;
    thumbCache.set(key, { src, at: Date.now() });
    return { src };
  } catch {
    return null; // dead page: the screenshot fallback covers it
  }
}

// itch rate-limits bursts, so scrape gently: a few in flight, a capped number
// per regeneration, and stop for this round at the first 429. Games left over
// show their screenshot and get picked up by a later regeneration; with the
// result persisted per game the backlog only ever shrinks.
const SCRAPE_LIMIT = 3;
const SCRAPE_BUDGET = 40;

// write the scraped cover onto every row of the game (teammates share it), 10
// records per request, Airtable's batch max. Best-effort: a failed write just
// means the next regeneration scrapes (or memory-serves) it again.
async function persistThumbs(found) {
  const records = found.flatMap(({ rows, src }) => rows.map((id) => ({ id, fields: { itch_thumb: src } })));
  for (let i = 0; i < records.length; i += 10) {
    try {
      const res = await fetch(`${API}/${cfg.airtable.baseId}/${encodeURIComponent(cfg.shop.submissionsTable)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${cfg.airtable.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: records.slice(i, i + 10) }),
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) console.error('[gallery] itch_thumb write failed:', res.status, await res.text());
    } catch (err) {
      console.error('[gallery] itch_thumb write failed:', err);
    }
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

// submission_form.jam is a month key ("2026-07"); the Jams table has the real
// name. Match them on the jam's start month so the section headings read
// "gmtk game jam 2026" instead of a date.
const monthKey = (d) => String(d ?? '').slice(0, 7);

// the last good result, served if Airtable is having a moment
let stale = null;

export async function load() {
  let games;
  let jamNames = {};
  let jamLinks = {};
  try {
    const [subs, jams] = await Promise.all([
      listAll(cfg.shop.submissionsTable, [
        'game_title',
        'slack_id',
        'first_name',
        'playable_url',
        'screenshot',
        'description',
        'jam',
        'review_status',
        'augie_spotchecked',
        'itch_thumb'
      ]),
      // best-effort: a missing/renamed Jams table just costs the pretty heading
      listAll(cfg.shop.jamsTable, ['name', 'start_date', 'itch_url']).catch(() => [])
    ]);

    for (const j of jams) {
      const key = monthKey(j.fields.start_date);
      if (!key) continue;
      if (j.fields.name) jamNames[key] = String(j.fields.name).toLowerCase();
      const itch = withScheme(j.fields.itch_url);
      if (itch) jamLinks[key] = itch;
    }

    const byUrl = new Map();
    for (const r of subs) {
      // both gates: a reviewer's yes, and Augie's spotcheck on top of it
      if (!GALLERY_STATUSES.includes(r.fields.review_status)) continue;
      if (!r.fields.augie_spotchecked) continue;

      const url = withScheme(r.fields.playable_url);
      const key = (url && normUrl(url)) ?? `rec:${r.id}`;
      // title: what they typed on the form; failing that the first line of the
      // description, failing that the itch slug
      const title =
        r.fields.game_title ||
        (r.fields.description || '').split('\n')[0].trim().slice(0, 80) ||
        key.split('/').at(-1)?.replaceAll('-', ' ') ||
        'mystery game';
      const entry = byUrl.get(key) ?? {
        key,
        url,
        title,
        jam: r.fields.jam ?? '',
        people: [],
        rows: [], // every row of this game, for the cover write-back
        thumb: null, // the stored itch cover, from whichever row has it
        shotRec: null // a row with a screenshot attachment, for the proxy fallback
      };
      entry.rows.push(r.id);
      if (!entry.thumb && r.fields.itch_thumb) entry.thumb = r.fields.itch_thumb;
      if (!entry.shotRec && r.fields.screenshot?.length) entry.shotRec = r.id;
      // teammates submit separately; if they somehow disagree on the jam, the
      // earliest one wins so a game can't jump forward into the new section
      if (r.fields.jam && (!entry.jam || r.fields.jam < entry.jam)) entry.jam = r.fields.jam;
      // one person per row; the slack display name resolves later, first name
      // is the fallback
      const first = (r.fields.first_name || '').trim();
      const slackId = r.fields.slack_id || null;
      const pid = (slackId || first).toLowerCase();
      if (pid && !entry.people.some((p) => p.pid === pid)) entry.people.push({ pid, slackId, first });
      byUrl.set(key, entry);
    }

    games = [...byUrl.values()];

    // covers: stored field first (already on g.thumb), then memory, then scrape
    const found = [];
    let budget = SCRAPE_BUDGET;
    const pending = games.filter((g) => !g.thumb && g.url && isItch(g.url));
    await mapLimit(pending, SCRAPE_LIMIT, async (g) => {
      const hit = thumbCache.get(g.key);
      if (hit && Date.now() - hit.at < THUMB_TTL_MS) {
        g.thumb = hit.src;
        found.push({ rows: g.rows, src: hit.src }); // retry the write that must have failed
        return;
      }
      if (budget <= 0) return;
      budget--;
      const got = await itchThumb(g.url, g.key);
      if (got?.throttled) {
        if (budget > 0) console.warn(`[gallery] itch 429, stopping scrapes this round (${pending.length} pending)`);
        budget = 0;
        return;
      }
      if (got?.src) {
        g.thumb = got.src;
        found.push({ rows: g.rows, src: got.src });
      }
    });
    if (found.length) await persistThumbs(found);

    await mapLimit(games, 8, async (g) => {
      if (!g.thumb) g.thumb = g.shotRec ? `/gallery/thumb/${g.shotRec}` : null;
      delete g.rows;
      delete g.shotRec;
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
    stale = { games, jamNames, jamLinks };
  } catch (err) {
    console.error('[gallery] load failed:', err);
    // null on a cold instance -> the page shows its error state
    ({ games, jamNames, jamLinks } = stale ?? { games: null, jamNames: {}, jamLinks: {} });
  }

  // one section per jam, newest first. The jam keys are month strings, so they
  // sort as dates for free, and a new jam appears on its own as soon as its
  // games are spotchecked - the current jam has nothing approved yet and simply
  // isn't here. Anything with no jam on the row falls to the bottom.
  let sections = null;
  if (games) {
    const byJam = new Map();
    for (const g of games) {
      if (!byJam.has(g.jam)) byJam.set(g.jam, []);
      byJam.get(g.jam).push(g);
    }
    sections = [...byJam.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([jam, list]) => ({
        key: jam || 'unsorted',
        title: jamNames[jam] ?? (jam || 'the rest'),
        href: jamLinks[jam] ?? null, // the jam's itch page, when the Jams row has one
        games: list
      }));
  }

  return { games, sections };
}
