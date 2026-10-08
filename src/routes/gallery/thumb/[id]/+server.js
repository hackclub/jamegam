// /gallery/thumb/<rec> - a submission's screenshot, served from here rather
// than linked straight to Airtable. Attachment urls expire after a couple of
// hours, and /gallery is ISR-cached and served stale first, so a direct link
// goes dead for the first visitor after a quiet stretch (HTTP 410 on every
// screenshot at once). This route resolves a fresh url per request and streams
// the bytes, and the CDN caches the result for a day.
import { error } from '@sveltejs/kit';
import { config as cfg } from '$lib/server/config.js';
import { GALLERY_STATUSES } from '$lib/shop.js';

const API = 'https://api.airtable.com/v0';

export async function GET({ params, setHeaders }) {
  // Airtable record ids: "rec" + 14 alphanumerics
  if (!/^rec[A-Za-z0-9]{14}$/.test(params.id)) error(404);

  const res = await fetch(
    `${API}/${cfg.airtable.baseId}/${encodeURIComponent(cfg.shop.submissionsTable)}/${params.id}`,
    { headers: { Authorization: `Bearer ${cfg.airtable.token}` }, signal: AbortSignal.timeout(8000) }
  );
  // airtable answers 403 (not 404) for an id that doesn't exist
  if (res.status === 404 || res.status === 403) error(404);
  if (!res.ok) error(502, 'airtable unavailable');
  const { fields } = await res.json();

  // same gates as the wall: only games that are actually on it
  if (!GALLERY_STATUSES.includes(fields.review_status) || !fields.augie_spotchecked) error(404);
  const shot = fields.screenshot?.[0];
  const src = shot?.thumbnails?.large?.url ?? shot?.url;
  if (!src) error(404);

  const img = await fetch(src, { signal: AbortSignal.timeout(8000) });
  if (!img.ok) error(502, 'screenshot unavailable');

  setHeaders({
    'content-type': img.headers.get('content-type') ?? 'image/png',
    // browsers keep it an hour, the CDN a day, and serve stale for a week
    // while refetching - screenshots are set at submit time and never change
    'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  });
  return new Response(img.body);
}
