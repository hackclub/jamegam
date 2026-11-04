// Submit flow: after HCA login we bounce the user back into a Fillout submission
// form with a signed submit token in the URL (Fillout prefills the submit_token
// field from it); no identity data rides in the URL. A new jam = a new form; the form's own JS passes
// its URL as `to`, so nothing here changes per jam. Gated to forms.hackclub.com
// so the `to` param can't be turned into an open redirect.
const ALLOWED_RETURN_HOSTS = new Set(['forms.hackclub.com']);

// Params the old URL-identity flow wrote into the form URL; stripped on the way
// back in so a stale link can't carry them through.
const STALE_PARAMS = [
  'email', 'first_name', 'last_name', 'slack_id', 'slack_handle', 'slack_avatar',
  'verification_status', 'birthday', 'address_line_1', 'address_line_2', 'city',
  'state_province', 'zip_postal_code', 'country', 'phone_number', 'addresses',
  'addr', 'hca_id_token'
];

// Returns a validated URL object for an allowed return target, or null.
export function safeReturnUrl(to) {
  if (!to) return null;
  let u;
  try {
    u = new URL(to);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (!ALLOWED_RETURN_HOSTS.has(u.hostname)) return null;
  return u;
}

// The post-auth redirect into the form: the URL carries only the signed submit
// token (plus `addr`, the picked HCA address id, which the form's JS adds). The
// card and the stored fields are both looked up server-side from it.
export function buildTokenRedirect(to, token) {
  const u = safeReturnUrl(to);
  if (!u) return null;
  for (const k of [...STALE_PARAMS, 'submit_token', 'hca_error']) u.searchParams.delete(k);
  u.searchParams.set('submit_token', token);
  return u.toString();
}

// Bounce back to the form with an error flag so its JS can re-show the button.
export function submitErrorUrl(to) {
  const u = safeReturnUrl(to);
  if (!u) return null;
  u.searchParams.set('hca_error', '1');
  return u.toString();
}
