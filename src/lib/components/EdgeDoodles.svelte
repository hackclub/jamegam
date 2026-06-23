<!-- ===== EDGE DOODLES =====
     Big faint hand-drawn doodles down the LEFT/RIGHT edges of the page
     (recoloured to --ink, pixelated like everything else). One full-document
     overlay layer pinned to the viewport edges. It's the first child of
     #content (z-index:0, under #dust + every section), so it paints BELOW all
     page content — and since the sections are transparent, the doodles peek
     through the empty gutters on wide screens.

     Each doodle is unique and its position is HARDCODED: --top is a
     % of the (tall) document height (so they stay spread down the edges through
     reflow) and --edge is a baked-random px offset from its chosen viewport
     edge — deliberately varied: some dip a bit BEHIND the edge (negative), some
     sit farther in. None sit in the hero — they start well below the first
     screen. The last (face) is shoved mostly offscreen (big negative --edge) so
     only a sliver of it shows.

     OPACITY: when a doodle sits comfortably out in the gutter it's at full
     (faint) opacity; as soon as it creeps within PAD px of the centred middle
     column it drops even fainter so it doesn't compete with the text. This is a
     per-element geometry test against the live column bounds (expanded by PAD),
     which CSS can't express — so a tiny resize handler measures a REAL section
     `.col` (the actual centred column the doodles overlap) and toggles
     `.crowded` on each doodle. The mobile media query is the no-JS fallback
     (there the column fills the width, so everything is crowded). -->
<script>
  import { onMount } from 'svelte';

  let layer;
  // a SECOND overlay that paints ABOVE the sections (not behind like #edge-doodles),
  // holding only the clickable swap doodle — otherwise the transparent section on top
  // would eat the click. The layer is pointer-events:none; only the doodle is clickable.
  let topLayer;
  // the bottom-left doodle toggles to a second drawing when clicked (short crossfade)
  let swapped = false;
  // easter egg: clicking the doodle also retitles the tab to "gullible"
  const reveal = () => {
    swapped = true;
    document.title = 'gullible';
  };

  onMount(() => {
    let raf = 0;
    // buffer (px) around the column: a doodle fades as soon as it creeps within
    // this distance of the column edge, not only once it actually overlaps.
    const PAD = 140;
    const measure = () => {
      raf = 0;
      // Pin the layer's height to the document height MINUS the currently-open
      // FAQ answers. The doodles' --top is a % of this layer, so without the
      // subtraction every doodle would slide down whenever a FAQ answer expands
      // the page. Subtracting the expandable region keeps the reference height
      // invariant to accordion state (but still tracking real reflow: font/image
      // loads, resize, scale) so the decorations stay put as FAQs open/close.
      let faqExtra = 0;
      for (const a of document.querySelectorAll('.faq-a')) {
        faqExtra += a.getBoundingClientRect().height;
      }
      const h = (document.documentElement.scrollHeight - faqExtra) + 'px';
      layer.style.height = h;
      if (topLayer) topLayer.style.height = h;

      // measure a real centred column element — its live viewport-space bounds
      // ARE the column edges the doodles visually approach. (No synthetic probe:
      // an absolutely-positioned probe's margin-auto centring isn't reliable
      // cross-browser and was mis-reporting the left edge.)
      const colEl = document.querySelector('.col');
      if (!colEl) return;
      const col = colEl.getBoundingClientRect();
      const allEd = [...layer.querySelectorAll('.ed'), ...(topLayer ? topLayer.querySelectorAll('.ed') : [])];
      for (const el of allEd) {
        const r = el.getBoundingClientRect();
        el.classList.toggle('crowded', r.right > col.left - PAD && r.left < col.right + PAD);
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure); };

    measure();
    window.addEventListener('resize', schedule);
    // re-measure once the layout/fonts settle (doodle + column widths scale)
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);

    return () => {
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  });
</script>

<div id="edge-doodles" aria-hidden="true" bind:this={layer}>
  <!-- easter egg: revealed once the bottom doodle is clicked over to image 2.
       Pinned to the very top, centred, behind everything, faint like the doodles.
       SVG text stretched to the viewBox width so it's huge but always fits the
       screen (no hardcoded px); absolute + pointer-events:none so it never touches
       layout or interaction. -->
  <svg class="gullible" class:swapped viewBox="0 0 1000 215" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <text x="500" y="0" text-anchor="middle" dominant-baseline="text-before-edge"
          textLength="1000" lengthAdjust="spacingAndGlyphs">gullible</text>
  </svg>
  <span class="ed left"  style="--top:16%; --edge:28px;   --w:340px;"><img src="/assets/doodle_antenna.png" alt="" /></span>
  <span class="ed right" style="--top:22%; --edge:-18px;  --w:140px;"><img src="/assets/doodle_fish.png" alt="" /></span>
  <span class="ed left"  style="--top:34%; --edge:110px;  --w:360px;"><img src="/assets/doodle_cat.png" alt="" /></span>
  <span class="ed right" style="--top:33%; --edge:72px;   --w:105px;"><img src="/assets/doodle_fries.png" alt="" /></span>
  <span class="ed left"  style="--top:39%; --edge:6px;    --w:150px;"><img src="/assets/doodle_duck.png" alt="" /></span>
  <span class="ed right" style="--top:44%; --edge:-50px;  --w:150px;"><img src="/assets/doodle_jester.png" alt="" /></span>
  <span class="ed left"  style="--top:50%; --edge:-24px;  --w:200px;"><img src="/assets/doodle_bird.png" alt="" /></span>
  <span class="ed right" style="--top:55%; --edge:60px;   --w:300px;"><img src="/assets/doodle_dino.png" alt="" /></span>
  <span class="ed left"  style="--top:61%; --edge:90px;   --w:190px;"><img src="/assets/doodle_star.png" alt="" /></span>
  <span class="ed right" style="--top:67%; --edge:34px;   --w:300px;"><img src="/assets/doodle_hackclub.png" alt="" /></span>
  <span class="ed left"  style="--top:72%; --edge:40px;   --w:380px;"><img src="/assets/doodle_stove.png" alt="" /></span>
  <span class="ed right" style="--top:78%; --edge:-300px; --w:430px;"><img src="/assets/doodle_face.png" alt="" /></span>
