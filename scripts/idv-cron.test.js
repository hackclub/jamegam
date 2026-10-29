// Tests for the IDV cron's rules (src/lib/server/idvcron.js) and the shared
// gate helpers (src/lib/idv.js). Pure functions only, no Airtable/HCA/Slack.
//   bun test scripts/idv-cron.test.js
import { test, expect, describe } from 'bun:test';
import { decideIdv, dmText, deadlineFor, deadlineText, cronOwns } from '../src/lib/server/idvcron.js';
import { mapCheckResult, normalizeSessionStatus, orderGate, isHeld, prizeLabel, HELD_STATUS, IDV } from '../src/lib/idv.js';

const DAY = 86400000;
// 10:00 ET-ish on a weekday; the cron runs once a day at 14:00 UTC
const CREATED = Date.parse('2026-11-02T14:00:00Z');
const at = (day) => CREATED + day * DAY;

const heldRow = (extra = {}) => ({
  status: HELD_STATUS,
  idv_status: IDV.held,
  hca_id: 'ident_test',
  slack_id: 'U000TEST',
  prize_type: 'prize',
  prize: 'jame gam hoodie',
  idv_last_status: 'needs_submission',
  ...extra
});

/**
 * Run the cron once a day, days 1..last, writing each patch back into the row
 * the way the route does. `statusOn(day)` is HCA's live status that day.
 * Returns { log: { [day]: actions[] }, dms: { [day]: dm }, row }.
 */
function simulate(statusOn, last = 45, row = heldRow()) {
  const log = {};
  const dms = {};
  for (let day = 1; day <= last; day++) {
    if (!cronOwns(row)) break; // released / canceled rows leave the sweep
    const d = decideIdv(row, new Date(CREATED).toISOString(), statusOn(day), at(day));
    if (d.actions.length) log[day] = d.actions;
    if (d.dm) dms[day] = d.dm;
    if (d.patch) row = { ...row, ...d.patch };
  }
  return { log, dms, row };
}

describe('worked examples from PLAN.md', () => {
  test('not started all month: reminder day 7, final day 23, cancel day 30', () => {
    const { log, dms, row } = simulate(() => 'needs_submission');
    expect(log).toEqual({ 7: ['remind1'], 23: ['remind2'], 30: ['cancel'] });
    expect(dms[23]).toMatchObject({ kind: 'remind2', rejected: false, deadline: at(30) });
    expect(dms[30]).toEqual({ kind: 'cancel', ineligible: false, rejected: false });
    expect(dmText(dms[30], heldRow())).toContain('within 30 days');
    expect(row.status).toBe('canceled');
    expect(row.idv_status).toBe('canceled');
  });

  test('pending on day 7 gets nothing; rejected day 10 gets the first reminder that day', () => {
    const { log } = simulate((d) => (d >= 5 && d < 10 ? 'pending' : 'needs_submission'), 12);
    expect(log).toEqual({ 10: ['pending-ended', 'remind1'] });
  });

  test('pending through day 30, rejected day 34: final reminder day 34, cancel day 41', () => {
    const { log, dms, row } = simulate((d) => (d >= 3 && d < 34 ? 'pending' : 'needs_submission'), 50);
    expect(log).toEqual({ 34: ['pending-ended', 'remind2'], 41: ['cancel'] });
    expect(dms[34]).toMatchObject({ kind: 'remind2', rejected: true, deadline: at(41) });
    expect(dms[41]).toEqual({ kind: 'cancel', ineligible: false, rejected: true });
    expect(dmText(dms[41], heldRow())).toBe(
      "your jame gam prize order (jame gam hoodie) was canceled because your identity verification needed changes and wasn't resubmitted in time. sorry!"
    );
    expect(row.idv_pending_ended_at).toBe(new Date(at(34)).toISOString());
    expect(row.status).toBe('canceled');
  });

  test('resubmits and is pending again: nothing until HCA decides', () => {
    // rejected day 10, resubmits day 12, pending through day 60
    const { log, row } = simulate((d) => (d >= 5 && d < 10 ? 'pending' : d < 12 ? 'needs_submission' : 'pending'), 60);
    expect(log).toEqual({ 10: ['pending-ended', 'remind1'] });
    expect(row.status).toBe(HELD_STATUS);
  });

  test('final reminder re-arms when a rejection lands after day 23', () => {
    // needs_submission (final reminder day 23), submits day 25, rejected day 28
    const { log, dms } = simulate((d) => (d >= 25 && d < 28 ? 'pending' : 'needs_submission'), 40);
    expect(log).toEqual({ 7: ['remind1'], 23: ['remind2'], 28: ['pending-ended', 'remind2'], 35: ['cancel'] });
    expect(dms[28]).toMatchObject({ rejected: true, deadline: at(35) });
  });

  test('verifies on day 12: released, nothing after', () => {
    const { log, dms, row } = simulate((d) => (d < 12 ? 'needs_submission' : 'verified'));
    expect(log).toEqual({ 7: ['remind1'], 12: ['release'] });
    expect(dms[12]).toEqual({ kind: 'released' });
    expect(row).toMatchObject({ status: 'not fulfilled', idv_status: 'verified', idv_released_at: new Date(at(12)).toISOString() });
  });
});

