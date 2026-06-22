<script>
  // FAQ data lives in $lib/faqs.js (shared with the FAQPage JSON-LD in
  // +page.svelte so the visible answers and the schema can't drift).
  import { FAQS } from '$lib/faqs.js';
  // rebuilds the obfuscated contact email into a real mailto link, client-side
  // only (keeps the address out of the prerendered HTML / JSON-LD).
  import { deobfuscateEmail } from '$lib/actions/email.js';

  // rainbow palette borrowed from the bottom glow / how-it-works step markers
  const COLORS = ['#db9591', '#dbaf91', '#97db91', '#91a4db', '#b991db'];

  // the last item (the "contact me" one) is always expanded and not collapsable
  const lastIndex = FAQS.length - 1;
  // only one item can be open at a time; the last is always open (in addition to
  // whichever single other item the reader has expanded).
  let open = $state(FAQS.map((_, i) => i === lastIndex));
  const toggle = (i) => {
    if (i === lastIndex) return;
    const wasOpen = open[i];
    // close every collapsible item, then open this one if it wasn't already
    open = FAQS.map((_, idx) => idx === lastIndex || (idx === i && !wasOpen));
  };
</script>

<!-- ===== QUESTIONS =====
     Header row (one hand-drawn divider filling the width INTO the "questions?"
     tag at the right), then an expandable FAQ list below it. -->
