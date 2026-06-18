<!--
  Faint rainbow glow locked to the TOP of the viewport — a subtler companion to
  <BottomGlow>. Same scrolling-ribbon palette, but:
    - much lower peak opacity (a whisper, not the full bottom wash);
    - a far more PRONOUNCED U: the glow lives almost entirely in the two top
      corners. Near the centre it's just a faint tint at the edge of the blur.
    - shifted UP, so even in the corners it reaches only a little way down.
  Like the bottom glow, it's full only at scroll-top and fades out quickly.
-->
<script>
  // distance (px) over which the glow fades from full → nothing
  const FADE = 220;
  // peak opacity at scroll-top — deliberately a fraction of the bottom's 0.75
  const PEAK = 0.6;

  // `booting` stays true while the opening logo animation plays — glow hidden.
  let { booting = false } = $props();

  let scrollY = $state(0);
  let scrollFade = $derived(Math.max(0, 1 - scrollY / FADE));
  let opacity = $derived(PEAK * scrollFade);
</script>

<svelte:window bind:scrollY />

<div class="glow-gate" class:booting aria-hidden="true">
  <div class="top-glow" style="opacity:{opacity}">
    <div class="top-glow__strip"></div>
  </div>
</div>

<style>
  /* Boot reveal — instant hide during boot, own-opacity fade on reveal so the
     layer keeps its root-context z-index (see BottomGlow for the why). */
  .glow-gate.booting {
    opacity: 0;
  }
  .glow-gate:not(.booting) .top-glow {
    animation: glow-reveal 0.55s ease backwards;
  }
  @keyframes glow-reveal {
    from { opacity: 0; }
  }

  /* Infinite sideways scroll of the ribbon — same mechanism as BottomGlow. */
  @keyframes glow-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .top-glow {
    position: fixed;
    /* bleed past the top + side edges so the blur falloff lands off-screen and
       the corners read full-strength right to the edge. */
    left: calc(-72px * var(--scale));
    right: calc(-72px * var(--scale));
    top: calc(-72px * var(--scale));
    /* shorter than the bottom glow (48vh) — the effect sits high, so it doesn't
       need much vertical room. */
    height: calc(30vh + 72px * var(--scale));
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    transition: opacity 0.12s linear;
    /* Pronounced U, raised: two tight radial masks pinned to the top corners do
       almost all the work, so the glow is essentially corner-only. A very faint
       linear wash from the top edge survives across the centre — just enough to
       tint the edge of the blur there without reading as a band. (Mask layers
       composite additively, so centre = the faint linear alone, corners = full.) */
    -webkit-mask-image:
      radial-gradient(52% 66% at 0% 0%, #000 0%, #0000 66%),
      radial-gradient(52% 66% at 100% 0%, #000 0%, #0000 66%),
      linear-gradient(to bottom, rgba(0,0,0,0.13) 0%, #0000 26%);
    mask-image:
      radial-gradient(52% 66% at 0% 0%, #000 0%, #0000 66%),
      radial-gradient(52% 66% at 100% 0%, #000 0%, #0000 66%),
      linear-gradient(to bottom, rgba(0,0,0,0.13) 0%, #0000 26%);
  }

  /* The moving rainbow ribbon — identical palette to BottomGlow, but the blobs
     are anchored just ABOVE the top edge (-20%) so they bleed DOWN into view. */
  .top-glow__strip {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 280%;
    --glow-period: 40s;
    animation: glow-scroll var(--glow-period) linear infinite;
    will-change: transform;
    filter: blur(calc(46px * var(--scale)));
    background:
      radial-gradient(19% 130% at  84.29% -20%, #db91d4 0%, #db91d4 18%, #db91d400 74%),
      radial-gradient(40% 130% at  -1.43% -20%, #db9591 0%, #db959100 72%),
      radial-gradient(40% 130% at  12.86% -20%, #dbaf91 0%, #dbaf9100 72%),
      radial-gradient(40% 130% at  27.14% -20%, #dbd991 0%, #dbd99100 72%),
      radial-gradient(40% 130% at  41.43% -20%, #97db91 0%, #97db9100 72%),
      radial-gradient(40% 130% at  55.71% -20%, #91a4db 0%, #91a4db00 72%),
      radial-gradient(40% 130% at  70.00% -20%, #b991db 0%, #b991db00 72%),
      radial-gradient(40% 130% at  98.57% -20%, #db9591 0%, #db959100 72%);
    background-size: 50% 100%;
    background-repeat: repeat-x;
  }

  @media (prefers-reduced-motion: reduce) {
    .top-glow { transition: none; }
    .top-glow__strip { animation: none; }
  }
</style>
