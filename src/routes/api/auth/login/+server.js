// GET /api/auth/login - kicks off "Sign in with Hack Club". Three callers:
//   - the newcomer email CTA (passes ?email= -> prefilled via login_hint)
//   - a Fillout submission form (passes ?to=<form url> -> the submit flow; the
//     callback returns them there with their identity prefilled)
//   - the prize shop (passes ?flow=shop -> the callback mints a session cookie
//     and lands them back on /prizes)
// Sets a CSRF state cookie (+ a return/flow cookie as needed) and 302s to HCA's
// authorize URL.
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

  // Shop flow: the callback reads this cookie and mints the shop session
  // instead of running the signup/submit paths.
  const shop = url.searchParams.get('flow') === 'shop';
  if (shop) cookies.set('hca_flow', 'shop', cookieOpts);
  else cookies.delete('hca_flow', { path: '/' });

  // Submit flow: stash the (validated, forms.hackclub.com-only) form URL so the
  // callback knows to send them back there instead of to the homepage.
  const ret = shop ? null : safeReturnUrl(url.searchParams.get('to'));
  if (ret) cookies.set('hca_return', ret.toString(), cookieOpts);
  else cookies.delete('hca_return', { path: '/' });

  // Submit + shop both step up to the address+birthdate scope (prize shipping
  // + age); plain signups stay on the minimal scope.
  const scope = ret || shop ? config.hca.submitScope : config.hca.scope;
  redirect(302, authorizeUrl({ redirectUri, state, loginHint: email, scope }));
}
