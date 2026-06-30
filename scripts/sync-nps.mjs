// Copy NPS feedback from the Jame Gam submission form into the shared
// "NPS" table in the Unified YSWS Projects DB (one row per program-wide NPS
// response, used to compute org-wide NPS across every YSWS).
//
// Reusable: run it after each jam winds down. It dedupes on (email, jam tag),
// so re-running is safe and the same person can leave NPS for different jams
// without colliding.
//
//   bun scripts/sync-nps.mjs            # create missing NPS rows
//   bun scripts/sync-nps.mjs --dry-run  # show what would be created, write nothing
//
// Needs AIRTABLE_TOKEN (from .env) with read on the Jame Gam base and write on
// the Unified base. Both are Augie's bases, so a single PAT covers both.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = 'https://api.airtable.com/v0';
const DRY_RUN = process.argv.includes('--dry-run');

// ---- source: Jame Gam submission form ----
const SRC_BASE = 'apprhNJsC9D4nlFRB';
const SRC_TABLE = 'tblmnQSVJBu5EBoVY'; // Submission Form

// ---- destination: Unified YSWS Projects DB → NPS ----
const DST_BASE = 'app3A5kJwYqxMLOgh';
const DST_TABLE = 'tblQpkS0I9V2ixBD0'; // NPS
const PROGRAM_RECORD = 'recEsgniMKKErPnLc'; // "jame gam" program in the Unified base
const TAG_PREFIX = 'jame-gam-'; // dedupe namespace + tag prefix, one per jam

// Destination field names (exact Airtable labels).
const F = {
  score: 'On a scale from 1-10, how likely are you to recommend this YSWS to a friend?',
  ysws: 'YSWS',
  email: 'Email (optional, for prize)',
  doingWell: 'What are we doing well?',
  improve: 'How can we improve?',
  hours: 'How many hours do you estimate you spent on your project?',
  custom: 'Custom Fields',
  createdAt: 'Override Created At',
  tags: 'Tags (Comma Separated)'
};

// ---- token: prefer the environment, fall back to the repo .env ----
function loadToken() {
  if (process.env.AIRTABLE_TOKEN) return process.env.AIRTABLE_TOKEN;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*AIRTABLE_TOKEN\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  } catch {
    /* no .env */
  }
  throw new Error('AIRTABLE_TOKEN not set (env or .env)');
}
const TOKEN = loadToken();
const headers = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch every record from a table, following pagination. `params` may set
// fields[]/filterByFormula to keep payloads small.
async function fetchAll(base, table, params = {}) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: '100', ...params });
    if (offset) qs.set('offset', offset);
    const res = await fetch(`${API}/${base}/${table}?${qs}`, { headers: headers() });
    if (!res.ok) throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
    if (offset) await sleep(220); // stay under Airtable's 5 req/sec/base
  } while (offset);
  return records;
}

// The jam this submission belongs to. The form stores e.g. "2026-06"; fall back
// to the submission month so a missing jam value still lands in the right jam.
function jamKey(fields, createdTime) {
  return fields.jam || (createdTime || '').slice(0, 7);
}

async function main() {
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Syncing Jame Gam NPS → Unified NPS table`);

  // Source rows (only the fields we map).
  const srcFields = [
    'nps_recommend', 'email', 'nps_doing_well', 'nps_improve',
    'estimated_hours', 'how_did_you_hear', 'jam'
  ];
  const params = {};
  srcFields.forEach((f, i) => (params[`fields[${i}]`] = f));
  const submissions = await fetchAll(SRC_BASE, SRC_TABLE, params);
  console.log(`  source: ${submissions.length} submission rows`);

  // Existing Jame Gam NPS rows in the Unified base, keyed by email+tag.
  const existing = await fetchAll(DST_BASE, DST_TABLE, {
    'fields[0]': F.email,
    'fields[1]': F.tags,
    filterByFormula: `FIND('${TAG_PREFIX}', {${F.tags}})`
  });
  const seen = new Set(
    existing.map((r) => {
      const e = (r.fields[F.email] || '').toLowerCase();
      const t = r.fields[F.tags] || '';
      return `${e}::${t}`;
    })
  );
  console.log(`  existing: ${existing.length} Jame Gam NPS rows already in Unified`);

  // Build create payloads, skipping rows with no score or already-synced (email, jam).
  const toCreate = [];
  let skippedNoScore = 0;
  let skippedDupe = 0;
  for (const rec of submissions) {
    const f = rec.fields;
    if (f.nps_recommend == null) {
      skippedNoScore++;
      continue;
    }
    const tag = `${TAG_PREFIX}${jamKey(f, rec.createdTime)}`;
    const key = `${(f.email || '').toLowerCase()}::${tag}`;
    if (seen.has(key)) {
      skippedDupe++;
      continue;
    }
    seen.add(key); // guard against dupes within this same run

    const fields = {
      [F.score]: f.nps_recommend,
      [F.ysws]: [PROGRAM_RECORD],
      [F.tags]: tag,
      [F.createdAt]: rec.createdTime
    };
    if (f.email) fields[F.email] = f.email;
    if (f.nps_doing_well) fields[F.doingWell] = f.nps_doing_well;
    if (f.nps_improve) fields[F.improve] = f.nps_improve;
    if (f.estimated_hours != null) fields[F.hours] = f.estimated_hours;
    if (f.how_did_you_hear) {
      fields[F.custom] = `**How did you hear about this?**\n${f.how_did_you_hear}\n\n_Jame Gam submission: ${rec.id}_`;
    } else {
      fields[F.custom] = `_Jame Gam submission: ${rec.id}_`;
    }
    toCreate.push({ fields });
  }

  console.log(
    `  to create: ${toCreate.length} (skipped ${skippedDupe} already-synced, ${skippedNoScore} with no score)`
  );

  if (DRY_RUN) {
    for (const r of toCreate) {
      console.log(`    + ${r.fields[F.tags]}  ${r.fields[F.email] || '(no email)'}  score=${r.fields[F.score]}`);
    }
    console.log('[dry-run] no records written');
    return;
  }
  if (toCreate.length === 0) {
    console.log('  nothing to do.');
    return;
  }

  // Airtable creates max 10 records per request.
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    const res = await fetch(`${API}/${DST_BASE}/${DST_TABLE}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ records: batch, typecast: true })
    });
    if (!res.ok) throw new Error(`create batch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    created += data.records.length;
    console.log(`  created ${created}/${toCreate.length}`);
    await sleep(250);
  }
  console.log(`Done. Created ${created} NPS rows.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
