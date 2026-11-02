// Where a signup came from, for the Sign Ups row's signup_origin (plain text).
// It always starts with the host (or itch.io for the box framed into an itch
// page), then carries the page and the campaign ref when the box knows them:
//   jamegam.hackclub.com                       homepage boxes (unchanged)
//   itch.io?ref=retrocrow                      the box on the retrocrow itch page
//   jamegam.hackclub.com/prizes                the /prizes box, found on its own
//   jamegam.hackclub.com/prizes?ref=retrocrow  /prizes, reached from that itch page
//   jamegam.hackclub.com/jam?ref=announcements a tagged /jam join link (an
//                                              untagged /jam stays the plain host)
// Shared by the client (which reads ?ref= off the url) and /api/signup + the
// auth callback (which re-validate it), so no free text ever lands in Airtable.

// ?ref= values: short lowercase slugs only
export const REF_RE = /^[a-z0-9-]{1,32}$/;
/** @param {unknown} v */
export const cleanRef = (v) => (REF_RE.test(String(v ?? '')) ? String(v) : '');

// the pages a box can say it sits on
export const SIGNUP_PAGES = ['prizes', 'jam'];
/** @param {unknown} v */
export const cleanPage = (v) => (typeof v === 'string' && SIGNUP_PAGES.includes(v) ? v : '');

// refs that mean "came from an itch jam page's prize links": these, and only
// these, open the teen signup popup on /prizes
export const ITCH_PRIZE_REFS = ['retrocrow'];

/**
 * @param {string} base
 * @param {{ page?: unknown, ref?: unknown }} [tags]
 */
export function originTag(base, { page, ref } = {}) {
  const p = cleanPage(page);
  const r = cleanRef(ref);
  return `${base}${p ? `/${p}` : ''}${r ? `?ref=${r}` : ''}`;
}

