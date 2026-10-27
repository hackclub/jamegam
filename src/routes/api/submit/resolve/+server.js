// POST /api/submit/resolve - fills a Submission Form row's identity fields
// (email, name, slack, verification status, birthday, address, phone) from the
// submit token the form captured. Called by the "resolve identity" Airtable
// automation when a row is created, with SUBMIT_RESOLVE_SECRET as a Bearer
// token. Reads the token + picked address id off the row itself, so the caller
// only says which row. Body: { recordId, dry? } - dry returns the fields
// without writing them.
import { json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { readSubmitToken } from '$lib/server/submittoken.js';
import { loadSubmitIdentity, submissionFields } from '$lib/server/submitidentity.js';
import { getRecord, patchRecord } from '$lib/server/shopdb.js';
import { config } from '$lib/server/config.js';

export const prerender = false;

// Resolve runs seconds after submit; the slack covers a form left open for a
// while and a manual re-run of the automation.
const RESOLVE_MAX_AGE = 7 * 24 * 60 * 60;

function authorized(request) {
  const secret = config.submitResolveSecret;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST({ request }) {
  if (!authorized(request)) return json({ ok: false, error: 'unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad json' }, { status: 400 });
  }
  const recordId = String(body?.recordId ?? '');
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) {
    return json({ ok: false, error: 'bad recordId' }, { status: 400 });
  }

  const table = config.shop.submissionsTable;
  const row = await getRecord(table, recordId);
  if (!row) return json({ ok: false, error: 'row not found' }, { status: 404 });

  const tok = readSubmitToken(row.fields.submit_token, RESOLVE_MAX_AGE);
  if (!tok) return json({ ok: false, error: 'missing, forged or expired submit_token' }, { status: 422 });

  let fields;
  try {
    fields = submissionFields(await loadSubmitIdentity(tok.s), row.fields.addr);
  } catch (err) {
    console.error('[submit/resolve] identity load failed:', recordId, err);
    return json({ ok: false, error: String(err?.message ?? err) }, { status: 502 });
  }

  if (!body.dry) await patchRecord(table, recordId, fields, { typecast: true });
  return json({ ok: true, dry: !!body.dry, signup: tok.s, fields });
}
