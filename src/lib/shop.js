// The prize shop for the jam that just wrapped. Like jam.js, UPDATE THIS each
// month once review starts: point `jam` at the label the submission form used
// and set a fresh close date. The shop serves LAST month's submitters, so it
// intentionally lags jam.js by one cycle.
export const SHOP = {
  jam: '2026-07', // must match submission_form.jam
  jamName: 'the GMTK game jam', // display name (lags jam.js by a cycle, so it can't read JAM.name)
  closesAt: '2026-08-10T03:59:00Z', // sunday 2026-08-09, 11:59pm ET
  closesText: 'sunday, august 9 at 11:59pm ET'
};

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL'];

// ---- per-item options (size, colour, whatever the next one is) ----
// Some prizes need a choice before they can be ordered: apparel needs a size,
// the 8bitdo comes in three colours, the hoodie needs both. Each item in
// prizes.js declares an `opts` array of groups (see SIZE_OPTION there); the
// picked values are stored on the order row as one human-readable `variant`
// string, in the order the item declares its groups:
//     size: L, color: navy
// Airtable is the fulfillment UI, so this is deliberately a sentence Augie can
// read in a grid rather than JSON. It round-trips back through parseVariant so
// the shop can re-show (and let people change) what they picked.

/** { size: 'L', color: 'navy' } -> "size: L, color: navy", in the item's group order. */
export function variantText(item, picks) {
  return (item?.opts ?? [])
    .filter((g) => picks?.[g.key])
    .map((g) => `${g.key}: ${picks[g.key]}`)
    .join(', ');
}

/** "size: L, color: navy" -> { size: 'L', color: 'navy' }. Junk parts are dropped. */
export function parseVariant(text) {
  const picks = {};
  for (const part of String(text || '').split(',')) {
    const [key, ...rest] = part.split(':');
    const value = rest.join(':').trim();
    if (key.trim() && value) picks[key.trim()] = value;
  }
  return picks;
}

/** Just the values, for display: "L, navy". */
export function variantValues(item, picks) {
  return (item?.opts ?? [])
    .map((g) => picks?.[g.key])
    .filter(Boolean)
    .join(', ');
}

// review_status values that open the prize shop. "Prize Only" is Augie's escape
// hatch for a project he wants to reward but not send to the unified YSWS DB, so
// it never stages. "No Prize" is the mirror image - it stages to the unified DB
// but earns no prize (hours too small to reward) - so it is deliberately absent
// here. The staging side of the pair is STAGE_STATUSES in the sync automation.
export const SHOP_STATUSES = ['Approved', 'Prize Only'];

// review_status values the site presents as a rejection. "No Prize" quietly still
// goes to the unified YSWS DB, but that is an internal distinction: to the
// submitter there is no prize and no more waiting, which is what "Rejected" says.
export const REJECTED_STATUSES = ['Rejected', 'No Prize'];

// ---- per-person deadlines ----
// Everyone gets PICK_WINDOW_DAYS from the moment their "you can pick a prize" DM
// goes out (`approved_dm_sent_at` on their submission row), expiring at 11:59pm
// ET that day. SHOP.closesAt is the hard backstop: nobody runs past it, so
// fulfillment still has one clean batch end. Someone who hasn't been DMed yet
// has no clock running and just sees the global date.
export const PICK_WINDOW_DAYS = 4;

const ET = 'America/New_York';

// How far ET is behind UTC at a given instant, in ms (+4h during EDT).
function etOffsetMs(ms) {
  const d = new Date(ms);
  return (
    Date.parse(d.toLocaleString('sv-SE', { timeZone: 'UTC' })) -
    Date.parse(d.toLocaleString('sv-SE', { timeZone: ET }))
  );
}

// 11:59pm ET on whatever ET calendar day `ms` falls in.
function endOfEtDay(ms) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ms));
  return Date.parse(`${day}T23:59:00Z`) + etOffsetMs(ms);
}

/** When this person's shop closes, in ms. `dmSentAt` is an ISO string or null. */
export function closesAtFor(dmSentAt) {
  const hardClose = Date.parse(SHOP.closesAt);
  const sent = dmSentAt ? Date.parse(dmSentAt) : NaN;
  if (!Number.isFinite(sent)) return hardClose;
  return Math.min(hardClose, endOfEtDay(sent + PICK_WINDOW_DAYS * 86400000));
}

/** The same deadline as display copy: "sunday, august 9 at 11:59pm ET". */
export function closesTextFor(dmSentAt) {
  const at = closesAtFor(dmSentAt);
  if (at === Date.parse(SHOP.closesAt)) return SHOP.closesText;
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date(at));
  return `${when.toLowerCase()} at 11:59pm ET`;
}
