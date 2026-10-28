// GET /api/cron/idv: the IDV prize gate's daily sweep (vercel.json, 14:00 UTC,
// about 10am ET). Re-checks every held Shop Orders row against Hack Club Auth's
// public external/check by the HCA identity id captured at shop sign-in, then
// releases, reminds or cancels it per decideIdv ($lib/server/idvcron.js, where
// the day counts and the rules live).
//
// Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
// set; anything else is a 401, `?dry=1` included. With CRON_SECRET unset every
// call is refused.
//
// `?dry=1` reports what it would do without writing to Airtable or DMing (the
// DM text is logged). Real DMs also need IDV_DMS=on (postDM).
//
// Response: { ok, dry, checked, actions: [{ order, action, status }] }, where
// `checked` counts the rows looked up in HCA and `status` is the live HCA status
// (or the skip reason).
import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { listAll, getRecord, patchRecord } from '$lib/server/shopdb.js';
import { checkIdentity } from '$lib/server/hca.js';
import { releaseHeld, sendIdvDM } from '$lib/server/idvhold.js';
import { decideIdv, dmText, cronOwns } from '$lib/server/idvcron.js';
import { config as app } from '$lib/server/config.js';
import { IDV, mapCheckResult } from '$lib/idv.js';

export const prerender = false;
// Vercel route config (adapter-vercel): dozens of held rows, 8 HCA lookups at a time
export const config = { maxDuration: 60 };

// HCA lookups in flight at once
const CONCURRENCY = 8;

function authorized(request) {
  const secret = app.cronSecret;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET({ request, url }) {
  if (!authorized(request)) return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const dry = url.searchParams.get('dry') === '1';
  const now = Date.now();
  const actions = [];
  let checked = 0;

  const rows = await listAll(app.shop.ordersTable, `{idv_status}='${IDV.held}'`);

  // someone moved the fulfillment status by hand: the cron never touches it
  const owned = [];
  for (const r of rows) {
    if (cronOwns(r.fields)) owned.push(r);
    else {
      console.log(`[idv-cron] skip ${r.id}: idv_status is held but status is "${r.fields.status}" (moved by hand)`);
      actions.push({ order: r.id, action: 'skip', status: 'manual' });
    }
  }

  async function handle(rec) {
    const raw = await checkIdentity({ hcaId: rec.fields.hca_id, slackId: rec.fields.slack_id });
    checked++;
    const live = mapCheckResult(raw);
    const d = decideIdv(rec.fields, rec.createdTime, live, now);
    const status = live ?? raw;
    for (const action of d.actions) actions.push({ order: rec.id, action, status });

    if (!d.patch) {
      console.log(`[idv-cron] skip ${rec.id}: HCA said "${raw}" (hca_id=${rec.fields.hca_id || '-'})`);
      return;
    }
    if (dry) {
      if (d.dm) console.log(`[idv-cron] dry: would DM ${rec.fields.slack_id} for ${rec.id}:\n${dmText(d.dm, rec.fields)}`);
      return;
    }

    if (d.actions.includes('release')) {
      // releaseHeld re-reads the row and writes the release fields + these
      const extra = { idv_last_status: d.patch.idv_last_status, idv_checked_at: d.patch.idv_checked_at };
      await releaseHeld(rec.id, { extra, now });
      return;
    }

    // re-read right before writing so an instant release (or a hand edit)
    // since the sweep started is never overwritten
    const fresh = await getRecord(app.shop.ordersTable, rec.id);
    if (!fresh || !cronOwns(fresh.fields)) {
      console.log(`[idv-cron] skip ${rec.id}: no longer held by the time of the write`);
      return;
    }
    await patchRecord(app.shop.ordersTable, rec.id, d.patch);
    if (d.dm) await sendIdvDM(rec.id, { ...fresh.fields, ...d.patch }, d.dm);
  }

  // a small worker pool; one row failing never stops the rest
  const queue = [...owned];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let rec; (rec = queue.shift()); ) {
        try {
          await handle(rec);
        } catch (err) {
          console.error(`[idv-cron] ${rec.id} failed:`, err?.message ?? err);
          actions.push({ order: rec.id, action: 'skip', status: 'error' });
        }
      }
    })
  );

  console.log(`[idv-cron] ${dry ? 'dry run: ' : ''}${rows.length} held, ${checked} checked, ${actions.length} actions`);
  return json({ ok: true, dry, checked, actions });
}