describe('single decisions', () => {
  const now = at(3);
  const created = new Date(CREATED).toISOString();

  test('verified releases and writes the release fields + last status/checked', () => {
    const d = decideIdv(heldRow(), created, 'verified', now);
    expect(d.actions).toEqual(['release']);
    expect(d.patch).toEqual({
      idv_last_status: 'verified',
      idv_checked_at: new Date(now).toISOString(),
      status: 'not fulfilled',
      idv_status: 'verified',
      idv_released_at: new Date(now).toISOString()
    });
  });

  test('pending does nothing but refresh last status / checked at', () => {
    const d = decideIdv(heldRow(), created, 'pending', at(29.9));
    expect(d.actions).toEqual([]);
    expect(d.dm).toBe(null);
    expect(d.patch).toEqual({ idv_last_status: 'pending', idv_checked_at: new Date(at(29.9)).toISOString() });
  });

  test('pending past day 30 still never cancels', () => {
    expect(decideIdv(heldRow(), created, 'pending', at(90)).actions).toEqual([]);
  });

  test('ineligible cancels right away with the ineligible DM', () => {
    const d = decideIdv(heldRow(), created, 'ineligible', now);
    expect(d.actions).toEqual(['cancel']);
    expect(d.patch).toMatchObject({ status: 'canceled', idv_status: 'canceled', idv_last_status: 'ineligible' });
    expect(d.dm).toEqual({ kind: 'cancel', ineligible: true });
  });

  test('unknown status (not_found / error / garbage) is a skip with no writes', () => {
    for (const raw of ['not_found', 'unknown', 'error', undefined, 'something_new']) {
      const d = decideIdv(heldRow(), created, mapCheckResult(raw), now);
      expect(d).toEqual({ actions: ['skip'], patch: null, dm: null });
    }
  });

  test('first reminder is never sent twice', () => {
    const row = heldRow({ idv_first_reminder_at: new Date(at(7)).toISOString() });
    expect(decideIdv(row, created, 'needs_submission', at(8)).actions).toEqual([]);
  });

  test('a missed day-7 run still sends the first reminder on day 9', () => {
    expect(decideIdv(heldRow(), created, 'needs_submission', at(9)).actions).toEqual(['remind1']);
  });

  test('first match wins: day 25 with nothing sent gets the final reminder, not the first', () => {
    expect(decideIdv(heldRow(), created, 'needs_submission', at(25)).actions).toEqual(['remind2']);
  });

  test('a row whose last status was pending and is verified now just releases', () => {
    const d = decideIdv(heldRow({ idv_last_status: 'pending' }), created, 'verified', now);
    expect(d.actions).toEqual(['release']);
    expect(d.patch.idv_pending_ended_at).toBeUndefined();
  });

  test('deadlineFor', () => {
    expect(deadlineFor(CREATED, null)).toBe(at(30));
    expect(deadlineFor(CREATED, at(10))).toBe(at(30));
    expect(deadlineFor(CREATED, at(34))).toBe(at(41));
  });
});

describe('cancellation variant', () => {
  const created = new Date(CREATED).toISOString();
  test('no rejection on record: the 30-day DM', () => {
    const d = decideIdv(heldRow(), created, 'needs_submission', at(30));
    expect(d.dm).toEqual({ kind: 'cancel', ineligible: false, rejected: false });
    expect(dmText(d.dm, heldRow())).toContain("didn't start identity verification within 30 days");
  });
  test('grace after a rejection ran out (idv_pending_ended_at set): the needs-changes DM', () => {
    const row = heldRow({ idv_pending_ended_at: new Date(at(34)).toISOString(), idv_final_reminder_at: new Date(at(34)).toISOString() });
    const d = decideIdv(row, created, 'needs_submission', at(41));
    expect(d.dm).toEqual({ kind: 'cancel', ineligible: false, rejected: true });
    expect(dmText(d.dm, row)).toContain("needed changes and wasn't resubmitted in time");
  });
  test('rejected early (day 10), still canceled at day 30: the needs-changes DM', () => {
    const row = heldRow({ idv_pending_ended_at: new Date(at(10)).toISOString() });
    const d = decideIdv(row, created, 'needs_submission', at(30));
    expect(d.dm.rejected).toBe(true);
  });
  test('ineligible keeps the ineligible variant', () => {
    const d = decideIdv(heldRow({ idv_pending_ended_at: new Date(at(10)).toISOString() }), created, 'ineligible', at(12));
    expect(dmText(d.dm, heldRow())).toContain("isn't eligible for prizes");
  });
});

