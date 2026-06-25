// GET /api/auth/login - kicks off "Sign in with Hack Club". Two callers:
//   - the newcomer email CTA (passes ?email= -> prefilled via login_hint)
//   - a Fillout submission form (passes ?to=<form url> -> the submit flow; the
//     callback returns them there with their identity prefilled)
// Sets a CSRF state cookie (+ a return cookie for the submit flow) and 302s to
// HCA's authorize URL.
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authorizeUrl } from '$lib/server/hca.js';
import { safeReturnUrl } from '$lib/server/submit.js';
import { config } from '$lib/server/config.js';

export const prerender = false;

const cookieOpts = { path: '/', httpOnly: true, secure: !dev, sameSite: 'lax', maxAge: 600 };

export async function GET({ url, cookies }) {
  const email = url.searchParams.get('email') ?? undefined;
  const origin = config.origin || url.origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const state = crypto.randomUUID();
  cookies.set('hca_state', state, cookieOpts);

  // Submit flow: stash the (validated, forms.hackclub.com-only) form URL so the
  // callback knows to send them back there instead of to the homepage.
  const ret = safeReturnUrl(url.searchParams.get('to'));
  if (ret) cookies.set('hca_return', ret.toString(), cookieOpts);
  else cookies.delete('hca_return', { path: '/' });

  redirect(302, authorizeUrl({ redirectUri, state, loginHint: email }));
}
