<!--
  Footer.

  Two stacked pieces, separated from the last section by a big gap:

  1. The link block — a "made with <3 by teens, for teens" line (the heart in
     red) above a row of cross-site links, each pair split by the little pixel
     dot (footer_dot.png). Text sits
     at the dot's own colour (#d9d4d8) when idle; on hover each link lights up
     in one of the site's muted rainbow accent colours (the logo-flash palette).

  2. The bottom glow — a self-contained clone of the fixed BottomGlow strip
     (same blob palette, blur, infinite sideways scroll), but flowing in its own
     block under the footer instead of pinned to the viewport, so it never
     overlaps the link block. Faint low-opacity white text rides on top of it.
-->
<script>
  import { onMount } from 'svelte';

  // cross-site links + the rainbow accent each one flashes to on hover. Colours
  // are the logo-flash palette (see jiggle.js / BottomGlow) — red→purple.
  const links = [
    { label: 'hack club',  href: 'https://hackclub.com',            c: '#db9591' },
    { label: 'game jams',  href: 'https://gamedev.hackclub.com',    c: '#dbaf91' },
    { label: 'slack',      href: 'https://slack.hackclub.com',      c: '#97db91' },
    { label: 'clubs',      href: 'https://hackclub.com/clubs',      c: '#91a4db' },
    { label: 'hackathons', href: 'https://hackathons.hackclub.com', c: '#b991db' },
  ];

  // ---- overscroll rubber-band (à la sui.io) ----------------------------------
  // When you're already at the very bottom and keep scrolling/dragging down, the
  // extra input is captured (with diminishing-returns resistance) into `pull` —
  // px of overscroll. Let go and a spring eases it back to 0.
  //
  // `pull` drives one CSS var on :root, --overscroll-y (px), consumed two ways:
  //   • the glow's real HEIGHT grows by it — the rainbow re-renders taller,
  //     rising from the bottom edge exactly as at rest (no scaling, so the colour
  //     band never distorts or slides off the bottom).
  //   • #page lifts UP by it (gated by .overscrolling, see app.css) so the whole
  //     page "stretches" up; that upward lift cancels the downward growth of the
  //     page, leaving the glow's bottom pinned to the viewport edge.
  // Growing real height changes scrollHeight, so we preventDefault the overscroll
  // wheel (no native fighting) and measure "at bottom" against the rest height.
  let pull = $state(0);
  let stripEl;                 // the moving rainbow ribbon
  let stripAnim = null;        // its CSS drift animation — we scale its playbackRate
  const DRIFT_SPEEDUP = 0.005; // playbackRate gain per px of stretch, so the drift eases from
                               //   1× at rest to ~2.5× at full stretch (pull≈CAP) — smooth, no hard cap

  $effect(() => {
    const r = document.documentElement;
    r.style.setProperty('--overscroll-y', String(pull));
    // maxim opacity: barely-there at rest (0.08), surfacing as you pull (→ ~0.55)
    r.style.setProperty('--maxim-alpha', String(Math.max(0, 0.08 + Math.min(0.47, pull * 0.002))));
    // abs(): keep the #page transform engaged through the small negative launch-bounce
    r.classList.toggle('overscrolling', Math.abs(pull) > 0.1);
    // the rainbow drifts much faster the more it's stretched — playbackRate scales
    // smoothly (WAAPI preserves position, so no jump) and eases back to 1× at rest.
    if (stripAnim) stripAnim.playbackRate = 1 + Math.max(0, pull) * DRIFT_SPEEDUP;
  });

  onMount(() => {
    // grab the strip's CSS drift animation so we can scale its speed by stretch.
    // (Empty under prefers-reduced-motion, where the CSS disables it → stays null.)
    stripAnim = stripEl?.getAnimations?.()[0] ?? null;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ---- "slingshot" physics (two-phase: DRAW then RELEASE) ------------------
    // While you're actively scrolling at the bottom you DRAW the slingshot: input
    // accumulates into `drawTarget` (with diminishing returns) and the surface
    // eases to it and HOLDS — a free-spinning wheel just pegs it at full draw, no
    // bobbing. When the scrolling stops (no input for HOLD ms) it RELEASES: a
    // stiff progressive spring snaps it back fast, kisses a tiny bit past rest,
    // and settles. One clean return, no repeated bounce.
    //   GAIN = scroll → draw px · CAP = max draw · DRAW_RATE = follow speed (overdamped, no bob)
    //   HOLD = ms idle ⇒ "released" · BASE_K/PROG = snap tension · DAMP = friction
    //   FLING_* = when the snap reaches rest, its leftover speed becomes an upward
    //   scroll fling — the slingshot flings you back UP the page instead of hitting a wall.
    const GAIN = 0.30;          // scroll delta → draw depth (per event); low so a single
                                //   notch barely stretches — you reach depth by scrolling MORE,
                                //   which lets notched/high-friction wheels settle at the bottom
                                //   smoothly instead of getting yanked by one click.
    const CAP = 300;            // max draw depth
    const DRAW_RATE = 0.22;     // how fast the surface follows the draw (no overshoot ⇒ no bob)
    const HOLD = 200;           // ms idle before "released" — long enough to bridge the gaps
                                //   between a notched wheel's clicks, so it holds the stretch
                                //   (and the bright message) steadily while you keep scrolling.
    const BASE_K = 0.12, PROG = 0.0004;
    const DAMP = 0.72;
    const CEIL = 330;           // safety ceiling on draw depth
    // FLING: the leftover snap speed at rest becomes an upward scroll fling, simply
    // PROPORTIONAL to how far you drew — a tiny overscroll nudges you a tiny bit, a
    // deep one flings you well up. The lower GAIN keeps tiny scrolls' nudges small.
    const FLING_GAIN = 0.28;    // snap-back speed at rest → upward scroll fling speed
    const FLING_FRICTION = 0.95;// fling glide decay (↑ = glides farther)
    const FLING_MAX = 55;       // cap fling speed (px/frame) so a frame stutter can't launch a huge jump

    let drawTarget = 0;    // where the slingshot is currently drawn to
    let vel = 0;           // surface velocity (px/frame) — used during release
    let cur = 0;           // mirror of `pull` readable inside event handlers
    let raf = 0;
    let lastInput = -1e9;  // performance.now() of the last draw input
    let engaged = false;   // are we mid-overscroll-gesture? (sticky — see below)
    let flingVel = 0, flingRaf = 0;   // upward scroll-fling momentum after the snap

    // "at bottom" — only used to START a gesture. Growing the glow height inflates
    // scrollHeight by `cur` every frame, so subtract it back out; a few px of slack
    // keeps it from sitting on a knife-edge.
    const atBottom = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - Math.max(0, cur) - 6;

    const tick = () => {
      const drawing = (performance.now() - lastInput) < HOLD;
      if (drawing) {
        // overdamped follow to the draw depth — holds steady, never bobs
        const dv = (drawTarget - pull) * DRAW_RATE;
        pull += dv;
        vel = dv;                                  // hand velocity off to the release
      } else {
        // RELEASED → progressive spring snaps back to rest.
        drawTarget = 0;
        const k = BASE_K + pull * PROG;
        vel += -pull * k;
        vel *= DAMP;
        pull += vel;
        if (pull <= 0) {
          // reached rest — don't hit a wall: hand the leftover snap speed off to an
          // upward scroll fling, proportional to the draw (tiny → nudge, deep → fling).
          // The > 0.5 floor just ignores an accidental 1-px twitch.
          const snap = Math.max(0, -vel);
          const v0 = Math.min(snap * FLING_GAIN, FLING_MAX);
          pull = 0; vel = 0; cur = 0; raf = 0; engaged = false;
          if (v0 > 0.5) startFling(v0);
          return;
        }
      }
      if (pull > CEIL) { pull = CEIL; if (vel > 0) vel = 0; }
      cur = pull;
      raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    // upward inertial scroll fling — the slingshot's leftover energy, spent as real
    // page scroll. Decays with friction; stops at the top or when it peters out.
    const flingStep = () => {
      if (Math.abs(flingVel) < 0.4 || window.scrollY <= 0) { flingVel = 0; flingRaf = 0; return; }
      window.scrollBy(0, -flingVel);          // negative = up
      flingVel *= FLING_FRICTION;
      flingRaf = requestAnimationFrame(flingStep);
    };
    const startFling = (v0) => { flingVel = v0; if (!flingRaf) flingRaf = requestAnimationFrame(flingStep); };
    const stopFling = () => { flingVel = 0; if (flingRaf) { cancelAnimationFrame(flingRaf); flingRaf = 0; } };

    const onWheel = (e) => {
      // STICKY engagement: a gesture starts only when we're at the bottom, but once
      // started it stays engaged through the whole draw — we DON'T re-check atBottom
      // per event. Growing the glow nudges scrollHeight every frame, so re-checking
      // would flicker false and drop inputs, making it bob. While engaged we own
      // every downward wheel (preventDefault), so native scroll can't interfere.
      if (e.deltaY > 0 && (engaged || atBottom())) {
        e.preventDefault();
        stopFling();                              // a new draw cancels any leftover fling
        engaged = true;
        drawTarget = Math.min(CAP, drawTarget + e.deltaY * GAIN * Math.max(0, 1 - drawTarget / CAP));
        lastInput = performance.now();
        kick();
      } else if (e.deltaY < 0) {
        engaged = false;                          // scrolling up ends the gesture; it releases
      }
    };

    // touch: drag up past the bottom draws it; lifting the finger releases it
    let ty = 0, touching = false;
    const onTouchStart = (e) => { ty = e.touches[0].clientY; touching = true; };
    const onTouchMove = (e) => {
      if (!touching) return;
      const dy = ty - e.touches[0].clientY;     // >0 = dragging up (scroll down)
      ty = e.touches[0].clientY;
      if (dy > 0 && (engaged || atBottom())) {
        stopFling();
        engaged = true;
        drawTarget = Math.min(CAP, drawTarget + dy * GAIN * 1.4 * Math.max(0, 1 - drawTarget / CAP));
        lastInput = performance.now();
        kick();
      } else if (dy < 0) {
        engaged = false;
      }
    };
    const onTouchEnd = () => { touching = false; lastInput = -1e9; kick(); };   // lift = release now

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(flingRaf);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      const r = document.documentElement;
      r.style.removeProperty('--overscroll-y');
      r.style.removeProperty('--maxim-alpha');
      r.classList.remove('overscrolling');
    };
  });
