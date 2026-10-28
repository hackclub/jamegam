// The IDV cron's rules and DM copy, as pure functions over (row, live HCA
// status, now) so they can be tested without Airtable, HCA or Slack. The route
// (/api/cron/idv) does the I/O; everything it decides comes from decideIdv.
// No $lib / $env imports on purpose: plain bun can import this file.
import { HELD_STATUS, IDV, prizeLabel } from '../idv.js';

const DAY = 86400000;

// The day counts. A held order that never starts verifying gets the first
// reminder FIRST_REMINDER_DAYS after it was placed, the final one
// FINAL_REMINDER_DAYS before its deadline, and is cancelled at the deadline.
// The deadline is HOLD_DAYS after the order was placed, pushed out to
// RESUBMIT_GRACE_DAYS after a pending review last came back not-approved.
// Time spent pending in HCA review never counts against anyone.
export const FIRST_REMINDER_DAYS = 7;
export const HOLD_DAYS = 30;
export const RESUBMIT_GRACE_DAYS = 7;
export const FINAL_REMINDER_DAYS = 7;

const VERIFY_LINK = '<https://auth.hackclub.com/verifications/new|auth.hackclub.com/verifications/new>';

const ms = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : null;
};
const iso = (t) => new Date(t).toISOString();

/** deadline = max(created + HOLD_DAYS, pending_ended + RESUBMIT_GRACE_DAYS), in ms. */
export function deadlineFor(createdMs, pendingEndedMs) {
  const base = createdMs + HOLD_DAYS * DAY;
  return pendingEndedMs == null ? base : Math.max(base, pendingEndedMs + RESUBMIT_GRACE_DAYS * DAY);
}

/** "sunday, november 29" (ET), for the final reminder's {deadline}. */
export function deadlineText(t) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
    .format(new Date(t))
    .toLowerCase();
}

/**
 * What the cron does with one held order. `fields` is the Shop Orders row,
 * `createdTime` the record's createdTime (the 30-day clock), `live` the HCA
 * status already mapped by mapCheckResult (null = not_found / error), `now` ms.
 *
 * Returns { actions, patch, dm }:
 *   actions: the cron response's action names, in order ('skip', 'release',
 *             'remind1', 'remind2', 'cancel', 'pending-ended'); empty when the
 *             row only gets its idv_last_status / idv_checked_at refreshed
 *   patch:   the Shop Orders fields to write, or null for a skip (nothing is
 *             written for a status that can't be trusted)
 *   dm:      { kind: 'released' | 'remind1' | 'remind2' | 'cancel', ...copy
 *             inputs } or null
 */
export function decideIdv(fields, createdTime, live, now) {
  if (!live) return { actions: ['skip'], patch: null, dm: null };

  const actions = [];
  const patch = { idv_last_status: live, idv_checked_at: iso(now) };
  let dm = null;

  if (live === 'verified') {
    actions.push('release');
    Object.assign(patch, releasePatch(now));
    dm = { kind: 'released' };
  } else if (live === 'ineligible') {
    actions.push('cancel');
    Object.assign(patch, cancelPatch());
    dm = { kind: 'cancel', ineligible: true };
  } else if (live === 'needs_submission') {
    const created = ms(createdTime) ?? now;
    let pendingEnded = ms(fields.idv_pending_ended_at);
    // a pending review that came back needing changes (retryable): stamp it,
    // which moves the deadline out and re-arms the final reminder, then carry
    // on to the needs_submission rules with the new stamp
    if (fields.idv_last_status === 'pending') {
      pendingEnded = now;
      patch.idv_pending_ended_at = iso(now);
      actions.push('pending-ended');
    }
    const deadline = deadlineFor(created, pendingEnded);
    const finalAt = ms(fields.idv_final_reminder_at);
    if (now >= deadline) {
      actions.push('cancel');
      Object.assign(patch, cancelPatch());
      dm = { kind: 'cancel', ineligible: false };
    } else if (
      now >= deadline - FINAL_REMINDER_DAYS * DAY &&
      (finalAt == null || (pendingEnded != null && finalAt < pendingEnded))
    ) {
      actions.push('remind2');
      patch.idv_final_reminder_at = iso(now);
      // the "needs changes" first line whenever a review has come back
      // not-approved: "haven't started verification" would be wrong for them
      dm = { kind: 'remind2', deadline, rejected: pendingEnded != null };
    } else if (now >= created + FIRST_REMINDER_DAYS * DAY && !fields.idv_first_reminder_at && finalAt == null) {
      // (never after the final reminder: someone pending through day 30 and
      // rejected later gets the final one, and a "day 7" nudge the day after
      // it would be a third message saying less)
      actions.push('remind1');
      patch.idv_first_reminder_at = iso(now);
      dm = { kind: 'remind1' };
    }
  }
  // 'pending': in HCA review, so nothing at all: no reminder, no cancel.

  return { actions, patch, dm };
}

/** The fields a release writes (the cron and the /prizes instant release). */
export function releasePatch(now) {
  return { status: 'not fulfilled', idv_status: IDV.verified, idv_released_at: iso(now) };
}

function cancelPatch() {
  return { status: 'canceled', idv_status: IDV.cancelled };
}

/** The Slack text for a decideIdv dm, for this order row. Copy is Augie's, verbatim. */
export function dmText(dm, fields) {
  const prize = prizeLabel(fields);
  switch (dm.kind) {
    case 'released':
      return (
        `hey! i noticed you're verified with hack club now, so your jame gam prize (${prize}) has been marked for fulfillment :)\n` +
        `you'll get a dm once it's sent (please allow us a few weeks!). there's nothing else you need to do at this time!`
      );
    case 'remind1':
      return (
        `hey! your jame gam prize (${prize}) is still waiting on your identity verification. it only takes a few minutes: ${VERIFY_LINK}\n` +
        `once you're verified it will be sent out automatically. i'll dm you again once you're verified!`
      );
    case 'remind2': {
      const deadline = deadlineText(dm.deadline);
      const first = dm.rejected
        ? `your hack club identity verification was marked 'needs changes,' so your jame gam prize (${prize}) is on hold. you have until ${deadline} to resubmit or your order will be canceled!`
        : `heads up: your jame gam prize (${prize}) is still waiting on your identity verification, and i can only hold it until ${deadline}. if you haven't started verification by then, the prize will be canceled.`;
      return `${first}\nverify here: ${VERIFY_LINK}\nonce you're verified it will be sent out automatically!`;
    }
    case 'cancel':
      return dm.ineligible
        ? `your jame gam prize order (${prize}) was canceled because your hack club account isn't eligible for prizes. if you think that's a mistake, reach out to auth@hackclub.com.`
        : `your jame gam prize order (${prize}) was canceled because you didn't start identity verification within 30 days. sorry!`;
    default:
      throw new Error(`dmText: unknown dm kind ${dm.kind}`);
  }
}

/**
 * Should the cron touch this idv_status=held row at all? Only while its
 * fulfillment status is still HELD_STATUS: anything else means someone moved
 * it by hand, and the cron leaves it alone (logged as a skip).
 */
export function cronOwns(fields) {
  return fields?.idv_status === IDV.held && fields?.status === HELD_STATUS;
}
