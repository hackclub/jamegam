// Airtable REST helpers for the "Jame Gam Signups" table. We upsert on Email so
// re-signups don't create duplicate rows.
import { config, F } from './config.js';

const API = 'https://api.airtable.com/v0';

const tableUrl = () =>
  `${API}/${config.airtable.baseId}/${encodeURIComponent(config.airtable.table)}`;

const headers = () => ({
  Authorization: `Bearer ${config.airtable.token}`,
  'Content-Type': 'application/json'
});

// escape single quotes for use inside a filterByFormula string literal
const esc = (s) => String(s).replace(/'/g, "\\'");

export async function findByEmail(email) {
  const formula = `LOWER({${F.email}})='${esc(email.toLowerCase())}'`;
  const url = `${tableUrl()}?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Airtable find failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records?.[0] ?? null;
}

// create or update a signup row; returns the record. typecast lets Airtable
// coerce select/text values so a fresh table doesn't 422 on first write.
export async function upsertSignup(fields) {
  const existing = await findByEmail(fields[F.email]);
  const url = existing ? `${tableUrl()}/${existing.id}` : tableUrl();
  const res = await fetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) throw new Error(`Airtable upsert failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// total number of signup rows (the hero's "[n] and counting"). Airtable has no
// count endpoint, so page through with only the email field requested to keep
// the payloads tiny. ~5 requests per 500 signups; callers should cache.
export async function countSignups() {
  let count = 0;
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    params.append('fields[]', F.email);
    if (offset) params.set('offset', offset);
    const res = await fetch(`${tableUrl()}?${params}`, { headers: headers() });
    if (!res.ok) throw new Error(`Airtable count failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    count += data.records?.length ?? 0;
    offset = data.offset;
  } while (offset);
  return count;
}

export async function markById(id, fields) {
  const res = await fetch(`${tableUrl()}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) throw new Error(`Airtable mark failed: ${res.status} ${await res.text()}`);
  return res.json();
}
