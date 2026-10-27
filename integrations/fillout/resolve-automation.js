// Airtable automation: "resolve identity" (jame gam base, Submission Form).
// Fills a new submission's identity fields (email, name, slack, verification
// status, birthday, address, phone) from the submit_token the Fillout form
// captured. The site does the lookup and writes the row itself; this script
// only tells it which row.
//
// Setup:
//   Trigger: "When a record matches conditions" on Submission Form,
//            submit_token is not empty AND email is empty
//            (so it fires once per token-mode submission, and a re-run is just
//            clearing email)
//   Input variable: recordId = the trigger record's Airtable record ID
//   Secret: resolve_secret = the same value as SUBMIT_RESOLVE_SECRET on Vercel
//
// A failure throws, so the run shows red in the automation history. Rows that
// never resolved: submit_token not empty AND email empty.
const { recordId } = input.config();

const res = await fetch('https://jamegam.hackclub.com/api/submit/resolve', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${input.secret('resolve_secret')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ recordId })
});
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.ok) {
  throw new Error(`resolve failed for ${recordId}: ${res.status} ${body.error ?? ''}`);
}
console.log(`resolved ${recordId} from sign up ${body.signup} as ${body.fields.email}`);
