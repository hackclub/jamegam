// Live identity for the token-mode submit flow. The submit token names a Sign
// Ups row; that row holds the HCA access token the callback stored, and /me
// with it returns the person's current HCA data. Shared by the form's card
// endpoint (display) and the resolve endpoint (writes the Submission Form row).
import { getSignupById } from './airtable.js';
import { fetchMe, normalizeAddresses } from './hca.js';
import { lookupSlackProfile } from './cachet.js';
import { F } from './config.js';

export async function loadSubmitIdentity(signupRecId) {
  const row = await getSignupById(signupRecId);
  if (!row) throw new Error(`sign up ${signupRecId} not found`);
  const accessToken = row.fields?.[F.hcaToken];
  if (!accessToken) throw new Error(`sign up ${signupRecId} has no ${F.hcaToken}`);

  const id = await fetchMe(accessToken);
  const email = String(id?.primary_email ?? '').toLowerCase();
  if (!email) throw new Error('no email from /api/v1/me');

  const slackId = id.slack_id ?? '';
  const prof = slackId ? await lookupSlackProfile(slackId) : null;

  return {
    email,
    firstName: id.first_name ?? '',
    lastName: id.last_name ?? '',
    slackId,
    slackHandle: prof?.handle ?? '',
    slackAvatar: prof?.imageUrl ?? '',
    status: id.verification_status ?? '',
    birthday: id.birthday || '',
    addresses: normalizeAddresses(id.addresses, null, id.phone_number || '')
  };
}

// The picked address (by HCA address id), else the primary, else the first.
export function pickAddress(addresses, addrId) {
  return (
    (addrId && addresses.find((a) => String(a.id) === String(addrId))) ||
    addresses.find((a) => a.primary) ||
    addresses[0] ||
    null
  );
}

// Submission Form fields for an identity. Every key is always written (empty
// when unknown) so a re-resolve fully overwrites what was there.
export function submissionFields(ident, addrId) {
  const a = pickAddress(ident.addresses, addrId);
  return {
    email: ident.email,
    first_name: ident.firstName,
    last_name: ident.lastName,
    slack_id: ident.slackId,
    slack_handle: ident.slackHandle,
    verification_status: ident.status,
    birthday: ident.birthday || null,
    address_line_1: a?.line1 ?? '',
    address_line_2: a?.line2 ?? '',
    city: a?.city ?? '',
    state_province: a?.region ?? '',
    zip_postal_code: a?.postal ?? '',
    country: a?.country ?? '',
    phone_number: a?.phone ?? ''
  };
}
