// current month's jam. single source of truth for the countdown
// (ThisMonth.svelte) and the Event JSON-LD (+page.svelte).
// UPDATE THIS each month when the jam rolls over (name, dates, itchUrl, airtableRecordId).
// note: jame gam does not run these jams, it enters them as a community, so the
// schema built from this describes our participation, not the jam itself.
export const JAM = {
  name: 'Brackeys Game Jam 2026.2',
  // lowercase caption printed under the jam title box, in the site's voice.
  displayName: 'the brackeys 2026.2 game jam',
  // this jam's brand accent, used for the highlighted bit of the duration line.
  color: '#ed8e9d',
  startDate: '2026-08-23T10:00:00Z',
  endDate: '2026-08-30T10:00:00Z',
  itchUrl: 'https://itch.io/jam/brackeys-16',
  // this month's submission form (Fillout). a new form each cycle; its hidden
  // `jam` label must match what shop.js flips to once review starts.
  submitUrl: 'https://forms.hackclub.com/jame-gam-submit-3',
  // record id of this jam's row in the "Jams" Airtable table; new signups get
  // linked to it via the Sign Ups `jam` field. create the new jam's row each
  // month and paste its rec... id here.
  airtableRecordId: 'recquiBGbnUbEVYOx'
};

// true in the gap after a jam ends and before JAM above is updated for the next
// one (updating JAM pushes endDate back into the future, flipping this off).
// same condition that drives the "it's over!" state in ThisMonth.svelte.
export function isBetweenJams(now = Date.now()) {
  return now > Date.parse(JAM.endDate);
}
