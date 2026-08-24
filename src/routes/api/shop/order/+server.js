// POST /api/shop/order - place (or change) a prize order. The pick UI submits
// here via fetch. Everything is re-checked server-side: session, shop-open,
// the approval gate, catalog membership, and address completeness. One order
// per person per jam - a repeat POST updates the same row until it's fulfilled
// or the shop closes.
//
// Ordering also BACKFILLS the unified-DB-required identity fields (address,
// birthday) onto any of their submission rows still missing them, plus the
// linked YSWS component rows - so every ordered project can actually be
// submitted to the unified DB.
import { json } from '@sveltejs/kit';
import { readSession, SESSION_COOKIE } from '$lib/server/session.js';
import { findSubmissions, findOrder, createRecord, patchRecord } from '$lib/server/shopdb.js';
import { rateLimit } from '$lib/server/ratelimit.js';
import { config } from '$lib/server/config.js';
import { SHOP, SHOP_STATUSES, variantText, itemBlockedIn, closesAtFor, closesTextFor } from '$lib/shop.js';
import { PRIZE_GAMES, PRIZE_STUFF, GAME_PICK_COUNT } from '$lib/prizes.js';

export const prerender = false;

export async function POST({ request, cookies, getClientAddress }) {
  const session = readSession(cookies.get(SESSION_COOKIE));
  if (!session) return json({ ok: false, error: 'your session expired! sign in again' }, { status: 401 });

  if (!rateLimit(getClientAddress())) {
    return json({ ok: false, error: 'slow down a sec! try again in a moment' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  // ---- validate the pick against the catalog ----
  // variant/prize/games are always written (empty when not applicable) so
  // changing an order fully overwrites the previous pick.
  let pick;
  // the resolved prize item, kept around so the country block can re-check it
  // once we know the shipping address below (games are never country-blocked)
  let pickedItem = null;
  if (body?.type === 'games') {
    const srcs = [...new Set((Array.isArray(body.games) ? body.games : []).map(String))];
    const chosen = srcs.map((s) => PRIZE_GAMES.find((g) => g.src === s)).filter(Boolean);
    if (chosen.length !== GAME_PICK_COUNT) {
      return json({ ok: false, error: `pick exactly ${GAME_PICK_COUNT} games` }, { status: 422 });
    }
    pick = { prize_type: 'indie games', prize: '', variant: '', games: chosen.map((g) => g.name).join('\n') };
  } else if (body?.type === 'prize') {
    const p = PRIZE_STUFF.find((x) => x.src === String(body.prize));
    if (!p) return json({ ok: false, error: 'pick a prize from the pool' }, { status: 422 });
    pickedItem = p;
    // every option group the item declares (size, colour, ...) has to be a real
    // choice from that group - the UI disables the button until they all are
    const picks = {};
    for (const g of p.opts ?? []) {
      const value = String(body.options?.[g.key] ?? '');
      if (!g.choices.includes(value)) {
        return json({ ok: false, error: `pick a ${g.label}` }, { status: 422 });
      }
      picks[g.key] = value;
    }
    pick = { prize_type: 'prize', prize: p.name, variant: variantText(p, picks), games: '' };
  } else {
    return json({ ok: false, error: 'bad request' }, { status: 400 });
  }

  // ---- re-check the approval gate server-side ----
  // Same gate as the page: reviewer-approved (or Prize Only), not "has a staged
  // YSWS row".
  const submissions = await findSubmissions(session.email, SHOP.jam);
  const approved = submissions.filter((r) => SHOP_STATUSES.includes(r.fields.review_status));
  if (!approved.length) {
    return json({ ok: false, error: 'no approved submission for this jam yet' }, { status: 403 });
  }

  // ---- their personal pick window ----
  // Checked here rather than up top because it depends on when their prize DM
  // went out, which we only know once we have their submission rows. The DM both
  // opens the window and starts its clock: no DM, no picking.
  const dmSentAt = approved
    .map((r) => r.fields.approved_dm_sent_at)
    .filter(Boolean)
    .sort()[0];
  if (!dmSentAt) {
    return json({ ok: false, error: 'your prize DM has not gone out yet' }, { status: 403 });
  }
  if (Date.now() > closesAtFor(dmSentAt)) {
    return json({ ok: false, error: `the shop closed ${closesTextFor(dmSentAt)}` }, { status: 403 });
  }

  // ---- resolve the shipping address ----
  // Prefer the HCA address they chose in the UI (fresh from this sign-in);
  // fall back to what they typed on the submission form.
  const hcaAddrs = session.addresses || [];
  let addr =
    hcaAddrs.find((a) => String(a.id) === String(body.addressId)) ||
    hcaAddrs.find((a) => a.primary) ||
    hcaAddrs[0] ||
    null;
  if (!addr?.line1) {
    const s = submissions.find((r) => r.fields.address_line_1);
    if (s) {
      addr = {
        line1: s.fields.address_line_1,
        line2: s.fields.address_line_2 || '',
        city: s.fields.city || '',
        region: s.fields.state_province || '',
        postal: s.fields.zip_postal_code || '',
        country: s.fields.country || '',
        phone: s.fields.phone_number || ''
      };
    }
  }
  if (!addr?.line1 || !addr.city || !addr.postal || !addr.country) {
    return json(
      { ok: false, error: 'no complete mailing address! add one at auth.hackclub.com, then sign in again' },
      { status: 409 }
    );
  }
  // some prizes are too pricey to source/ship to certain countries - reject the
  // pick here too, so the UI's dimmed tile can't just be worked around
  if (itemBlockedIn(pickedItem, addr.country)) {
    return json(
      { ok: false, error: "that prize isn't available to ship to your country! pick another one" },
      { status: 422 }
    );
  }

  // carriers want a phone number on the label, so shipping requires one
  if (body.noStickers !== true && !addr.phone) {
    return json(
      {
        ok: false,
        error: 'your address needs a phone number for shipping! add it at auth.hackclub.com, then sign in again'
      },
      { status: 409 }
    );
  }

  const fields = {
    order_name: `${`${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email} - ${SHOP.jam}`,
    email: session.email,
    first_name: session.firstName ?? '',
    last_name: session.lastName ?? '',
    slack_id: session.slackId ?? '',
    jam: SHOP.jam,
    submission: approved.map((r) => r.id),
    ...pick,
    address_line_1: addr.line1,
    address_line_2: addr.line2 || '',
    city: addr.city,
    state_province: addr.region || '',
    zip_postal_code: addr.postal,
    country: addr.country,
    phone_number: addr.phone || '',
    // "don't ship me any stickers!" - written either way so changing an order
    // can un-tick it
    no_stickers: body.noStickers === true
  };

  // 'processing' = fulfillment started but waiting on something (Steam verifying
  // the purchase, the user confirming a detail) - locked like fulfilled, not done yet.
  const LOCKED_STATUSES = {
    fulfilled: 'your order is already fulfilled and can no longer be changed',
    processing: 'your order is already being fulfilled and can no longer be changed',
    canceled: 'your order was canceled and can no longer be changed'
  };
  const existing = await findOrder(session.email, SHOP.jam);
  const lockedError = LOCKED_STATUSES[existing?.fields?.status];
  if (lockedError) {
    return json({ ok: false, error: lockedError }, { status: 409 });
  }
  // `status` is fulfillment state, owned by Airtable - it's set once on create
  // and never written again, so changing a pick can't stomp on where Augie has
  // moved the order to. It's a single select: only the options that actually
  // exist on the field are writable (no typecast), so anything else 422s.
  try {
    if (existing) await patchRecord(config.shop.ordersTable, existing.id, fields);
    else await createRecord(config.shop.ordersTable, { ...fields, status: 'not fulfilled' });
  } catch (err) {
    console.error('[shop] order write failed:', err);
    return json({ ok: false, error: 'could not save your pick! try again in a minute' }, { status: 502 });
  }

  // ---- backfill missing unified-DB fields (best-effort; order already saved) ----
  for (const rec of submissions) {
    try {
      const f = rec.fields;
      const missingAddr = !f.address_line_1 || !f.city || !f.zip_postal_code || !f.country;
      const missingBday = !f.birthday && session.birthday;
      if (!missingAddr && !missingBday) continue;

      const patch = {};
      if (missingAddr) {
        Object.assign(patch, {
          address_line_1: addr.line1,
          address_line_2: addr.line2 || '',
          city: addr.city,
          state_province: addr.region || '',
          zip_postal_code: addr.postal,
          country: addr.country
        });
      }
      if (missingBday) patch.birthday = session.birthday;
      await patchRecord(config.shop.submissionsTable, rec.id, patch);

      // mirror into the staged YSWS component row, whose copy is just as
      // incomplete as the source row was. Often there isn't one yet - staging
      // waits on the spotcheck - and that's fine: the sync copies the address
      // across from the row we just patched when it does stage.
      const yswsId = f.ysws_project_submission_record?.[0];
      if (yswsId) {
        const ypatch = {};
        if (missingAddr) {
          Object.assign(ypatch, {
            'Address (Line 1)': addr.line1,
            'Address (Line 2)': addr.line2 || '',
            City: addr.city,
            'State / Province': addr.region || '',
            'ZIP / Postal Code': addr.postal,
            Country: addr.country
          });
        }
        if (missingBday) ypatch.Birthday = session.birthday;
        await patchRecord(config.shop.yswsTable, yswsId, ypatch);
      }
    } catch (err) {
      console.error('[shop] backfill failed:', err);
    }
  }

  return json({ ok: true });
}
