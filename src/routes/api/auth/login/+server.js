// GET /api/auth/login - kicks off "Sign in with Hack Club" (the newcomer email's
// CTA). Sets a CSRF state cookie and 302s the browser to HCA's authorize URL,
// with the email prefilled via login_hint.
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authorizeUrl } from '$lib/server/hca.js';
import { config } from '$lib/server/config.js';

export const prerender = false;

export async function GET({ url, cookies }) {
  const email = url.searchParams.get('email') ?? undefined;
  const origin = config.origin || url.origin;
  const redirectUri = `${origin}/api/auth/callback`;

  const state = crypto.randomUUID();
  cookies.set('hca_state', state, {
    path: '/',
    httpOnly: true,
    secure: !dev, // localhost dev is http; prod is https
    sameSite: 'lax',
    maxAge: 600
  });

  redirect(302, authorizeUrl({ redirectUri, state, loginHint: email }));
}
