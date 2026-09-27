// The prize shop's open cycles. Like jam.js, UPDATE THIS each month once review
// starts: add the new month's label (the one the submission form writes to
// `submission_form.jam`) and its display name. Keep old cycles listed while
// anyone from them can still turn up: a game parked as Pending or Needs Augie
// gets reviewed weeks late, and its DM must land on a shop that still knows
// that month. Retire a cycle by deleting it once nothing from it is outstanding.
// Oldest first, newest last; `resolveCycle` below picks one per person, so the
// overlap is invisible to submitters. There is no shop-wide close date - see
// PICK_WINDOW_DAYS below.
export const SHOP = {
  cycles: {
    '2026-08': 'the brackeys 2026.2 game jam',
    '2026-09': 'the cozy fall jam'
  }
};

/** The open cycle labels, oldest first. */
export const SHOP_JAMS = Object.keys(SHOP.cycles);

/** The newest open cycle - what signed-out copy talks about. */
export const SHOP_CURRENT = SHOP_JAMS[SHOP_JAMS.length - 1];

/**
 * Which cycle the shop shows this person. `submissions` and `orders` are their
 * rows across every open cycle. Orders are never changed after they are placed
 * (a cycle stays listed only for fulfillment and late reviews), so the rule is
 * short:
 *   1. the newest cycle where they have an approved row and no order yet - a
 *      late-reviewed straggler picks for that month, whatever else is open;
 *   2. otherwise the newest cycle they have any row in - an order to look at,
 *      or a submission still in review.
 * With no rows at all this is the newest open cycle ("no submission" state).
 */
export function resolveCycle(submissions, orders) {
  const hasOrder = new Set(orders.map((o) => o.fields.jam));
  const jams = [...SHOP_JAMS].reverse();
  const pickable = jams.find(
    (j) =>
      !hasOrder.has(j) &&
      submissions.some((r) => r.fields.jam === j && SHOP_STATUSES.includes(r.fields.review_status))
  );
  if (pickable) return pickable;
  return jams.find((j) => submissions.some((r) => r.fields.jam === j)) ?? SHOP_CURRENT;
}

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL'];

// ---- per-item options (size, colour, whatever the next one is) ----
// Some prizes need a choice before they can be ordered: apparel needs a size,
// the 8bitdo comes in five colours, the hoodie needs both. Each item in
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

// ---- per-item country restrictions ----
// Some prizes are too pricey to source or ship in certain countries. An item in
// prizes.js can declare `blockCountries: ['india']`; the shop then hides its
// order action and the /api/shop/order endpoint rejects it when the shipping
// country matches. The match is loose because the address `country` field is
// free text (from HCA or the submission form), so it arrives as "India", "IN",
// "in", and so on.
const COUNTRY_ALIASES = {
  india: ['india', 'in', 'ind', 'bharat'],
  pakistan: ['pakistan', 'pk', 'pak']
};

/** Does this free-text country string name one of `names` (e.g. ['india'])? */
export function countryMatches(country, names) {
  const c = String(country || '').trim().toLowerCase();
  if (!c) return false;
  return names.some((name) => (COUNTRY_ALIASES[name] ?? [name]).includes(c));
}

/** Is `item` blocked from shipping to `country`? */
export function itemBlockedIn(item, country) {
  return !!item?.blockCountries?.length && countryMatches(country, item.blockCountries);
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

// review_status values that put a game on the /gallery wall. The gallery is
// about the games, not the money or the unified DB, so it is the union of the
// two lists above minus the rejections: everything a reviewer said yes to.
// "Prize Only" games never stage, which is why the gallery cannot read the
// staged table and get this right. The spotcheck is required on top of this -
// see the gallery loader.
export const GALLERY_STATUSES = ['Approved', 'Prize Only', 'No Prize'];

// ---- per-person deadlines ----
// The DM is the only clock. Everyone gets PICK_WINDOW_DAYS from the moment their
// "you can pick a prize" DM goes out (`approved_dm_sent_at` on their submission
// row), expiring at 11:59pm ET that day. There is deliberately no shop-wide
// backstop: it used to exist as a fulfillment batch end, but it expired for the
// 72 July submitters who hadn't been DMed yet and told them they'd missed a
// deadline that had never started. Nobody is ever locked out by a date they were
// not told about - un-DMed means no clock, and the shop stays open for them.
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

/**
 * When this person's shop closes, in ms. `dmSentAt` is an ISO string or null;
 * with no DM there is no clock, so this is Infinity (never closes).
 */
export function closesAtFor(dmSentAt) {
  const sent = dmSentAt ? Date.parse(dmSentAt) : NaN;
  if (!Number.isFinite(sent)) return Infinity;
  return endOfEtDay(sent + PICK_WINDOW_DAYS * 86400000);
}

/** The same deadline as display copy ("sunday, august 9 at 11:59pm ET"), or null if no clock. */
export function closesTextFor(dmSentAt) {
  const at = closesAtFor(dmSentAt);
  if (!Number.isFinite(at)) return null;
  const when = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date(at));
  return `${when.toLowerCase()} at 11:59pm ET`;
}

/** "india", "india or pakistan", "india, pakistan or nepal" */
export function listOr(names) {
  const a = [...(names ?? [])];
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} or ${a.at(-1)}`;
}
