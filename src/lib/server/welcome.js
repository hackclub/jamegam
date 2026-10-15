// The welcome email a new signup gets (Loops transactional). Shared by the
// email box (/api/signup) and the /jam sign-in path (/api/auth/callback).
// The normal emails assume an upcoming/running jam; between jams (ended, next
// not announced) the "we'll be back" variants go out instead.
import { sendTransactional } from './loops.js';
import { config } from './config.js';
import { JAM, isBetweenJams } from '$lib/jam.js';

export async function sendWelcome({ email, hasAccount, origin }) {
  const tx = isBetweenJams()
    ? (hasAccount ? config.loops.txBetweenHasAccount : config.loops.txBetweenNoAccount)
    : (hasAccount ? config.loops.txHasAccount : config.loops.txNoAccount);
  return sendTransactional({
    transactionalId: tx,
    email,
    dataVariables: {
      name: 'chat', // first email: we only have their email, not their name
      joinUrl: `${origin}/api/auth/login?email=${encodeURIComponent(email)}`,
      jamName: JAM.displayName,
      jamLink: JAM.itchUrl
    }
  });
}
