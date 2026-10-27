// GET /api/submit/card?t=<submit token> - what the Fillout sign-in card shows
// (name, avatar, birthday, address picker), fetched by the form's JS so none of
// it has to ride in the form URL. Display only: the stored copy is written
// server-side by /api/submit/resolve after they submit. Tokens are honoured for
// CARD_MAX_AGE, so one left in browser history goes dead the same day.
import { json } from '@sveltejs/kit';
import { readSubmitToken } from '$lib/server/submittoken.js';
import { loadSubmitIdentity } from '$lib/server/submitidentity.js';

export const prerender = false;

const CARD_MAX_AGE = 6 * 60 * 60;
const CORS = {
  'Access-Control-Allow-Origin': 'https://forms.hackclub.com',
  'Access-Control-Allow-Methods': 'GET',
  'Cache-Control': 'no-store',
  Vary: 'Origin'
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET({ url }) {
  const tok = readSubmitToken(url.searchParams.get('t'), CARD_MAX_AGE);
  if (!tok) return json({ ok: false, error: 'expired' }, { status: 401, headers: CORS });

  try {
    const id = await loadSubmitIdentity(tok.s);
    return json(
      {
        ok: true,
        email: id.email,
        firstName: id.firstName,
        lastName: id.lastName,
        slackHandle: id.slackHandle,
        slackAvatar: id.slackAvatar,
        birthday: id.birthday,
        addresses: id.addresses
      },
      { headers: CORS }
    );
  } catch (err) {
    console.error('[submit/card] identity load failed:', err);
    return json({ ok: false, error: 'lookup' }, { status: 502, headers: CORS });
  }
}
