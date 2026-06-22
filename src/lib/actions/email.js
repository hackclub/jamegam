/* ----------------------------------------------------------------------------
   deobfuscateEmail — rebuild the contact address on the client so it never sits
   in the prerendered HTML (or the FAQPage JSON-LD) as a harvestable string.

   The static markup carries only the reversed local-part / domain in data
   attributes plus a readable " at / dot " fallback (see faqs.js). Here we undo
   the reversal and stitch them into a real mailto link once we're in the browser
   — Svelte actions don't run during SSR/prerender, so the joined address only
   ever exists after hydration. Spam scrapers (and the JSON-LD) see no "@".
   ---------------------------------------------------------------------------- */

const undo = (s) => (s || '').split('').reverse().join('');

/** Svelte action: applied to a container; upgrades any a.email-obf inside it. */
export function deobfuscateEmail(root) {
  for (const el of root.querySelectorAll('a.email-obf')) {
    const addr = `${undo(el.dataset.u)}@${undo(el.dataset.d)}`;
    el.href = `mailto:${addr}`;
    el.textContent = addr;
  }
  return {};
}
