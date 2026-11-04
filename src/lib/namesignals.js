// Does the submitted name look like a real name? A Hack Club spot-checker
// fined a jame gam row on 2026-09-11 for "not a real name" (first name "Kosm",
// last name "0-o", which was the GitHub handle split in two), so the unified
// record needs a legal-looking name and this catches the mechanical tells.
//
// Signals only: a name a script cannot vouch for is a reason to look at the
// email, the handle and the itch page, never a verdict on the person. Real
// names are lowercase, hyphenated, accented, one letter long in some cultures,
// so every signal here names the tell it saw and the judgement stays with
// the reader.
//
// Used by the spotcheck skill's gatherer (re-exported from its scripts dir) and by
// the prize order endpoint, which repairs a flagged name from the HCA account.
// Duplicated verbatim in ysws-project-evidence/api/evidence.js (it cannot
// import from this repo). Change one, change both.

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/;
const INVISIBLE_ALL = new RegExp(INVISIBLE.source, 'g');
// Letters from any script, combining marks, spaces, and the punctuation that
// appears in real names (O'Brien, Jean-Luc, St. John, van der Berg).
const NAME_CHARS = /^[\p{L}\p{M}\s'’.\-]+$/u;
const LETTERS_ONLY = (s) => String(s || '').normalize('NFKD').replace(/[^\p{L}]/gu, '').toLowerCase();

/**
 * @param {object} f submission fields: first_name, last_name, email,
 *   submitter_github_username / github_username, slack_handle
 * @returns {{code: string, severity: 'high'|'med'|'info', detail: string}[]}
 */
export function nameSignals(f) {
  const out = [];
  const add = (severity, code, detail) => out.push({ severity, code, detail });
  const first = String(f.first_name ?? '').trim();
  const last = String(f.last_name ?? '').trim();
  if (!first && !last) return out; // missing_required_field covers blanks
  const full = `${first} ${last}`.trim();
  const shown = JSON.stringify(full);

  if (INVISIBLE.test(first + last))
    add('high', 'name_invisible_chars', `${shown} contains invisible or bidi control characters, the unified record will carry them`);

  for (const [label, v] of [['first name', first], ['last name', last]]) {
    if (!v) continue;
    const clean = v.replace(INVISIBLE_ALL, '');
    if (!NAME_CHARS.test(clean)) {
      const odd = [...new Set(clean.replace(/[\p{L}\p{M}\s'’.\-]/gu, ''))].join('');
      add('high', 'name_not_letters', `${label} ${JSON.stringify(v)} has ${/\d/.test(odd) ? 'digits' : 'symbols'} in it (${odd}); a handle, not a legal name`);
    } else if (LETTERS_ONLY(clean).length <= 1) {
      add('med', 'name_single_letter', `${label} is ${JSON.stringify(v)}, one letter; an initial gets fined as not a real name, ask for the full one`);
    } else if (/^\p{Ll}+\p{Lu}/u.test(clean)) {
      add('med', 'name_odd_casing', `${label} ${JSON.stringify(v)} has a capital mid-word, looks like a typo or a pasted handle`);
    }
  }

  // Handle used as a name: the name shows up in the GitHub or Slack handle but
  // nowhere in the email, which is the shape of "Kosm 0-o" (Kosm0-o on GitHub,
  // logantreboutat@ in the email). A name that is in both is just someone with
  // a name-shaped handle, and a name in neither says nothing on its own.
  const tokens = [...new Set([first, last].flatMap((s) => s.split(/[\s\-]+/)).map(LETTERS_ONLY).filter((t) => t.length >= 3))];
  if (tokens.length) {
    const emailLocal = LETTERS_ONLY(String(f.email || '').split('@')[0]);
    const handles = [f.submitter_github_username, f.github_username, f.slack_handle].map(LETTERS_ONLY).filter(Boolean);
    // A 4-letter prefix counts too: evari123@ is Evaristus.
    const inEmail = tokens.some((t) => emailLocal.includes(t) || (t.length >= 5 && emailLocal.includes(t.slice(0, 4))));
    const inHandle = tokens.filter((t) => handles.some((h) => h.includes(t)));
    if (!inEmail && inHandle.length && emailLocal.length >= 5) {
      add('med', 'name_is_handle', `${shown} matches the handle (${[...new Set([f.submitter_github_username, f.github_username, f.slack_handle].filter(Boolean))].join(', ')}) but not the email (${String(f.email || '').split('@')[0]}@), which may hold the real name`);
    } else if (!inEmail && !handles.length && emailLocal.length >= 8 && /^\p{L}+$/u.test(emailLocal)) {
      add('info', 'name_absent_from_email', `${shown} is not in the email local part (${emailLocal}@), which reads as a different name`);
    }
  }
  return out;
}

export default nameSignals;

// Signals that disqualify a name from the unified record. `info` never does, and the
// handle comparison is optional because it is only meaningful for a name someone
// typed: an HCA account name that happens to be their Slack handle is still a name.
export const blocksSubmit = (signals, { handles = true } = {}) =>
  signals.some((s) => s.severity !== 'info' && (handles || s.code !== 'name_is_handle'));

/**
 * The name to write over a submission row's, or null to leave it alone. Repairs only
 * a row whose name is blank or would be flagged, and only with an HCA account name
 * that passes the character checks itself, so a good typed name is never replaced
 * and a bad HCA name never replaces anything.
 * @param {object} f submission row fields
 * @param {{firstName?: string, lastName?: string}} hca the live HCA account name
 * @returns {{first_name: string, last_name: string} | null}
 */
export function nameRepair(f, hca) {
  const first = String(hca?.firstName ?? '').trim();
  const last = String(hca?.lastName ?? '').trim();
  if (!first || !last) return null;
  const blank = !String(f.first_name ?? '').trim() && !String(f.last_name ?? '').trim();
  if (!blank && !blocksSubmit(nameSignals(f))) return null;
  if (blocksSubmit(nameSignals({ ...f, first_name: first, last_name: last }), { handles: false })) return null;
  if (first === String(f.first_name ?? '').trim() && last === String(f.last_name ?? '').trim()) return null;
  return { first_name: first, last_name: last };
}
