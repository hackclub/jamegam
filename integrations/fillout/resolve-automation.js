// Airtable automation: "resolve identity" (jame gam base, Submission Form).
// Fills a new submission's identity fields (email, name, slack, verification
// status, birthday, address, phone) from the submit_token the Fillout form
// captured. The site does the lookup and writes the row itself; this script
// only tells it which row.
//
// Setup:
//   Trigger: "When a record matches conditions" on the form's table,
//            submit_token is not empty. Not "AND email is empty": the form's
//            hidden fields prefill from any URL param, so a typed ?email= would
//            otherwise block the overwrite. Re-run = clear and re-paste
//            submit_token.
//   Input variables: recordId = the trigger record's Airtable record ID
//                    table = the table name, only on forms other than the
//                    Submission Form (e.g. "Prize Suggestions"); leave it out
//                    for the Submission Form
//   Secret: resolve_secret = the same value as SUBMIT_RESOLVE_SECRET on Vercel
//
// A failure throws, so the run shows red in the automation history. Rows that
// never resolved: submit_token not empty AND email empty.
const { recordId, table } = input.config();

const res = await fetch('https://jamegam.hackclub.com/api/submit/resolve', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${input.secret('resolve_secret')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ recordId, table })
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
  throw new Error(`resolve failed for ${recordId}: ${res.status} ${body.error ?? ''}`);
}
console.log(`resolved ${recordId} from sign up ${body.signup} as ${body.fields.email}`);
