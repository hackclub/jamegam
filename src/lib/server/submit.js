// Submit flow: after HCA login we bounce the user back into a Fillout submission
// form with their verified identity in the URL (Fillout prefills hidden fields
// from matching query params). A new jam = a new form; the form's own JS passes
// its URL as `to`, so nothing here changes per jam. Gated to forms.hackclub.com
// so the `to` param can't be turned into an open redirect.
const ALLOWED_RETURN_HOSTS = new Set(['forms.hackclub.com']);

// Query-param names the form's hidden fields prefill from. Kept in one place so
// the Fillout setup and this builder stay in sync.
export const SUBMIT_PARAMS = [
  'email',
  'first_name',
  'last_name',
  'slack_id',
  'slack_handle',
  'slack_avatar', // display-only (the signed-in card); no need to store it
  'verification_status',
  'hca_token' // HCA's own signed id_token - the anti-forgery anchor
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

// Build the post-auth redirect into the form with identity prefilled. Strips any
// stale identity params first so a re-auth can't stack values. Returns null if
// `to` isn't an allowed form URL.
export function buildSubmitRedirect(to, id) {
  const u = safeReturnUrl(to);
  if (!u) return null;
  for (const k of SUBMIT_PARAMS) u.searchParams.delete(k);
  const set = (k, v) => {
    if (v) u.searchParams.set(k, v);
  };
  set('email', id.email);
  set('first_name', id.firstName);
  set('last_name', id.lastName);
  set('slack_id', id.slackId);
  set('slack_handle', id.slackHandle);
  set('slack_avatar', id.slackAvatar);
  set('verification_status', id.status);
  set('hca_token', id.idToken);
  return u.toString();
}

// Bounce back to the form with an error flag so its JS can re-show the button.
export function submitErrorUrl(to) {
  const u = safeReturnUrl(to);
  if (!u) return null;
  u.searchParams.set('hca_error', '1');
  return u.toString();
}
