// current month's jam. single source of truth for the countdown
// (ThisMonth.svelte) and the Event JSON-LD (+page.svelte).
// UPDATE THIS each month when the jam rolls over (name, dates, itchUrl, airtableRecordId).
// the full rollover list, including the hackclub.com/programs end date, is the
// "New jam checklist" in CLAUDE.md.
// note: most months jame gam enters someone else's jam as a community, so the
// schema built from this describes our participation, not the jam itself.
export const JAM = {
  name: 'The Jame Gam Game Jam',
  // lowercase caption printed under the jam title box, in the site's voice.
  displayName: 'the jame gam game jam',
  // this jam's brand accent, used for the highlighted bit of the duration line.
  color: '#db9591',
  startDate: '2026-10-22T21:00:00Z',
  endDate: '2026-10-25T21:00:00Z',
  itchUrl: 'https://itch.io/jam/jame-gam-game-jam',
  // this month's submission form (Fillout). a new form each cycle; its hidden
  // `jam` label must match what shop.js flips to once review starts.
  submitUrl: 'https://forms.hackclub.com/jame-gam-game-jam',
  // record id of this jam's row in the "Jams" Airtable table; new signups get
  // linked to it via the Sign Ups `jam` field. create the new jam's row each
  // month and paste its rec... id here.
  airtableRecordId: 'rec94JK7jOMHrxocd',
  // true when jame gam runs this month's jam itself rather than crashing someone
  // else's; flips the jam section's headline to "we're running our own!".
  hosted: true,
  // the title box (ThisMonth.svelte): the jam's art, contain-fit inside the
  // hand-drawn border, over a fill pre-cut to the border's inner area at the
  // box's 545:225 aspect. titleArt can be '' when the art is baked into the
  // fill itself (this month: augie's title art scaled to the box width and cut
  // with the border mask, so it runs right up to the stroke).
  titleArt: '',
  titleFill: '/assets/jggj_title_fill.png',
  // a suffix of displayName to colour one rainbow letter at a time in the
  // caption under the box ('' for none).
  captionRainbow: 'game jam',
  // small gray line under the countdown, e.g. '(not affiliated with virtual
  // turtle games)' when we crash someone else's jam. empty hides it.
  disclaimer: ''
};

// true in the gap after a jam ends and before JAM above is updated for the next
// one (updating JAM pushes endDate back into the future, flipping this off).
// same condition that drives the "it's over!" state in ThisMonth.svelte.
export function isBetweenJams(now = Date.now()) {
  return now > Date.parse(JAM.endDate);
}
