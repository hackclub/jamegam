// Central env reader for the signup/auth backend. Uses $env/dynamic/private so
// secrets resolve at runtime on Vercel (no rebuild needed to rotate a key).
// $lib/server/* is server-only - SvelteKit refuses to bundle it into the client.
import { env } from '$env/dynamic/private';

export const config = {
  airtable: {
    token: env.AIRTABLE_TOKEN,
    baseId: env.AIRTABLE_BASE_ID,
    table: env.AIRTABLE_TABLE || 'Sign Ups'
  },
  loops: {
    apiKey: env.LOOPS_API_KEY,
    txHasAccount: env.LOOPS_TX_WELCOME_HAS_ACCOUNT, // low-key "come hang out"
    txNoAccount: env.LOOPS_TX_WELCOME_NO_ACCOUNT // "[action needed]" create account
  },
  hca: {
    issuer: (env.HCA_ISSUER || 'https://auth.hackclub.com').replace(/\/$/, ''),
    clientId: env.HCA_CLIENT_ID,
    clientSecret: env.HCA_CLIENT_SECRET,
    scope: env.HCA_SCOPE || 'openid email name slack_id verification_status',
    // The submit flow steps up to address + birthdate (prize shipping + age).
    // Signups stay on the minimal scope above; only submitters get the bigger consent.
    submitScope:
      env.HCA_SCOPE_SUBMIT ||
      `${env.HCA_SCOPE || 'openid email name slack_id verification_status'} address birthdate`
  },
  slack: {
    botToken: env.SLACK_BOT_TOKEN,
    channelId: env.SLACK_JAMEGAM_CHANNEL_ID // for conversations.invite; the channel URL lives in the Loops template
  },
  origin: env.ORIGIN // optional; otherwise derived from the request origin
};

// Airtable field names, in one place so they track the actual "Sign Ups" schema.
// The Loops list/event fields are auto (formula + createdTime) - we never write them.
export const F = {
  email: 'email',
  firstName: 'first_name',
  lastName: 'last_name',
  slackId: 'slack_id',
  status: 'verification_status', // external/check result, then HCA verification_status
  slackInvited: 'is_slack_invited',
  hadAccount: 'had_account_at_signup', // did they already have an HCA account at signup (set once, immutable)
  signupOrigin: 'signup_origin' // request origin host - prod vs dev
};