describe('skip-manual', () => {
  test('cronOwns only rows still in held for id verification with idv_status held', () => {
    expect(cronOwns(heldRow())).toBe(true);
    expect(cronOwns(heldRow({ status: 'not fulfilled' }))).toBe(false); // released by hand
    expect(cronOwns(heldRow({ status: 'canceled' }))).toBe(false);
    expect(cronOwns(heldRow({ idv_status: 'verified' }))).toBe(false);
    expect(cronOwns(heldRow({ idv_status: 'canceled', status: 'canceled' }))).toBe(false);
    expect(isHeld(heldRow())).toBe(true);
  });
});

describe('status mapping', () => {
  test('external/check results', () => {
    expect(mapCheckResult('verified_eligible')).toBe('verified');
    expect(mapCheckResult('verified_but_over_18')).toBe('verified');
    expect(mapCheckResult('rejected')).toBe('ineligible');
    expect(mapCheckResult('needs_submission')).toBe('needs_submission');
    expect(mapCheckResult('pending')).toBe('pending');
    expect(mapCheckResult('not_found')).toBe(null);
    expect(mapCheckResult('error')).toBe(null);
  });
  test('/me verification_status', () => {
    for (const s of ['verified', 'needs_submission', 'pending', 'ineligible']) expect(normalizeSessionStatus(s)).toBe(s);
    expect(normalizeSessionStatus('verified_but_over_18')).toBe('verified');
    expect(normalizeSessionStatus(undefined)).toBe('');
    expect(normalizeSessionStatus(null)).toBe('');
    expect(normalizeSessionStatus('weird')).toBe('');
  });
});

describe('orderGate', () => {
  const FROM = '2026-10-29T00:00:00Z';
  const after = '2026-10-30T15:00:00.000Z';
  test('DM before the gate is grandfathered whatever the status', () => {
    for (const s of ['verified', 'needs_submission', 'pending', 'ineligible', ''])
      expect(orderGate('2026-10-28T15:00:00.000Z', s, FROM)).toBe('grandfathered');
  });
  test('after the gate', () => {
    expect(orderGate(after, 'verified', FROM)).toBe('verified');
    expect(orderGate(after, 'needs_submission', FROM)).toBe('held');
    expect(orderGate(after, 'pending', FROM)).toBe('held');
    expect(orderGate(after, '', FROM)).toBe('held');
    expect(orderGate(after, 'ineligible', FROM)).toBe('ineligible');
  });
});

describe('DM copy', () => {
  const row = heldRow();
  test('prize label', () => {
    expect(prizeLabel(row)).toBe('jame gam hoodie');
    expect(prizeLabel({ prize_type: 'indie games', prize: '' })).toBe('your indie games');
  });
  test('every DM renders with no dashes, no middle dots and no placeholders left', () => {
    const dms = [
      { kind: 'released' },
      { kind: 'remind1' },
      { kind: 'remind2', deadline: at(30), rejected: false },
      { kind: 'remind2', deadline: at(41), rejected: true },
      { kind: 'cancel', ineligible: false, rejected: false },
      { kind: 'cancel', ineligible: false, rejected: true },
      { kind: 'cancel', ineligible: true }
    ];
    for (const dm of dms) {
      const t = dmText(dm, row);
      expect(t).toContain('(jame gam hoodie)');
      expect(t).not.toMatch(/[—–·{}]/);
    }
    expect(dmText(dms[2], row)).toContain(`hold it until ${deadlineText(at(30))}.`);
    expect(dmText(dms[3], row).split('\n')[0]).toBe(
      `your hack club identity verification was marked 'needs changes,' so your jame gam prize (jame gam hoodie) is on hold. you have until ${deadlineText(at(41))} to resubmit or your order will be canceled!`
    );
  });
  test('deadline text is the ET calendar day', () => {
    expect(deadlineText(Date.parse('2026-12-02T14:00:00Z'))).toBe('wednesday, december 2');
    // 2am UTC on the 3rd is still the 2nd in ET
    expect(deadlineText(Date.parse('2026-12-03T02:00:00Z'))).toBe('wednesday, december 2');
  });
});
