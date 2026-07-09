<!--
  Faint rainbow glow locked to the BOTTOM of the viewport.

  - position:fixed → stays pinned to the viewport bottom as you scroll.
  - z-index:0 → above the white body bg + 10% paper, but below every section
    (z-index 1+), so it reads as a glow *behind* all the content.
  - Full strength only when the page is scrolled to the very top; it
    fades out quickly over the first ~220px of scroll, then stays gone.
  - Colours are the logo flash palette (same saturation/lightness band), laid
    out as overlapping radial blobs rising from just below the bottom edge.
  - The rainbow itself lives on an inner STRIP that's twice as wide and carries
    two identical copies of the palette; it scrolls left forever, looping
    seamlessly when it has travelled exactly one copy. The mask + bleed stay on
    the static outer element, so the motion slides UNDER them.
-->
<script>
  // distance (px) over which the glow fades from full → nothing
  const FADE = 220;
  // peak opacity when the page is scrolled to the very top
  const PEAK = 0.75;

  // `booting` is true while the opening logo animation plays — the glow stays
  // fully hidden until the page reveals, like the rest of the content.
  // `pinned` keeps the gradient at full strength regardless of scroll (and
  // drops the white bottom wash) — just the rainbow, no scroll behaviour.
  let { booting = false, pinned = false } = $props();

  let scrollY = $state(0);
  let scrollFade = $derived(pinned ? 1 : Math.max(0, 1 - scrollY / FADE));
  let opacity = $derived(PEAK * scrollFade);
  // page-bg fade: same start (1) and end point as the rainbow, but squared so
  // it drops off faster early — otherwise the opaque white lingers visibly
  // after the faint rainbow already looks gone.
  let fadeOpacity = $derived(pinned ? 0 : scrollFade * scrollFade);
</script>

<svelte:window bind:scrollY />

