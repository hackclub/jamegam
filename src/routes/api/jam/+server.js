// GET /api/jam - the live jam config as JSON, for the jame gam help bot
// (nephthys). It answers "when's the next jam" and "is the form open" from
// this instead of a copy of jam.js, so the bot can't drift from the site.
// Public: everything here is already on the landing page.
import { json } from '@sveltejs/kit';
import { JAM, JAM_MONTH, isBetweenJams } from '$lib/jam.js';
import { SHOP } from '$lib/shop.js';

export const prerender = false;

export function GET() {
  return json(
    {
      jam: {
        name: JAM.name,
        displayName: JAM.displayName,
        month: JAM_MONTH,
        startDate: JAM.startDate,
        endDate: JAM.endDate,
        itchUrl: JAM.itchUrl,
        submitUrl: JAM.submitUrl,
        submitWindowDays: JAM.submitWindowDays ?? null,
        hosted: JAM.hosted
      },
      betweenJams: isBetweenJams(),
      // display names for past jam months ('2026-10': 'the jame gam game jam')
      shop: { cycles: SHOP.cycles }
    },
    { headers: { 'cache-control': 'public, max-age=300' } }
  );
}
