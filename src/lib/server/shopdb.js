// Airtable REST helpers for the shop: read the Submission Form, read/write
// Shop Orders, and backfill the YSWS component table. Same base + token as the
// signups helpers (airtable.js); these are just table-parameterised versions.
import { dev } from '$app/environment';
import { config } from './config.js';

// TEMP: airtable-free dev mode (kept around for the next downtime) - flip to
// true to serve canned data. dev-gated so it can never run in prod.
// findSubmissions returns one approved mock row; the order lives in memory for
// the life of the dev-server process, so the whole pick flow is testable.
const MOCK = dev && false;
let mockOrder = null;
const mockSubmission = (email, jam) => ({
  id: 'recMOCKSUB',
  fields: {
    email,
    jam,
    game_title: 'mock game (dev)',
    ysws_project_submission_record: ['recMOCKYSWS'],
    address_line_1: '15 Falls Rd',
    address_line_2: '',
    city: 'Shelburne',
    state_province: 'VT',
    zip_postal_code: '05482',
    country: 'US'
  }
});

const API = 'https://api.airtable.com/v0';

const tableUrl = (table, id) =>
  `${API}/${config.airtable.baseId}/${encodeURIComponent(table)}${id ? `/${id}` : ''}`;

const headers = () => ({
  Authorization: `Bearer ${config.airtable.token}`,
  'Content-Type': 'application/json'
});

// escape single quotes for use inside a filterByFormula string literal
const esc = (s) => String(s).replace(/'/g, "\\'");

async function listRecords(table, formula, maxRecords = 10) {
  const url = `${tableUrl(table)}?maxRecords=${maxRecords}&filterByFormula=${encodeURIComponent(formula)}`;
  // Airtable hiccups (transient 5xx, hangs) run inside the page load, so cap
  // each attempt and retry once - a flaky moment becomes a quick retry (or a
  // fast error state) instead of a minutes-long pending page.
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(8000) });
    } catch (err) {
      if (attempt < 1) { await new Promise((r) => setTimeout(r, 400)); continue; }
      throw err;
    }
    if (res.ok) return (await res.json()).records ?? [];
    if (res.status >= 500 && attempt < 1) { await new Promise((r) => setTimeout(r, 400)); continue; }
    throw new Error(`Airtable list ${table} failed: ${res.status} ${await res.text()}`);
  }
}

export async function createRecord(table, fields) {
  if (MOCK) {
    if (table === config.shop.ordersTable) mockOrder = { id: 'recMOCKORDER', fields };
    return { id: 'recMOCK', fields };
  }
  const res = await fetch(tableUrl(table), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Airtable create ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function patchRecord(table, id, fields) {
  if (MOCK) {
    if (table === config.shop.ordersTable && mockOrder) {
      mockOrder = { ...mockOrder, fields: { ...mockOrder.fields, ...fields } };
    }
    return { id, fields };
  }
  const res = await fetch(tableUrl(table, id), {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`Airtable patch ${table} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// All of this person's submissions for the jam. A repeat submitter can have
// several rows; the shop treats them as one person with one prize.
export function findSubmissions(email, jam) {
  if (MOCK) return Promise.resolve([mockSubmission(email, jam)]);
  const formula = `AND(LOWER({email})='${esc(email.toLowerCase())}', {jam}='${esc(jam)}')`;
  return listRecords(config.shop.submissionsTable, formula, 10);
}

// One order per person per jam - the shop upserts against this.
export async function findOrder(email, jam) {
  if (MOCK) return mockOrder;
  const formula = `AND(LOWER({email})='${esc(email.toLowerCase())}', {jam}='${esc(jam)}')`;
  const recs = await listRecords(config.shop.ordersTable, formula, 1);
  return recs[0] ?? null;
}