<section class="sec sec-questions">
  <div class="col questions-inner">
    <div class="q-row">
      <span class="q-divider" aria-hidden="true"><img src="/assets/underline550.png" alt="" /></span>
      <div class="q-tag">
        <h2 class="txt q-title">questions?</h2>
        <!-- little doodle perched on the top-right corner: dropped 23px so its
             legs dangle over the box's top edge (relative to the tag, like the
             how-it-works hand sits on its header). -->
        <img class="q-sitter" src="/assets/q_sitter.png" alt="" aria-hidden="true" />
      </div>
    </div>

    <!-- accordion: each question toggles its answer with a slide. the "+" mark
         is rainbow-tinted (cycling the palette) and spins to an "×" when open. -->
    <ul class="faq" use:deobfuscateEmail>
      {#each FAQS as item, i}
        <li class="faq-item" class:open={open[i] && i !== lastIndex} class:fixed={i === lastIndex} style="--c: {COLORS[i % COLORS.length]}">
          <button class="faq-q txt" onclick={() => toggle(i)} aria-expanded={open[i]} disabled={i === lastIndex} aria-controls={`faq-a-${i}`}>
            <span class="faq-mark" aria-hidden="true"></span>
            <span class="faq-qtext">{item.q}</span>
          </button>
          <!-- answers are ALWAYS rendered (so they're in the prerendered HTML for
               crawlers / AI search); expand & collapse is pure CSS driven by .open,
               not an {#if}, which keeps all 11 answers in the static output.
               answers may contain inline <a> links, so render as HTML
               (content is static/trusted, authored in the FAQS array above). -->
          <div id={`faq-a-${i}`} class="faq-a" class:open={open[i]} aria-hidden={!open[i]}>
            <p class="txt">{@html item.a}</p>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .sec-questions {
    padding-block: calc(48px * var(--scale)) calc(120px * var(--scale));   /* comfy breathing room at the page bottom */
  }
  .questions-inner {
    display: flex;
    flex-direction: column;
    align-items: stretch;        /* full-width row, not centred */
  }

  /* one line: [ divider fills the gap ] questions? */
  .q-row {
    display: flex;
    align-items: center;
    gap: calc(14px * var(--scale));
    width: 100%;
  }
  /* a single divider line, cropped to whatever width is left of the tag */
  .q-divider {
    flex: 1 1 auto;
    height: calc(14px * var(--scale));
    min-width: 0;
    overflow: hidden;
  }
  .q-divider img {
    width: 100%;
    height: calc(14px * var(--scale));
    object-fit: cover;           /* crop to width rather than stitch two lines */
    object-position: left center;
    display: block;
  }

  /* the "questions?" tag: sketch box behind the heading, sized to the text */
  .q-tag {
    flex: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: calc(9px * var(--scale)) calc(24px * var(--scale)) calc(3px * var(--scale));       /* extra top padding nudges the text down, centred in the box */
    /* the sketch box, pre-spliced to the tag's aspect: the original 282px box had
       a straight ~85px section cut out of its middle and the two corner halves
       rejoined (q_box.png, 197×46), so stretching it to fill the tag is uniform
       and ~unnoticeable instead of the old horizontal squish. One image → no
       seam. The tag's width & height both scale with --scale, so the aspect is
       constant across breakpoints. */
    background: url('/assets/q_box.png') center / 100% 100% no-repeat;
  }
  .q-title {
    margin: 0;
    font-weight: normal;     /* it's an <h2>; keep the single-weight pixel look (no faux-bold) */
    font-size: var(--t-title);
    color: #504b49;
    line-height: 1;
    white-space: nowrap;
  }
  /* sitter doodle perched on the tag's top-right corner, in front of the box.
     bottom anchored to the box top, then pushed down 23px so the legs dangle
     over the edge. Art is 63×88. */
  .q-sitter {
    position: absolute;
    right: calc(-20px * var(--scale));
    bottom: calc(100% - 23px * var(--scale));
    width: calc(63px * var(--scale));
    height: calc(88px * var(--scale));
    z-index: 5;
    pointer-events: none;
  }

  /* ----- FAQ accordion ----- */
  .faq {
    list-style: none;
    margin: calc(40px * var(--scale)) 0 0;
    padding: 0;
    /* TEMP knob: extra space between every word across the whole FAQ. Tune/remove. */
    word-spacing: 0.12em;
  }

  /* the clickable question line */
  .faq-q {
    width: 100%;
    display: flex;
    align-items: center;
    gap: calc(16px * var(--scale));
    padding: calc(18px * var(--scale)) calc(4px * var(--scale));
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
    font-family: 'augiepixel', sans-serif;
    font-size: var(--t-list);
    color: #504b49;
    line-height: 1.1;
  }
  .faq-q:hover .faq-qtext { color: var(--c); }
  /* the always-open "contact me" item isn't interactive */
  .faq-q:disabled { cursor: default; }
  .faq-q:disabled:hover .faq-qtext { color: #504b49; }
  /* preserve literal multiple spaces in the source string (still wraps normally) */
  .faq-qtext { transition: color 0.15s ease; white-space: pre-wrap; }

  /* rainbow "+" (the centred PNG, tinted per-item via mask) that spins into an
     "×" when the item opens */
  .faq-mark {
    flex: none;
    width: calc(23px * var(--scale));
    height: calc(23px * var(--scale));
    background-color: var(--c);
    -webkit-mask: url('/assets/faq_plus.png') center / contain no-repeat;
            mask: url('/assets/faq_plus.png') center / contain no-repeat;
    transition: transform 0.22s ease;
    transform: rotate(0deg);
  }
  .faq-item.open .faq-mark {
    transform: rotate(135deg);   /* "+" → "×" */
  }

  /* the answer: dimmed, indented past the mark.
     ALWAYS in the DOM (for SEO/crawlers); collapsed by default via max-height:0,
     expanded by toggling .open. max-height transition keeps the old slide feel. */
  .faq-a {
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.22s ease;
  }
  .faq-a.open {
    /* generous cap — taller than any single answer; transitions like a slide */
    max-height: 30em;
  }
  .faq-a p {
    margin: 0;
    padding: 0 calc(4px * var(--scale)) calc(22px * var(--scale)) calc(39px * var(--scale));
    font-size: calc(var(--t-list) * 0.82);
    line-height: 1.35;
    /* dim via translucent colour (not opacity) so an emphasis span can read darker */
    color: rgba(80, 75, 73, 0.78);
    white-space: pre-wrap;   /* preserve literal multiple spaces in the answer string */
  }
  /* emphasised words (e.g. "may not") — full-strength ink, stands out of the dim */
  .faq-a :global(.faq-em) { color: #504b49; }
  /* a fainter aside, dimmer than the already-dim answer body */
  .faq-a :global(.faq-dim) { color: rgba(80, 75, 73, 0.5); }
  /* inline links pick up the item's rainbow colour */
  .faq-a :global(a) {
    color: var(--c);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  .faq-a :global(a:hover) {
    opacity: 0.8;
  }

  @media (max-width: 639px) {
    .sec-questions { padding-block: calc(36px * var(--scale)) calc(88px * var(--scale)); }
    .q-tag { padding: calc(5px * var(--scale)) calc(18px * var(--scale)); }
    .faq-q { padding-block: calc(15px * var(--scale)); gap: calc(12px * var(--scale)); }
  }
</style>
