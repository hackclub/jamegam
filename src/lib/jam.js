// the current (or next) jam. jame gam skips a month now and then, so this can
// point a month or two ahead; ThisMonth.svelte says "next month" etc. on its own.
// single source of truth for the countdown
// (ThisMonth.svelte) and the Event JSON-LD (+page.svelte).
// UPDATE THIS each month when the jam rolls over (name, dates, itchUrl, airtableRecordId).
// the full rollover list, including the hackclub.com/programs end date, is the
// "New jam checklist" in CLAUDE.md.
// note: most months jame gam enters someone else's jam as a community, so the
// schema built from this describes our participation, not the jam itself.
export const JAM = {
  name: "The MFG Gambler's Jam",
  // lowercase caption printed under the jam title box, in the site's voice.
  displayName: "the mfg gambler's jam",
  // this jam's brand accent, used for the highlighted bit of the duration line.
  color: '#615dc0',
  // dec 5 6pm EST to dec 13 noon EST. voting on itch runs to dec 20 noon EST.
  startDate: '2026-12-05T23:00:00Z',
  endDate: '2026-12-13T17:00:00Z',
  itchUrl: 'https://itch.io/jam/the-mfg-gamblers-jam',
  // this month's submission form (Fillout). a new form each cycle; its hidden
  // `jam` label must match what shop.js flips to once review starts.
  // '' until the form exists: the "submit it here" line on the landing page
  // and /prizes hides itself.
  submitUrl: '',
  // days after endDate the submission form stays open. the help bot (nephthys)
  // reads it from /api/jam: with a submitUrl set, the form counts as open until
  // endDate + this many days. update it if a jam's window is different.
  submitWindowDays: 4,
  // record id of this jam's row in the "Jams" Airtable table; new signups get
  // linked to it via the Sign Ups `jam` field. create the new jam's row each
  // month and paste its rec... id here. '' until then: signups still go
  // through, just without the link.
  airtableRecordId: '',
  // true when jame gam runs this month's jam itself rather than crashing someone
  // else's; the jam section's headline then says "we're hosting" instead of
  // "we're crashing".
  hosted: true,
  // the title box (ThisMonth.svelte): the jam's art, contain-fit inside the
  // hand-drawn border, over a fill pre-cut to the border's inner area at the
  // box's aspect. titleAspect is that aspect ('' = the default 545:225 the
  // cozy fall and jame gam game jam fills were cut at; months with a video
  // use '2 / 1', like gmtk's). titleArt can be '' when the art is baked into
  // the fill. this month: retrocrow's logo over a faint copy of the itch
  // page's X pattern, both built by claude-workspace/make-gamblers-fill.sh in
  // the next-jam worktree.
  titleAspect: '2 / 1',
  titleArt: '/assets/gamblers_title_logo.png',
  titleFill: '/assets/gamblers_title_fill.png',
  // true draws titleArt above the border, centred in the box at 82% of its
  // width (its own layer, so it can lie over the stroke).
  titleArtOnTop: true,
  // a suffix of displayName to colour one rainbow letter at a time in the
  // caption under the box ('' for none).
  captionRainbow: '',
  // small gray line under the countdown, e.g. '(not affiliated with virtual
  // turtle games)' when we crash someone else's jam. empty hides it.
  disclaimer: '(hosted with retrocrow!)',
  // the jam's video, shown beside the title box (stacked under it on narrow
  // screens) with the "watch the video" doodle. photo is the youtube thumbnail
  // at 551x310. null hides the player and the box sits alone with its new-tab
  // icon.
  video: {
    url: 'https://www.youtube.com/watch?v=iG9doYjEZD0',
    photo: '/assets/video_photo_gamblers.png',
    alt: "bet you can't make a game in a week"
  }
};

// the jam's month label ('2026-12'), the same shape as the shop's cycle labels
// and `submission_form.jam`. UTC, like the dates above.
export const JAM_MONTH = JAM.startDate.slice(0, 7);

// true in the gap after a jam ends and before JAM above is updated for the next
// one (updating JAM pushes endDate back into the future, flipping this off).
// same condition that drives the "it's over!" state in ThisMonth.svelte.
export function isBetweenJams(now = Date.now()) {
  return now > Date.parse(JAM.endDate);
}
