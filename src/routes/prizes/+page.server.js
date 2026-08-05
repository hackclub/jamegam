// /shop - rendered per request (overrides the layout's prerender): read the
// session, pull their submissions + any existing order, and reduce it all to
// one `state` string the page renders. States:
//   signedout | nosubmission | pending | rejected | noaddress | closed |
//   shop (pick UI / order summary) | error
import { readSession, SESSION_COOKIE } from '$lib/server/session.js';
import { findSubmissions, findOrder } from '$lib/server/shopdb.js';
import {
  SHOP,
  SHOP_STATUSES,
  REJECTED_STATUSES,
  parseVariant,
  closesAtFor,
  closesTextFor
} from '$lib/shop.js';
import { JAM } from '$lib/jam.js';

export const prerender = false;

export async function load({ cookies, url }) {
  // Global values, used until we know who's asking. Anyone who's been DMed gets
  // their own (earlier) deadline swapped in below.
  const closed = Date.now() > Date.parse(SHOP.closesAt);
  const base = {
    jam: SHOP.jam,
    jamName: SHOP.jamName,
    closesAt: SHOP.closesAt,
    closesText: SHOP.closesText,
    closed,
    // the submission form for this shop's cycle - only offered while jam.js is
    // still on the same cycle (after JAM rolls over, its form is next month's)
    submitUrl: JAM.startDate.slice(0, 7) === SHOP.jam ? JAM.submitUrl : null,
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

  // the gate: a reviewer approved it (or Augie marked it Prize Only). Deliberately
  // NOT "has a staged YSWS row" - staging waits on Augie's spotcheck, and the shop
  // opens on the reviewer's call so nobody waits on the second pass to pick.
  const approved = submissions.filter((r) => SHOP_STATUSES.includes(r.fields.review_status));
  if (!approved.length) {
    // A "No Prize" row is a rejection from here: no pick, no DM coming. That it
    // still goes to the unified DB is internal and never surfaces to them.
    const allRejected = submissions.every((r) => REJECTED_STATUSES.includes(r.fields.review_status));
    return { ...base, state: allRejected ? 'rejected' : 'pending', me };
  }
  const gameTitles = approved.map((r) => r.fields.game_title).filter(Boolean);

  // their personal deadline, from the earliest prize DM across their rows (a
  // repeat submitter has several rows but only ever got one DM)
  const dmSentAt = approved
    .map((r) => r.fields.approved_dm_sent_at)
    .filter(Boolean)
    .sort()[0];
  Object.assign(base, {
    closesAt: new Date(closesAtFor(dmSentAt)).toISOString(),
    closesText: closesTextFor(dmSentAt),
    closed: Date.now() > closesAtFor(dmSentAt)
  });
  const closedForThem = base.closed;

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
        // the picked options ({ size: 'L', color: 'navy' })
        options: parseVariant(orderRec.fields.variant),
        games: String(orderRec.fields.games || '')
          .split('\n')
          .filter(Boolean),
        status: orderRec.fields.status || 'pending',
        noStickers: orderRec.fields.no_stickers === true,
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
      locked: closedForThem || ['fulfilled', 'processing', 'canceled'].includes(order.status)
    };
  }
  if (closedForThem) return { ...base, state: 'closed', me, gameTitles };
  if (!addresses.length) return { ...base, state: 'noaddress', me, gameTitles };
  return { ...base, state: 'shop', me, gameTitles, addresses, order: null, locked: false };
}
