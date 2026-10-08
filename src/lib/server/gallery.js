// What puts a submission row on the /gallery wall. Shared by the page loader
// and the /gallery/thumb/<rec> screenshot proxy, which must agree: the proxy
// serves a screenshot only for a row the wall would show.
import { GALLERY_STATUSES } from '$lib/shop.js';
import cozyFall from '$lib/data/jam-results/2026-09.json';

// TEMPORARY (2026-10-08): the cozy fall jam goes up before its review and
// spotcheck finish. For a jam listed here every row that is not Rejected is on
// the wall, minus `hide` (normalized playable urls, see normUrl), and the
// section is ordered by the jam's itch results (scripts/itch-jam-results.mjs
// snapshots them into src/lib/data/jam-results/) instead of shuffled; games
// with no placing sink to the bottom. Delete the entry (and the json) once the
// jam's rows are spotchecked and the normal gates take over on their own.
export const PREVIEW = {
  '2026-09': {
    results: cozyFall.entries,
    hide: new Set([])
  }
};

// shippers type the url by hand, so a scheme-less "foo.itch.io/bar" shows up
// now and then - left alone it links relative to jamegam.hackclub.com (and
// breaks the dedupe key and the thumbnail fetch too)
export function withScheme(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
}

// dedupe key: host + path, no www/query/trailing slash, lowercased - the same
// game submitted by two teammates (or with ?query cruft) collapses to one card
export function normUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

// both normal gates are a reviewer's yes and Augie's spotcheck on top of it;
// a preview jam only drops Rejected rows and the hide list
export function onWall(fields) {
  const preview = PREVIEW[fields.jam];
  if (!preview) return GALLERY_STATUSES.includes(fields.review_status) && Boolean(fields.augie_spotchecked);
  if (fields.review_status === 'Rejected') return false;
  const url = withScheme(fields.playable_url);
  return !(url && preview.hide.has(normUrl(url)));
}
