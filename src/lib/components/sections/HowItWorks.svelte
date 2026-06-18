<script>
  import { onMount } from 'svelte';

  let videoEl;
  let onScreen = false; // set by the IntersectionObserver; only play while visible

  // playback progress (0–1) driving the scrub bar fill
  let progress = $state(0);

  function tick() {
    if (videoEl?.duration) progress = videoEl.currentTime / videoEl.duration;
  }

  // attempt playback; no-op (and silent) if the browser refuses or it's off-screen
  function tryPlay() {
    if (videoEl && onScreen) videoEl.play().catch(() => {});
  }

  // click/tap anywhere on the bar to seek to that point (e.g. scrub back).
  // Map the click through the SVG's own coordinate matrix (getScreenCTM) rather
  // than getBoundingClientRect: this is correct across browsers despite the box's
  // -1deg rotation + non-uniform viewBox stretch, and lands the cursor exactly on
  // the fill line by mapping into the contour's real x-domain (8..712).
  function seek(e) {
    if (!videoEl?.duration) return;
    const svg = e.currentTarget.ownerSVGElement ?? e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const x = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()).x;
    const frac = Math.min(1, Math.max(0, (x - 8) / (712 - 8)));
    videoEl.currentTime = frac * videoEl.duration;
    tick();
    tryPlay(); // scrubbing counts as a gesture — start playback if it wasn't already
  }

  // bottom inner contour of the hand-drawn frame, traced from how_doodle_fill.png
  // (viewBox 722×280). The scrub line follows this wiggle instead of being straight.
  const CONTOUR =
    'M 8 272 L 16 273 L 24 272 L 32 272 L 40 272 L 48 272 L 56 272 L 64 272 L 72 272 L 80 272 L 88 273 L 96 273 L 104 272 L 112 272 L 120 272 L 128 272 L 136 272 L 144 272 L 152 272 L 160 272 L 168 271 L 176 270 L 184 270 L 192 270 L 200 270 L 208 270 L 216 270 L 224 270 L 232 270 L 240 270 L 248 270 L 256 270 L 264 270 L 272 270 L 280 270 L 288 270 L 296 271 L 304 272 L 312 272 L 320 272 L 328 272 L 336 272 L 344 272 L 352 272 L 360 272 L 368 272 L 376 272 L 384 272 L 392 272 L 400 272 L 408 272 L 416 272 L 424 270 L 432 270 L 440 269 L 448 269 L 456 269 L 464 269 L 472 269 L 480 269 L 488 269 L 496 269 L 504 269 L 512 269 L 520 269 L 528 268 L 536 268 L 544 268 L 552 269 L 560 269 L 568 269 L 576 270 L 584 271 L 592 271 L 600 272 L 608 273 L 616 273 L 624 274 L 632 274 L 640 274 L 648 274 L 656 274 L 664 274 L 672 274 L 680 274 L 688 274 L 696 274 L 704 274 L 712 274';

  let email = $state('');
  let company = $state(''); // honeypot - real humans never fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');

  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading') return;
    status = 'loading';
    message = '';
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, company })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        status = 'error';
        message = data.error || 'hmm, that didn’t work - try again?';
        return;
      }
      status = 'done';
      message = "you’re in! check your email :]";
    } catch {
      status = 'error';
      message = 'network hiccup - try again?';
    }
  }

  onMount(() => {
    // Ensure the muted *property* is set (not just the SSR'd attribute) — some
    // browsers gate muted-autoplay on the property and the attribute alone fails.
    videoEl.muted = true;

    // play while the clip is meaningfully on screen. threshold 0.5 (not 1) so it
    // reliably fires even with browser chrome/zoom that keeps it from hitting 100%.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) tryPlay();
        else videoEl.pause();
      },
      { threshold: 0.5 }
    );
    io.observe(videoEl);

    // Some browsers (Arc, energy-saver / low-power modes) block even muted autoplay,
    // leaving a frozen first frame. Kick playback off the FIRST user gesture anywhere
    // on the page, then stop listening once it's actually running.
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const kick = () => tryPlay();
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }));
    const stopKicking = () => events.forEach((e) => window.removeEventListener(e, kick));
    videoEl.addEventListener('playing', stopKicking, { once: true });

    return () => {
      io.disconnect();
      stopKicking();
      videoEl.removeEventListener('playing', stopKicking);
    };
  });
</script>

