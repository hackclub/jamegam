// Silent email prefill via Hack Club Auth's whoami endpoint.
//
// If the visitor already has a Hack Club Auth session (the auth.hackclub.com
// cookie), HCA hands back their email so we can prefill every signup box without
// a redirect or a click. The fetch is credentialed and cross-origin; the browser
// only lets us read the response when this site's exact origin is registered as
// the app's whoami_allowed_origin in HCA (an admin setting). Anywhere else - not
// signed in, origin not allowlisted, offline - it silently no-ops and the boxes
// stay empty. See hackclub/auth#279.
//
// jamegam.hackclub.com and auth.hackclub.com are same-site (both under
// hackclub.com), so the session cookie rides along even though it's SameSite=Lax.
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const HCA_ISSUER = (env.PUBLIC_HCA_ISSUER || 'https://auth.hackclub.com').replace(/\/+$/, '');

// The signed-in visitor's email, or '' while unknown / not signed in.
export const prefillEmail = writable('');

let started = false;

// Probe whoami once per page load. Safe to call from several mount points.
export async function loadPrefill() {
  if (!browser || started) return;
  started = true;
  try {
    const res = await fetch(`${HCA_ISSUER}/api/external/whoami`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.signed_in && data.email) prefillEmail.set(data.email);
  } catch {
    // not signed in / offline / origin not allowlisted - leave the boxes empty
  }
}