<!-- outer gate: handles the boot reveal (.55s, matching #content). inner: the
     glow itself, whose opacity is driven quickly by scroll. -->
<div class="glow-gate" class:booting aria-hidden="true">
  <!-- page-bg fade UNDER the rainbow: dissolves the bit of the next section
       peeking at the bottom into the page colour. Same z-index as the glow but
       earlier in the DOM, so it paints below the rainbow + above ThisMonth. -->
  <div class="bottom-fade" style="opacity:{fadeOpacity}"></div>
  <!-- static masked window; the strip inside it carries the moving rainbow. -->
  <div class="bottom-glow" style="opacity:{opacity}">
    <div class="bottom-glow__strip"></div>
  </div>
</div>

<style>
  /* Boot reveal. The two glow layers interleave with the page sections by
     z-index (ThisMonth below, hero above), which only works while they sit in
     the ROOT stacking context. A wrapper faded via group-opacity would become a
     stacking context at any fractional opacity and trap them behind the page —
     so instead the gate hides INSTANTLY during boot (opacity 0, no transition)
     and each layer fades its OWN opacity in on reveal, preserving its z-index. */
  .glow-gate.booting {
    opacity: 0;
  }
  .glow-gate:not(.booting) .bottom-fade,
  .glow-gate:not(.booting) .bottom-glow {
    animation: glow-reveal 0.55s ease backwards;
  }
  /* implicit `to` = each layer's own scroll-driven inline opacity, so no pop at
     the end; `backwards` fill means after the reveal the inline value governs. */
  @keyframes glow-reveal {
    from { opacity: 0; }
  }
  /* Infinite sideways scroll. The strip is 280% wide with two identical rainbow
     copies, so translating it by exactly -50% (= one full copy) lands copy #2
     precisely where copy #1 was → no seam, no jump. Each copy (the rainbow
     "ribbon") is 1.4× the viewport, so only part of it shows at once and the
     motion reads equally subtle at any screen size: wider screens cover more
     pixels but the same fraction of the screen, in the same time. */
  @keyframes glow-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* solid page-colour wash rising from the bottom edge — fades the peeking
     next-section content out into the page background. Sits under the rainbow
     (z-index 1, earlier in the DOM) but over ThisMonth (z-index 0). */
  .bottom-fade {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(108px * var(--scale));
    z-index: 1;
    pointer-events: none;
    transition: opacity 0.12s linear;
    background: linear-gradient(to top, #fbfbfb 0%, #fbfbfb 14%, #fbfbfb00 100%);
  }

  .bottom-glow {
    position: fixed;
    /* Bleed ~72px past the bottom + side edges (more than the 46px blur radius)
       so the blur's soft falloff lands OFF-screen. The viewport (and overflow
       below) clips the bleed to a hard edge, so the glow stays full-strength
       right up to the bottom / side edges instead of the blur fading it out
       there. Height adds the bleed back so the visible glow is still ~48vh. */
    left: calc(-72px * var(--scale));
    right: calc(-72px * var(--scale));
    bottom: calc(-72px * var(--scale));
    height: calc(48vh + 72px * var(--scale));
    /* z-index 1 so the glow paints OVER the ThisMonth section (dropped to
       z-index 0) but stays under the hero (z-index 2) and the email section
       (z-index 1, but later in DOM → above this fixed glow). */
    z-index: 1;
    pointer-events: none;
    /* clip the scrolling strip (and its blur falloff) to this off-screen box. */
    overflow: hidden;
    /* a tiny opacity transition smooths the very start/stop of scrolling */
    transition: opacity 0.12s linear;
    /* clean linear vertical fade: solid at the bottom edge, gone at the top */
    -webkit-mask-image: linear-gradient(to top, #000 0%, #0000 100%);
    mask-image: linear-gradient(to top, #000 0%, #0000 100%);
  }

  /* The moving rainbow. 280% wide → two identical copies of the colour ribbon
     (background-size 50% → each copy is one ribbon, 1.4× the viewport). Scrolls
     left forever, looping every copy. */
  .bottom-glow__strip {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 280%;
    /* how long the rainbow takes to travel one full ribbon (1.4 viewports). */
    --glow-period: 40s;
    animation: glow-scroll var(--glow-period) linear infinite;
    will-change: transform;
    filter: blur(calc(46px * var(--scale)));
    /* The logo-flash colours as soft blobs, evenly spaced every ~1/7 of the
       ribbon. The blobs are tall and fade to their OWN colour at zero alpha
       (…00) rather than the `transparent` keyword — `transparent` interpolates
       through transparent-black, which muddies the midpoint and reads as an
       uneven plateau. Vertical falloff is handled by the mask on the parent.
       Red appears at BOTH edges (-1.43% and 98.57%) so the loop seam is red↔red
       and perfectly invisible. The ribbon is 1.4× the viewport, so at rest the
       visible window only reaches purple (70%); PINK sits at 84%, just off the
       right edge, and sweeps into view as the ribbon scrolls — it never starts
       on-screen. Pink is listed FIRST (top of the stack) so the broad purple/red
       blobs don't paint over it, and uses a tight radius + saturated core so it
       reads as a vivid streak while still staying off-screen at rest. */
    background:
      radial-gradient(19% 130% at  84.29% 120%, #db91d4 0%, #db91d4 18%, #db91d400 74%),
      radial-gradient(40% 130% at  -1.43% 120%, #db9591 0%, #db959100 72%),
      radial-gradient(40% 130% at  12.86% 120%, #dbaf91 0%, #dbaf9100 72%),
      radial-gradient(40% 130% at  27.14% 120%, #dbd991 0%, #dbd99100 72%),
      radial-gradient(40% 130% at  41.43% 120%, #97db91 0%, #97db9100 72%),
      radial-gradient(40% 130% at  55.71% 120%, #91a4db 0%, #91a4db00 72%),
      radial-gradient(40% 130% at  70.00% 120%, #b991db 0%, #b991db00 72%),
      radial-gradient(40% 130% at  98.57% 120%, #db9591 0%, #db959100 72%);
    background-size: 50% 100%;
    background-repeat: repeat-x;
  }

  /* Desktop (WIDE tier, where the side-column decorations show): give the glow
     a gentle U — slightly taller on the sides, slightly lower in the middle.
     Two radial masks anchored at the bottom corners reach highest at the edges
     and dip where they overlap in the centre. Mobile/MID keep the flat linear
     fade above. */
  @media (min-width: 1280px) {
    .bottom-glow {
      -webkit-mask-image:
        radial-gradient(135% 112% at 0% 100%, #000 6%, #0000 80%),
        radial-gradient(135% 112% at 100% 100%, #000 6%, #0000 80%);
      mask-image:
        radial-gradient(135% 112% at 0% 100%, #000 6%, #0000 80%),
        radial-gradient(135% 112% at 100% 100%, #000 6%, #0000 80%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bottom-glow { transition: none; }
    .bottom-glow__strip { animation: none; }
  }
</style>
