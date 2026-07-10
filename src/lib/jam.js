// current month's jam. single source of truth for the countdown
// (ThisMonth.svelte) and the Event JSON-LD (+page.svelte).
// UPDATE THIS each month when the jam rolls over (name, dates, itchUrl, airtableRecordId).
// note: jame gam does not run these jams, it enters them as a community, so the
// schema built from this describes our participation, not the jam itself.
export const JAM = {
  name: 'GMTK Game Jam 2026',
  startDate: '2026-07-22T17:00:00Z',
  endDate: '2026-07-26T17:00:00Z',
  itchUrl: 'https://itch.io/jam/gmtk-jam-2026',
  // record id of this jam's row in the "Jams" Airtable table; new signups get
  // linked to it via the Sign Ups `jam` field. create the new jam's row each
  // month and paste its rec... id here.
  airtableRecordId: 'recvXkfAJABcCqSVt'
};

// true in the gap after a jam ends and before JAM above is updated for the next
// one (updating JAM pushes endDate back into the future, flipping this off).
// same condition that drives the "it's over!" state in ThisMonth.svelte.
export function isBetweenJams(now = Date.now()) {
  return now > Date.parse(JAM.endDate);
}
