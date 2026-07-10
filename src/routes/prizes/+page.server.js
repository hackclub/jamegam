// /shop - rendered per request (overrides the layout's prerender): read the
// session, pull their submissions + any existing order, and reduce it all to
// one `state` string the page renders. States:
//   signedout | nosubmission | pending | rejected | noaddress | closed |
//   shop (pick UI / order summary) | error
import { readSession, SESSION_COOKIE } from '$lib/server/session.js';
import { findSubmissions, findOrder } from '$lib/server/shopdb.js';
import { SHOP } from '$lib/shop.js';

export const prerender = false;

export async function load({ cookies, url }) {
  const closed = Date.now() > Date.parse(SHOP.closesAt);
  const base = {
    jam: SHOP.jam,
    jamName: SHOP.jamName,
    closesAt: SHOP.closesAt,
    closesText: SHOP.closesText,
    closed,
    authError: url.searchParams.get('auth') === 'error'
  };

  const session = readSession(cookies.get(SESSION_COOKIE));
  if (!session) return { ...base, state: 'signedout' };
  const me = { firstName: session.firstName, email: session.email };

  let submissions;
  try {
    submissions = await findSubmissions(session.email, SHOP.jam);
  } catch (err) {
    console.error('[shop] submissions lookup failed:', err);
    return { ...base, state: 'error', me };
  }
  if (!submissions.length) return { ...base, state: 'nosubmission', me };

  // the gate: pushed to the YSWS component table (= reviewed + approved) and
  // not rejected
  const approved = submissions.filter(
    (r) => r.fields.ysws_project_submission_record?.length && !r.fields.rejected
  );
  if (!approved.length) {
    const allRejected = submissions.every((r) => r.fields.rejected);
    return { ...base, state: allRejected ? 'rejected' : 'pending', me };
  }
  const gameTitles = approved.map((r) => r.fields.game_title).filter(Boolean);

  let orderRec = null;
  try {
    orderRec = await findOrder(session.email, SHOP.jam);
  } catch (err) {
    console.error('[shop] order lookup failed:', err);
  }
  const order = orderRec
    ? {
        type: orderRec.fields.prize_type === 'indie games' ? 'games' : 'prize',
        prize: orderRec.fields.prize || null,
        shirtSize: orderRec.fields.shirt_size || null,
        games: String(orderRec.fields.games || '')
          .split('\n')
          .filter(Boolean),
        status: orderRec.fields.status || 'pending',
        address: {
          line1: orderRec.fields.address_line_1 || '',
          line2: orderRec.fields.address_line_2 || '',
          city: orderRec.fields.city || '',
          region: orderRec.fields.state_province || '',
          postal: orderRec.fields.zip_postal_code || '',
          country: orderRec.fields.country || ''
        }
      }
    : null;

  // shipping addresses: fresh from HCA (this sign-in) first, else fall back to
  // what they typed on the submission form. "complete" = enough for the
  // unified DB (state/province stays optional - not every country has one).
  const addresses = (session.addresses || []).filter(
    (a) => a.line1 && a.city && a.postal && a.country
  );
  if (!addresses.length) {
    const s = submissions.find((r) => r.fields.address_line_1 && r.fields.city);
    if (s) {
      addresses.push({
        id: 'submission',
        line1: s.fields.address_line_1,
        line2: s.fields.address_line_2 || '',
        city: s.fields.city || '',
        region: s.fields.state_province || '',
        postal: s.fields.zip_postal_code || '',
        country: s.fields.country || '',
        phone: s.fields.phone_number || '',
        primary: true
      });
    }
  }

  if (order) {
    return {
      ...base,
      state: 'shop',
      me,
      gameTitles,
      addresses,
      order,
      locked: closed || ['fulfilled', 'processing', 'canceled'].includes(order.status)
    };
  }
  if (closed) return { ...base, state: 'closed', me, gameTitles };
  if (!addresses.length) return { ...base, state: 'noaddress', me, gameTitles };
  return { ...base, state: 'shop', me, gameTitles, addresses, order: null, locked: false };
}