<!-- ===== HOW IT WORKS =====
     Centre column flows: titled heading (sketch box behind it + trailing
     hand-underline), the doodle-box gif, then the 5-step ordered list.
     Left-column person doodle is a wide-only decoration.

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px — used for the wide-only decoration below. -->
<section class="sec sec-how">
  <div class="col how-inner">
    <!-- title sitting on its sketch box, with the hand-underline trailing right -->
    <div class="how-title">
      <span class="how-titlebox">
        <img src="/assets/email_box542.png" alt="" />
        <h2 class="txt how-heading">how it works</h2>
      </span>
      <span class="ul how-underline"><img src="/assets/underline550.png" alt="" /></span>
    </div>

    <!-- doodle box: the jam clip (cropped to the box ratio) masked to the sealed
         interior of the hand-drawn frame — same shape the red fill used, so the
         video never bleeds past the wavy line — with the gray border laid OVER
         it. Autoplays muted + loops like a gif. Tilted 1deg left. -->
    <div class="how-doodle">
      <video bind:this={videoEl} class="how-doodle-video" loop muted playsinline preload="auto" aria-label="game jam recap" ontimeupdate={tick}>
        <source src="/assets/how_doodle.mp4" type="video/mp4" />
      </video>
      <img class="how-doodle-border" src="/assets/how_doodle_border.png" alt="" aria-hidden="true" />
      <!-- minimal scrub bar: a line riding the frame's bottom contour, filling L→R
           with playback. Click/tap the bottom strip to seek (e.g. scrub back). -->
      <svg class="how-doodle-bar" viewBox="0 0 722 280" preserveAspectRatio="none" onclick={seek} role="slider" aria-label="seek video" tabindex="-1" aria-valuenow={Math.round(progress * 100)}>
        <!-- transparent click target across the bottom strip -->
        <rect class="how-doodle-bar-hit" x="0" y="248" width="722" height="32" />
        <!-- reveal the fill with a plain user-space clip rect whose width follows
             progress (contour x runs 8..712), NOT stroke-dash/pathLength: that combo
             is miscomputed under non-scaling-stroke + a scaled viewBox in some
             browsers, making the fill drift right of the cursor, proportionally. -->
        <clipPath id="how-doodle-fill-clip" clipPathUnits="userSpaceOnUse">
          <rect x="0" y="0" width={8 + progress * 704} height="280" />
        </clipPath>
        <g transform="translate(0,-3)">
          <path class="how-doodle-bar-track" d={CONTOUR} />
          <path class="how-doodle-bar-fill" d={CONTOUR} clip-path="url(#how-doodle-fill-clip)" />
        </g>
      </svg>
    </div>

    <ol class="txt how-list">
      <li>
        gimme your email
        <!-- email field reused from the signup section: just the input + "i'm in" -->
        <div class="how-sub how-email-field">
          {#if status === 'done'}
            <span class="how-email-msg" aria-live="polite">{message}</span>
          {:else}
            <form id="how-email-form" class="how-email-box" method="post" action="/api/signup" onsubmit={submit}>
              <input id="how-email-input" type="email" placeholder="your email..." autocomplete="email" required bind:value={email} disabled={status === 'loading'} />
              <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
            </form>
            <button type="submit" form="how-email-form" class="how-email-im" aria-label="i'm in" disabled={status === 'loading'}>
              <img src="/assets/imin.png" alt="i&rsquo;m in" />
            </button>
          {/if}
        </div>
        {#if status === 'error'}
          <span class="how-sub how-email-err" aria-live="polite">{message}</span>
        {/if}
        <p class="how-sub how-sub-tight" style="opacity: 0.4">i promise i&rsquo;ll respect ur inbox</p>
      </li>
      <li>
        join the community
        <p class="how-sub">jame gam is based out of the <a class="how-link" href="https://hackclub.com/" target="_blank" rel="noopener">hack club slack</a>! you&rsquo;ll get an invitation in your email once you sign up</p>
      </li>
      <li>
        build your game
        <p class="how-sub">solo or team up! share your ideas &amp; progress :)</p>
        <p class="how-sub how-sub-tight" style="opacity: 0.4">(the theme comes from the jam itself)</p>
      </li>
      <li>
        submit twice
        <p class="how-sub">once to the jam, once to us!</p>
        <p class="how-sub how-sub-tight" style="opacity: 0.4">(you&rsquo;ll get instructions when it&rsquo;s time)</p>
      </li>
      <li>
        get your prizes
        <p class="how-sub">prize you choose + custom stickers show up in your mailbox</p>
      </li>
    </ol>

    <!-- ===== wide-only decorations (anchored to the centred column) ===== -->
    <span class="deco how-person"><img src="/assets/how_person554.png" alt="" /></span>
    <span class="deco how-basically"><img src="/assets/dec557.png" alt="basically" /></span>
  </div>
</section>

<style>
  .sec-how {
    padding-block: calc(80px * var(--scale));
  }
  .how-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* ----- title row: heading on the sketch box + trailing underline -----
     Left-aligned to the column's left edge (like the comp), not centred. */
  .how-title {
    position: relative;
    display: flex;
    align-items: center;       /* divider line vertically inline with the box */
    gap: calc(14px * var(--scale));
    align-self: flex-start;    /* hug the column's left edge */
    max-width: 100%;
  }
  .how-titlebox {
    position: relative;
    display: inline-block;
    width: calc(236px * var(--scale));
    height: calc(46px * var(--scale));
    flex: none;
  }
  .how-titlebox img {
    width: 100%;
    height: 100%;
    display: block;
  }
  .how-heading {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    padding-top: calc(5px * var(--scale));          /* nudge the text down so it sits centred in the box, not high */
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: normal;     /* it's an <h2>; keep the single-weight pixel look (no faux-bold) */
    font-size: var(--t-title);
    color: #504b49;
    white-space: nowrap;
  }
  /* hand-drawn underline trailing to the right of the box, like the comp.
     Natural art is 431×14 — keep that ratio so the line isn't squished.
     Allowed to shrink on narrow widths rather than force overflow. */
  .how-underline {
    width: calc(431px * var(--scale));
    height: calc(14px * var(--scale));
    flex: 0 1 calc(431px * var(--scale));
    min-width: 0;
    overflow: hidden;          /* crop the line's right end rather than squish it */
  }
  /* keep the art at its natural width (anchored left) so shrinking the box above
     clips the trailing end off-screen instead of horizontally compressing it. */
  .how-underline img { width: auto; max-width: none; }

  /* ----- full-column doodle box -----
     Two stacked layers in a box that keeps the 722×280 ratio:
       • .how-doodle-video — the jam clip, object-fit:cover to fill the box, then
         masked to the sealed interior (the same how_doodle_fill.png shape the red
         used, dilated 2px to tuck under the lines) so it never bleeds past the
         wavy hand-drawn edge.
       • .how-doodle-border — the whole gray hand-drawn border as one image, so it
         always meets its corners. Drawn OVER the video (z-index).
     Tilted 1deg left. */
  .how-doodle {
    position: relative;
    width: 100%;
    max-width: calc(738px * var(--scale));
    aspect-ratio: 722 / 280;
    margin-top: calc(74px * var(--scale));
    transform: rotate(-1deg);
  }
  .how-doodle-video {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 1;
    -webkit-mask: url('/assets/how_doodle_fill.png') center / 100% 100% no-repeat;
            mask: url('/assets/how_doodle_fill.png') center / 100% 100% no-repeat;
  }
  .how-doodle-border {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    z-index: 2;              /* border draws OVER the video */
  }
  /* minimal scrub bar: an SVG line tracing the frame's wiggly bottom contour.
     Sits above the border, subtle until hovered (where it thickens for easier aim). */
  .how-doodle-bar {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    z-index: 3;              /* above the border */
    overflow: visible;
  }
  .how-doodle-bar-hit { fill: transparent; cursor: inherit; pointer-events: all; }
  .how-doodle-bar-track,
  .how-doodle-bar-fill {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;   /* even thickness despite the squished viewBox */
    pointer-events: none;
  }
  .how-doodle-bar-track {
    stroke: rgba(80, 75, 73, 0.28);
    stroke-width: 2.5;
  }
  .how-doodle-bar-fill {
    stroke: #a6a1a5;                     /* gray, matches the frame ink */
    stroke-width: 3;
    transition: stroke-width 0.15s ease;
  }
  .how-doodle:hover .how-doodle-bar-track { stroke-width: 3.5; }
  .how-doodle:hover .how-doodle-bar-fill { stroke-width: 4.5; }

  /* smaller screens: full-bleed the box to the viewport edges so the video is as
     big as possible. A 100vw flex item is already centred on the viewport by the
     parent's align-items:center (it overflows the column symmetrically), so no
     left/translate offset is needed — adding one would double up and push the box
     off-centre. Just drop the tilt so the edge-to-edge video sits clean (no bg
     triangles at the screen corners). */
  @media (max-width: 800px) {
    .how-doodle {
      width: 100vw;
      max-width: 100vw;
      transform: none;
    }
  }

  /* ----- ordered list (left-aligned to the column edge, like the comp) ----- */
  .how-list {
    margin: calc(56px * var(--scale)) 0 0;
    padding-left: calc(40px * var(--scale));
    list-style-position: inside;
    text-align: left;
    align-self: stretch;          /* so even steps can right-align across the column */
    font-size: var(--t-list);
    color: #504b49;
    line-height: 1.35;
  }
  /* generous gap between each numbered step */
  .how-list > li + li {
    margin-top: calc(40px * var(--scale));
  }
  /* rainbow the step numbers (palette colours from the bottom glow) */
  .how-list > li:nth-child(1)::marker { color: #db9591; }  /* red  */
  .how-list > li:nth-child(2)::marker { color: #dbaf91; }  /* orange */
  .how-list > li:nth-child(3)::marker { color: #97db91; }  /* green */
  .how-list > li:nth-child(4)::marker { color: #91a4db; }  /* blue */
  .how-list > li:nth-child(5)::marker { color: #b991db; }  /* purple */
  /* bullet-style secondary text: slightly smaller, dimmed, indented past the
     number, with a clear gap below the numbered line. */
  .how-sub {
    margin: calc(2px * var(--scale)) 0 0;
    padding-left: calc(46px * var(--scale));   /* indent past the "N." marker */
    font-size: 0.82em;
    line-height: 1.1;
    opacity: 0.75;
  }
  /* the tight follow-on line (e.g. the theme note) hugs the line above it */
  .how-sub-tight {
    margin-top: calc(2px * var(--scale));
  }
  /* inline link inside a sub line — keeps the ink colour, underlined so it reads as a link */
  .how-link {
    color: #dbaf91;             /* accent orange, matches step #2's marker */
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  /* ----- reused email field (step 1): input box + "i'm in" button ----- */
  .how-email-field {
    /* block-level flex (not inline-flex) so it always sits on its own line under
       "gimme your email" — otherwise the short "you're in" message is narrow
       enough to flow up beside the heading while the wide box wraps below it.
       min-height locks the row to the box height so the swap doesn't jump. */
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: calc(10px * var(--scale));
    max-width: 100%;
    min-height: calc(46px * var(--scale));
    opacity: 1;                  /* override .how-sub dimming for the live control */
  }
  .how-email-box {
    flex: 1 1 calc(282px * var(--scale));
    max-width: calc(282px * var(--scale));
    height: calc(46px * var(--scale));
    background: url('/assets/email_box542.png') no-repeat center / 100% 100%;
  }
  #how-email-input {
    width: 100%; height: 100%; box-sizing: border-box;
    background: transparent; border: 0; outline: 0;
    font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif; font-size: calc(24px * var(--scale)); color: #7a7470;
    padding: 0 calc(18px * var(--scale));
  }
  #how-email-input::placeholder { color: #d9d4d8; opacity: 1; }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .how-email-msg { font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif; font-size: calc(24px * var(--scale)); color: #7a7470; }
  .how-email-err { color: #c2566e; }
  .how-email-im {
    flex: none;
    width: calc(107.7px * var(--scale)); height: calc(40px * var(--scale));
    padding: 0; border: 0; background: none; cursor: pointer;
    opacity: 0.8;
  }
  .how-email-im:hover { opacity: 0.9; }
  .how-email-im img { width: 100%; height: 100%; display: block; }

  /* ===== decorations =====
     person doodle: its big hand reaches right; the fingertips (right edge of the
     art, ~45% down) just touch the left-centre of the "how it works" box. It is
     an OVERLAP element (the hand is meant to sit on the box), so it keeps its
     exact comp offset to the column rather than pinning to the gutter — it just
     rides inward with the centred column and hides right before its outer edge
     would clip the viewport. */
  .how-person {
    left: calc(-168px * var(--scale)); top: calc(-84px * var(--scale));     /* hand's right edge just barely overlaps the box's left edge */
    width: calc(228px * var(--scale)); height: calc(199px * var(--scale));
    z-index: 5;                   /* hand sits in front of the "how it works" rectangle */
  }
  @media (max-width: 979px) {
    .how-person { display: none !important; }
  }
  /* "basically" doodle — just below the title, above the gif (comp x594 band).
     Interior (sits within the column band), so it stays until the mobile floor. */
  .how-basically {
    left: calc(300px * var(--scale)); top: calc(92px * var(--scale));
    width: calc(90px * var(--scale)); height: calc(22px * var(--scale)); opacity: .43;
  }
</style>
