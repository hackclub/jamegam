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

export async function markById(id, fields) {
  const res = await fetch(`${tableUrl()}/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields, typecast: true })
  });
  if (!res.ok) throw new Error(`Airtable mark failed: ${res.status} ${await res.text()}`);
  return res.json();
}
