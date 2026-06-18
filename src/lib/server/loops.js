// Loops email. Per Hack Club rules we only call the API for TRANSACTIONAL sends;
// contact/list data is synced via the Airtable "Loops List -" field, never the API.
import { config } from './config.js';

export async function sendTransactional({ transactionalId, email, dataVariables }) {
  const res = await fetch('https://app.loops.so/api/v1/transactional', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.loops.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transactionalId, email, dataVariables })
  });
  if (!res.ok) throw new Error(`Loops transactional failed: ${res.status} ${await res.text()}`);
  return res.json();
}
