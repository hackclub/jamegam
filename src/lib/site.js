import { env } from '$env/dynamic/public';

// production origin used for canonical, og:url, and schema URLs.
// set PUBLIC_SITE_URL in .env (and in Vercel project settings) to override.
// falls back to the production domain (matches the server-side ORIGIN default).
export const SITE_URL = (env.PUBLIC_SITE_URL || 'https://jamegam.hackclub.com').replace(/\/+$/, '');
