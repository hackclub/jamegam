// current month's jam. single source of truth for the countdown
// (ThisMonth.svelte) and the Event JSON-LD (+page.svelte).
// UPDATE THIS each month when the jam rolls over (name, dates, itchUrl, airtableRecordId).
// note: jame gam does not run these jams, it enters them as a community, so the
// schema built from this describes our participation, not the jam itself.
export const JAM = {
  name: 'Cozy Fall Jam 2026',
  // lowercase caption printed under the jam title box, in the site's voice.
  displayName: 'the cozy fall jam',
  // this jam's brand accent, used for the highlighted bit of the duration line.
  color: '#c4501b',
  startDate: '2026-09-24T20:00:00Z',
  endDate: '2026-09-27T20:00:00Z',
  itchUrl: 'https://itch.io/jam/cozy-fall-jam-2026',
  // this month's submission form (Fillout). a new form each cycle; its hidden
  // `jam` label must match what shop.js flips to once review starts.
  submitUrl: 'https://forms.hackclub.com/jame-gam-submit-4',
  // record id of this jam's row in the "Jams" Airtable table; new signups get
  // linked to it via the Sign Ups `jam` field. create the new jam's row each
  // month and paste its rec... id here.
  airtableRecordId: 'recfojI1l4heUpGXt'
};

// true in the gap after a jam ends and before JAM above is updated for the next
// one (updating JAM pushes endDate back into the future, flipping this off).
// same condition that drives the "it's over!" state in ThisMonth.svelte.
export function isBetweenJams(now = Date.now()) {
  return now > Date.parse(JAM.endDate);
}
