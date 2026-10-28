// Releasing a held order: the one path both the daily cron and the instant
// release on a verified shop sign-in go through, so a jammer gets exactly
// one verified-noticed DM however they got verified.
import { getRecord, patchRecord } from './shopdb.js';
import { postDM } from './slack.js';
import { config } from './config.js';
import { findMine } from './shopcycle.js';
import { isHeld } from '$lib/idv.js';
import { releasePatch, dmText } from './idvcron.js';

/**
 * Release one held order: `status` to `not fulfilled`, `idv_status` to
 * `verified`, `idv_released_at` = now, then the verified-noticed DM. Re-reads
 * the row first and does nothing unless it is still held (status
 * `held for id verification` AND idv_status `held`), so a second caller racing the
 * first, or a row someone moved by hand, is a no-op. `extra` rides along in the
 * same write (the cron's idv_last_status / idv_checked_at).
 *
 * Returns { released: boolean, fields? }. The DM is best-effort: a failure is
 * logged and the release stands, because shipping is what matters.
 */
export async function releaseHeld(orderId, { extra = {}, now = Date.now() } = {}) {
  const row = await getRecord(config.shop.ordersTable, orderId);
  if (!row || !isHeld(row.fields)) {
    console.log(`[idv] release skipped, ${orderId} is no longer held (status=${row?.fields?.status}, idv_status=${row?.fields?.idv_status})`);
    return { released: false };
  }
  const patch = { ...extra, ...releasePatch(now) };
  await patchRecord(config.shop.ordersTable, orderId, patch);
  const fields = { ...row.fields, ...patch };
  await sendIdvDM(orderId, fields, { kind: 'released' });
  return { released: true, fields };
}

/** Best-effort IDV DM for an order row: logs instead of throwing. */
export async function sendIdvDM(orderId, fields, dm) {
  const text = dmText(dm, fields);
  try {
    await postDM(fields.slack_id, text);
  } catch (err) {
    console.error(`[idv] ${dm.kind} DM failed for ${orderId}:`, err?.message ?? err);
  }
}

/**
 * The shop sign-in's instant release: every held order this person has across
 * the open cycles (not just the one /prizes will show), released when their
 * fresh sign-in says verified. Best-effort; the daily cron is
 * the backstop.
 */
export async function releaseHeldFor(email, slackId) {
  const { orders } = await findMine(email, slackId);
  for (const o of orders.filter((o) => isHeld(o.fields))) {
    try {
      await releaseHeld(o.id);
    } catch (err) {
      console.error(`[idv] instant release failed for ${o.id}:`, err?.message ?? err);
    }
  }
}
