// The IDV prize gate, shared bits. A jammer who isn't verified with Hack Club
// Auth still picks their prize as normal, but the order is placed HELD: its
// fulfillment `status` is HELD_STATUS, which every fulfillment filter already
// skips (they all select `not fulfilled`). The daily /api/cron/idv job and the
// /prizes instant release move it to `not fulfilled` once HCA says verified.
// No imports, so the page, the server and the plain-bun tests can all use it.

/** The Shop Orders `status` option a held order sits in. */
export const HELD_STATUS = 'held for verification';

/** The Shop Orders `idv_status` options. Blank on the row = placed before the gate. */
export const IDV = {
  held: 'held',
  verified: 'verified',
  canceled: 'canceled',
  grandfathered: 'grandfathered'
};

/** HCA statuses as this app stores them (session `verificationStatus`, `idv_last_status`). */
export const HCA_STATUSES = ['verified', 'needs_submission', 'pending', 'ineligible'];

/**
 * HCA's public external/check result onto the stored union. Both `verified_*`
 * results are verified (age stays with the reviewers), `rejected` is
 * ineligible. `not_found`, `error` and anything unknown are null: never stored,
 * never acted on.
 */
export function mapCheckResult(result) {
  switch (result) {
    case 'verified_eligible':
    case 'verified_but_over_18':
      return 'verified';
    case 'rejected':
      return 'ineligible';
    case 'needs_submission':
    case 'pending':
      return result;
    default:
      return null;
  }
}

/**
 * /api/v1/me's `verification_status` onto the stored union, or '' when HCA
 * gave nothing usable. Tolerates external/check-style values too.
 */
export function normalizeSessionStatus(status) {
  if (HCA_STATUSES.includes(status)) return status;
  return mapCheckResult(status) ?? '';
}

/** Is this Shop Orders row a held order the gate still owns? */
export function isHeld(fields) {
  return fields?.status === HELD_STATUS && fields?.idv_status === IDV.held;
}

/** `{prize}` in the DMs: the prize name, or "your indie games". */
export function prizeLabel(fields) {
  if (fields?.prize_type === 'indie games' || !fields?.prize) return 'your indie games';
  return fields.prize;
}

/**
 * The gate for a NEW order (changing an existing order is never re-gated).
 * `dmSentAt` is the earliest prize DM across their approved rows, `status` the
 * session's verificationStatus, `gateFrom` IDV_GATE_FROM (shop.js). Returns
 *   'grandfathered': their pick window opened before the gate existed
 *   'verified':      passes, placed as `not fulfilled`
 *   'held':          placed as HELD_STATUS (needs_submission, pending, or HCA
 *                     gave no status at all)
 *   'ineligible':    no order, the ineligible screen
 */
export function orderGate(dmSentAt, status, gateFrom) {
  if (Date.parse(dmSentAt) < Date.parse(gateFrom)) return IDV.grandfathered;
  if (status === 'verified') return IDV.verified;
  if (status === 'ineligible') return 'ineligible';
  return IDV.held;
}