</div>

<!-- clickable swap doodle, in its own layer ABOVE the page so the click lands. -->
<div id="edge-doodles-top" aria-hidden="true" bind:this={topLayer}>
  <!-- --pd = on-screen px per SOURCE px, shared by both images so they render at
       identical pixel density despite different native sizes (129x87 vs 97x100).
       Click is one-way: first -> second only; once swapped it's no longer clickable. -->
  <span class="ed left swap" class:swapped style="--top:87%; --edge:40px; --pd:1.4;" role="button" tabindex="-1" on:click={reveal}>
    <img class="a" src="/assets/doodle_bottom.png" alt="" width="129" height="87" />
    <img class="b" src="/assets/doodle_bottom2.png" alt="" width="97" height="100" />
  </span>
</div>

<style>
  /* full-document layer, behind all content (first child of #content). */
  #edge-doodles {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;          /* never cause horizontal scroll on its own */
  }

  /* same geometry as #edge-doodles, but painted ABOVE the sections (z-index 45,
     under the pointer-events:none grain at 50) so its one doodle is clickable.
     The layer stays click-through; only .swap re-enables pointer events. */
  #edge-doodles-top {
    position: absolute;
    inset: 0;
    z-index: 45;
    pointer-events: none;
    overflow: hidden;
  }

  .ed {
    position: absolute;
    top: var(--top);
    width: calc(var(--w) * var(--scale));
    opacity: 0.05;             /* fully in the gutter: faint */
  }
  .ed.left  { left:  calc(var(--edge) * var(--scale)); }
  .ed.right { right: calc(var(--edge) * var(--scale)); }

  /* once a doodle starts overlapping the middle column, go even fainter so it
     sits quietly behind the text. The `crowded` class is added at RUNTIME (JS
     above), so it must be :global() — otherwise Svelte prunes this rule as an
     "unused selector" (no element has the class in the markup) and the fade
     silently never happens. */
  .ed:global(.crowded) { opacity: 0.022; }

  .ed img { display: block; width: 100%; height: auto; }

  /* clickable bottom-left doodle: two stacked drawings that crossfade on click.
     pointer-events re-enabled just on this one (the layer itself is none). */
  .ed.swap {
    pointer-events: auto;
    cursor: pointer;
    width: auto;                 /* sized by image .a, not the shared --w */
  }
  /* each image at its NATIVE size * the shared --pd (and the global --scale), so
     both have identical pixel density. .a is in flow (sizes the box); .b is
     centred on top of it for the crossfade. */
  .ed.swap .a { position: relative; width: calc(129px * var(--pd) * var(--scale)); }
  .ed.swap .b { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: calc(97px * var(--pd) * var(--scale)); }
  .ed.swap .a, .ed.swap .b { transition: opacity 0.25s ease; }
  .ed.swap .a { opacity: 1; }
  .ed.swap .b { opacity: 0; }
  .ed.swap.swapped .a { opacity: 0; }
  .ed.swap.swapped .b { opacity: 1; }
  /* one-way: after the swap it's no longer interactive */
  .ed.swap.swapped { pointer-events: none; cursor: default; }

  /* "gullible" easter-egg word: pinned to the very top, centred, faint like the
     doodles. Hidden by default (so it never flashes on load) and fades in only
     once the doodle has been swapped. SVG width is viewport-relative so it's huge
     but always on screen; absolute + pointer-events:none = zero layout impact. */
  .gullible {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 92vw;
    height: auto;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .gullible.swapped { opacity: 0.03; }
  .gullible text {
    fill: #000;
    font-family: 'augiepixel', sans-serif;
    font-size: 180px;          /* in viewBox units; the SVG scales it to fit */
  }

  /* MOBILE fallback (no-JS): the column fills the width, so treat everything as
     crowded. */
  @media (max-width: 639px) {
    .ed { opacity: 0.022; }
  }
</style>
