#!/usr/bin/env node
// Snapshot an itch.io jam's published results into src/lib/data/jam-results/<month>.json
// so /gallery can order a jam's wall by placing without touching itch at request time.
//
//   node scripts/itch-jam-results.mjs cozy-fall-jam-2026 2026-09
//
// itch has no jam API. The results pages (/jam/<slug>/results?page=N, 20 a page) carry the
// overall rank, score and rating count per game; entries.json (by numeric jam id, found on the
// jam page) adds platforms and cover art. Results only exist once voting has closed, so run
// this once per jam after that. Keyed by the gallery's normalized playable url.

import fs from 'node:fs';
import path from 'node:path';

const [slug, month] = process.argv.slice(2);
if (!slug || !/^\d{4}-\d{2}$/.test(month ?? '')) {
  console.error('usage: node scripts/itch-jam-results.mjs <itch jam slug> <YYYY-MM>');
  process.exit(1);
}

const UA = 'jamegam-gallery (augie@hackclub.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// optional: past the last results page itch answers 404, which just means "done"
async function getText(url, { optional = false } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.status === 429 && attempt < 4) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      if (optional) return null;
      throw new Error(`${url} -> ${res.status}`);
    }
    return res.text();
  }
}

// same key as the gallery loader: host + path, no www/query/trailing slash, lowercased
function normUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const entries = {};

// results pages: one <div class="game_rank ..."> per game
for (let page = 1; ; page++) {
  const html = await getText(`https://itch.io/jam/${slug}/results?page=${page}`, { optional: true });
  // the split also yields one empty fragment per page (a template, not a game)
  const blocks = (html ?? '').split(/<div class="game_rank[^"]*">/).slice(1).filter((b) => b.trim());
  if (!blocks.length) break;
  for (const b of blocks) {
    // the cover link only renders for the top entries; the title link is on every block
    const [, url, title] = b.match(/<h2><a href="([^"]+)">([^<]*)<\/a>/) ?? [];
    const meta = b.match(/Ranked <strong class="ordinal_rank">(\d+)\w*<\/strong> with (\d+) ratings? \(Score: ([\d.]+)\)/);
    const key = url && normUrl(url);
    if (!key || !meta) {
      console.warn('skipping a results block the parser did not understand');
      continue;
    }
    entries[key] = {
      url,
      title: decode(title ?? ''),
      rank: Number(meta[1]),
      ratings: Number(meta[2]),
      score: Number(meta[3]),
      entryUrl: b.match(/href="(\/jam\/[^"]+\/rate\/\d+)"/)?.[1] ?? null
    };
  }
  process.stderr.write(`results page ${page}: ${blocks.length} games\n`);
  await sleep(800);
}

// entries.json: platforms (a game with none has no upload at all) + cover
const jamHtml = await getText(`https://itch.io/jam/${slug}`);
const jamId = jamHtml.match(/I\.ViewJam\([^)]*?"id":(\d+)/)?.[1];
let unranked = 0;
if (jamId) {
  const { jam_games = [] } = JSON.parse(await getText(`https://itch.io/jam/${jamId}/entries.json`));
  for (const e of jam_games) {
    const key = normUrl(e.game?.url);
    if (!key) continue;
    const base = entries[key] ?? (unranked++, (entries[key] = { url: e.game.url, title: e.game.title, rank: null, ratings: e.rating_count ?? 0, score: null, entryUrl: e.url ?? null }));
    base.platforms = e.game.platforms ?? [];
    base.cover = e.game.cover || null; // "" when the game has no cover art
  }
} else {
  console.warn('could not find the numeric jam id on the jam page; skipping entries.json');
}

const out = path.join('src/lib/data/jam-results', `${month}.json`);
fs.writeFileSync(
  out,
  JSON.stringify({ jam: slug, jamId: jamId ? Number(jamId) : null, fetchedAt: new Date().toISOString(), entries }, null, 2) + '\n'
);
console.log(`${Object.keys(entries).length} entries (${unranked} unranked) -> ${out}`);