</script>

<footer class="site-footer">
  <div class="footer-links">
    <p class="footer-made">
      made with <span class="footer-heart">&lt;3</span> by teens, for teens
    </p>

    <nav class="footer-nav" aria-label="Hack Club">
      {#each links as link, i}
        {#if i > 0}
          <img class="footer-dot" src="/assets/footer_dot.png" alt="" aria-hidden="true" />
        {/if}
        <a
          class="footer-link"
          style="--c:{link.c}"
          href={link.href}
          target="_blank"
          rel="noopener noreferrer">{link.label}</a>
      {/each}
    </nav>
  </div>

  <!-- bottom glow: its own block (rainbow rises from the very bottom edge), with
       the faint white maxim floating on top. aria-hidden — pure decoration.
       Outer .footer-glow = the flowing box; .__bleed = the off-edge masked
       window; .__strip = the moving rainbow (mirrors BottomGlow's structure). -->
  <div class="footer-glow" aria-hidden="true">
    <div class="footer-glow__bleed">
      <div class="footer-glow__strip" bind:this={stripEl}></div>
    </div>
    <span class="footer-glow__text">make what you want, not what you should</span>
  </div>
</footer>

<style>
  /* the footer sits above the page grain (#noise, z-index 50) so the glow and
     links aren't dimmed by it, and clips its own glow bleed. */
  .site-footer {
    position: relative;
    z-index: 60;
    width: 100%;
    overflow: clip;
  }

  /* ---- big gap, then the link block ---- */
  .footer-links {
    /* the "big gap after the last content" the brief asks for */
    margin-top: calc(180px * var(--scale));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(14px * var(--scale));
    text-align: center;
    padding-inline: var(--col-pad);
  }

  .footer-made {
    margin: 0;
    font-family: 'augiepixel', sans-serif;
    font-size: calc(30px * var(--scale));
    color: #c4bdc2;            /* a touch darker than the dot — less faint */
  }

  .footer-heart {
    color: #db9591;            /* the site's common red (the pastel palette's red) */
  }

  .footer-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: calc(16px * var(--scale));
    font-size: calc(30px * var(--scale));
  }

  /* the pixel dot separator, scaled up from its 4×4 source (stays crisp via the
     global img pixelated rule). */
  .footer-dot {
    width: calc(9px * var(--scale));
    height: calc(9px * var(--scale));
    display: block;
    flex: none;
  }

  .footer-link {
    font-family: 'augiepixel', sans-serif;
    /* idle: a FAINT version of this link's own rainbow accent (mixed toward the
       footer grey); hover fills in the full accent. --c is set inline. */
    color: color-mix(in srgb, var(--c) 42%, #c4bdc2);
    text-decoration: none;
  }
  .footer-link:hover,
  .footer-link:focus-visible {
    color: var(--c);
    text-decoration: underline;
  }

  /* ============================================================================
     BOTTOM GLOW — a flowing clone of BottomGlow's strip. Same blob palette,
     blur and infinite scroll, but contained in this block (its own space) with
     the rainbow rising from the bottom edge.
     ========================================================================== */
  .footer-glow {
    position: relative;
    width: 100%;
    /* overscroll: grow the glow's REAL height by --overscroll-y (px). The rainbow
       re-renders taller, still rising from the bottom edge — no scaling, so the
       colour band never distorts or slides off the bottom. The page lifts up by
       the same amount (app.css), cancelling this growth so the bottom stays
       pinned to the viewport edge while the rainbow visibly stretches taller. */
    /* max(0px,…) so the brief negative launch-bounce doesn't shrink the box (that
       would jitter scrollHeight); the bounce shows purely via the #page transform. */
    height: calc(520px * var(--scale) + max(0px, var(--overscroll-y, 0) * 1px));
    margin-top: calc(40px * var(--scale));
    overflow: hidden;
    pointer-events: none;
  }

  /* off-edge masked window (== BottomGlow's .bottom-glow). Bleeds ~72px past the
     side + bottom edges so the blur falloff lands off-screen; the outer
     .footer-glow clips it back to a hard edge. The vertical mask fades the glow
     solid-at-bottom → gone-at-top. */
  .footer-glow__bleed {
    position: absolute;
    left: calc(-72px * var(--scale));
    right: calc(-72px * var(--scale));
    bottom: calc(-72px * var(--scale));
    top: 0;
    overflow: hidden;
    /* The vertical fade (layer 1) shapes the MIDDLE — solid at the bottom, gone
       at the top, same as before. Layers 2+3 are pull-driven corner blobs that
       lift the LEFT and RIGHT edges higher than the middle as you overscroll,
       making the stretch a U (edges up more). Their height scales with
       --overscroll-y, so at rest (0px tall) they vanish and the top edge is flat.
       mask-composite add = union of all three (each only ever ADDS visibility). */
    -webkit-mask-image:
      linear-gradient(to top, #000 0%, #0000 100%),
      radial-gradient(58% max(0px, var(--overscroll-y, 0) * 2.6px) at 0% 100%, #000 35%, #0000 78%),
      radial-gradient(58% max(0px, var(--overscroll-y, 0) * 2.6px) at 100% 100%, #000 35%, #0000 78%);
    -webkit-mask-composite: source-over;
    mask-image:
      linear-gradient(to top, #000 0%, #0000 100%),
      radial-gradient(58% max(0px, var(--overscroll-y, 0) * 2.6px) at 0% 100%, #000 35%, #0000 78%),
      radial-gradient(58% max(0px, var(--overscroll-y, 0) * 2.6px) at 100% 100%, #000 35%, #0000 78%);
    mask-composite: add;
  }

  /* moving rainbow — identical recipe to BottomGlow__strip. 280% wide = two
     copies of the colour ribbon; translateX(-50%) loops seamlessly. Blobs sit
     just below the bottom edge (at 120%) and fade up. */
  .footer-glow__strip {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 280%;
    --glow-period: 40s;
    animation: footer-glow-scroll var(--glow-period) linear infinite;
    will-change: transform;
    filter: blur(calc(46px * var(--scale)));
    background:
      radial-gradient(19% 175% at 84.29% 120%, #db91d4 0%, #db91d4 18%, #db91d400 74%),
      radial-gradient(40% 175% at -1.43% 120%, #db9591 0%, #db959100 72%),
      radial-gradient(40% 175% at 12.86% 120%, #dbaf91 0%, #dbaf9100 72%),
      radial-gradient(40% 175% at 27.14% 120%, #dbd991 0%, #dbd99100 72%),
      radial-gradient(40% 175% at 41.43% 120%, #97db91 0%, #97db9100 72%),
      radial-gradient(40% 175% at 55.71% 120%, #91a4db 0%, #91a4db00 72%),
      radial-gradient(40% 175% at 70.00% 120%, #b991db 0%, #b991db00 72%),
      radial-gradient(40% 175% at 98.57% 120%, #db9591 0%, #db959100 72%);
    background-size: 50% 100%;
    background-repeat: repeat-x;
  }

  @keyframes footer-glow-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  /* the faint maxim floating over the rainbow. Low-opacity white reads only
     where the pastel rainbow sits behind it — a whisper, not a label. */
  .footer-glow__text {
    position: absolute;
    left: 50%;
    bottom: calc(46px * var(--scale));
    /* the glow grows taller from its bottom during overscroll; this text is
       pinned 46px off the bottom, so it stays seated in the dense colour. */
    transform: translateX(-50%);
    width: 100%;
    text-align: center;
    padding-inline: var(--col-pad);
    box-sizing: border-box;
    font-family: 'augiepixel', sans-serif;
    font-size: calc(40px * var(--scale));
    /* barely-there at rest (0.08), brightening as you overscroll — the maxim
       surfaces out of the rainbow the harder you pull (--maxim-alpha, set by the
       spring in <script>, caps ~0.55). */
    color: rgba(255, 255, 255, var(--maxim-alpha, 0.08));
    white-space: nowrap;
  }


  @media (max-width: 639px) {
    .footer-links { margin-top: calc(120px * var(--scale)); }
    .footer-glow { height: calc(380px * var(--scale)); }
    .footer-glow__text { white-space: normal; }
  }

  @media (prefers-reduced-motion: reduce) {
    .footer-glow__strip { animation: none; }
  }
</style>
