// Shared signup state for every "i'm in" box on the page (there are three: the
// hero one, the how-it-works one, and the closing "ready?" one). The first box
// to succeed flips `done`
// for all of them, so the same visitor can't re-submit from a box further down -
// the multiple boxes act as one signup. Errors stay local to each box (returned
// to the caller), so a network hiccup on one doesn't paint the others red.
import { writable, get } from 'svelte/store';

export const signup = writable({ done: false, message: '' });

// POST one email to /api/signup, guarding against a repeat submit in this
// session. Returns { ok } (+ { error } on failure); on success it sets the
// shared `signup` store, which every box subscribes to.
export async function submitSignup({ email, company }) {
  const v = String(email || '').trim();
  if (!v) return { ok: false };
  if (get(signup).done) return { ok: true }; // already signed up this session

  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: v, company })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return { ok: false, error: data.error };

  // alreadySignedUp = the server found an existing row for this email, so it
  // skipped re-sending the welcome email. Reassure them rather than re-promise it.
  const message = data.alreadySignedUp
    ? 'you’re already in :]'
    : 'you’re in! check your email :]';
  signup.set({ done: true, message });
  return { ok: true };
}
