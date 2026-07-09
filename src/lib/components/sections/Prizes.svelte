<script>
  import { onMount } from 'svelte';
  import SharkPrize from '$lib/components/SharkPrize.svelte';
  import { rainbowBorder } from '$lib/actions/rainbowBorder.js';
  import { borderRipple } from '$lib/actions/borderRipple.js';
  import { jiggleImage } from '$lib/actions/jiggleImage.js';
  import { jiggle } from '$lib/actions/jiggle.js';
  import { PRIZES, GAME_PICK_COUNT } from '$lib/prizes.js';

  // The prize loot, scattered INSIDE the rainbow border. Placement is a real
  // randomised scatter (computed in JS, below) — no rows, no columns. The pool
  // itself lives in $lib/prizes.js (shared with the /shop pick flow); the
  // scatter only reads the per-item s (size) + r (tilt) fields from it.
  // shopOnly items (late additions to the shop) stay out of the scatter.
  const prizes = PRIZES.filter((p) => !p.shopOnly);

  let content;                                          // .prizes-content element
  let pos = $state(prizes.map(() => ({ x: 0, y: 0 }))); // per-item centre (px)
  let stageW = $state(0);                               // computed cluster width (px)
  let stageH = $state(0);                               // computed cluster height (px)
  let capW = $state(0);                                 // caption width: box width inset to sit inside the rainbow band
  let ready = $state(false);                            // hide until first layout

  // hovered-prize tooltip (a little sticker tag that follows the cursor)
  let hoverName = $state(null);
  let hoverColor = $state('#504b49');                   // accent colour of the hovered prize
  let hoverGame = $state(false);                        // is the hovered prize an indie game?
  let hoverLead = $state('that’s a');              // the "that's a"/"that's" lead (some names already carry their article)
  let hoverNote = $state('');                            // optional deemphasized trailing note (e.g. "only if …")
  let tip = $state({ x: 0, y: 0 });
  const showTip = (p, e) => { hoverName = p.name; hoverColor = p.c; hoverGame = !!p.game; hoverLead = p.lead || 'that’s a'; hoverNote = p.note || ''; tip = { x: e.clientX, y: e.clientY }; };
  const moveTip = (e) => { tip = { x: e.clientX, y: e.clientY }; };
  const hideTip = () => { hoverName = null; };

  // Packing/scatter params. These are the knobs the on-page tuner (?tune) edits
  // live; the defaults here are what ships. fill = packing tightness, aspect =
  // cluster width:height, space = min gap (1 = touch, <1 = overlap), slack = a
  // touch of breathing room, scale = global size multiplier, seed = re-roll.
  let P = $state({ fill: 0.68, aspect: 1.6, space: 1.1, scale: 1, seed: 20260617 });
  let tune = $state(false);                             // show the tuner (?tune)

  // "prizes" title size (px). Fixed — NOT the responsive token — because the
  // border's notch is a fixed-pixel piece it must match. Tweak live in ?tune,
  // then bake the chosen number into --prizes-title-size in the stylesheet.
  let titleSize = $state(39);

  // a paste-ready snapshot of the current params (for the tuner's "copy" button)
  const paramStr = $derived(
    `{ fill: ${P.fill}, aspect: ${P.aspect}, space: ${P.space}, scale: ${P.scale}, seed: ${P.seed} }`
  );
  function copyParams() { try { navigator.clipboard.writeText(paramStr); } catch {} }

  // small deterministic PRNG so the scatter is STABLE (no reshuffle/flicker, and
  // identical between SSR + hydrate) yet looks random. Bump the seed to re-roll.
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Lay the prizes out via a small relaxation ("spring") sim: items are pulled
  // toward a centre line and pushed apart on collision inside a fixed-width band,
  // settling into a TIGHT touching cluster (consistent density at any width). The
  // border then hugs the settled bounding box. Re-runs on width change. Each item
  // is treated as a circle of radius ~s/2.
  function layout() {
    if (!content) return;
    const cs = getComputedStyle(content);
    const padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
    const radii = prizes.map((p) => (p.s * scale * P.scale) / 2);
    const GAP = P.space;                                // collision gap factor (1.0 = items touch)

    // Target cluster WIDTH from the items' own footprint (fill = tightness,
    // aspect = width:height), capped to the column width. The relaxation below
    // packs to a CONSISTENT density (items touching) inside this width, so it
    // stays tight at any screen size — on a narrow screen the width just shrinks
    // and the cluster gets taller, never looser.
    const host = content.closest('.prizes-inner') || content.parentElement;
    const hcs = getComputedStyle(host);
    const avail = host.clientWidth - parseFloat(hcs.paddingLeft) - parseFloat(hcs.paddingRight);
    // When the viewport has room OUTSIDE the centre column, let the box grow into it
    // (it's centred, so it overflows the column symmetrically; the page clips
    // overflow-x, so no scrollbar). `grow` is 0 on tight screens → the box stays at
    // column width and the cluster extends VERTICALLY instead. EXTRA caps how much
    // wider than the column it may get; EDGE keeps it off the viewport edges.
    const EXTRA = 200 * scale;
    const EDGE = 24 * scale;
    const docW = document.documentElement.clientWidth;
    const grow = Math.max(0, Math.min(EXTRA, docW - avail - 2 * EDGE));
    const boxW = avail + grow;                          // box OUTER width: the column width, +grow when there's gutter room
    // the cluster fills the available width; the relaxation below then stacks the
    // prizes to whatever HEIGHT that takes. So on a wide screen the box widens; on a
    // tight screen (grow≈0) it stays column-width and grows taller instead. (fill /
    // aspect no longer drive width — `space` controls how much the prizes breathe.)
    const W = Math.max(2 * Math.max(...radii), boxW - padL - padR);
    if (W <= 0) return;

    // ---- relaxation ("springs") ----
    // Items start spread out, then each step: pulled toward a horizontal centre
    // line (vertical compaction) + pushed apart on collision; left/right walls
    // lock the width. They settle into a tight band — every item touching its
    // neighbours — that fills the width with minimal height. Deterministic
    // (seeded init) so it's stable across reloads and re-rollable via the seed.
    const N = prizes.length;
    const rnd = mulberry32(P.seed);
    const px = new Array(N), py = new Array(N);
    for (let i = 0; i < N; i++) {
      const r = radii[i];
      px[i] = r + rnd() * Math.max(1, W - 2 * r);
      py[i] = (rnd() - 0.5) * Math.max(W, 1);           // spread vertically to start
    }
    const STEPS = 500, GY = 0.05;                        // GY = pull-to-centre strength
    for (let s = 0; s < STEPS; s++) {
      for (let i = 0; i < N; i++) py[i] -= py[i] * GY;  // gravity toward the y=0 line
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = px[j] - px[i], dy = py[j] - py[i];
          const d = Math.hypot(dx, dy) || 0.0001;
          const need = (radii[i] + radii[j]) * GAP;
          if (d < need) {                               // overlapping → push apart equally
            const push = (need - d) / 2, nx = dx / d, ny = dy / d;
            px[i] -= nx * push; py[i] -= ny * push;
            px[j] += nx * push; py[j] += ny * push;
          }
        }
      }
      for (let i = 0; i < N; i++) {                      // lock the side walls (fix the width)
        const r = radii[i];
        if (px[i] < r) px[i] = r; else if (px[i] > W - r) px[i] = W - r;
      }
    }

    // hug the settled cluster: shift its bounding box to the padding origin and
    // size the box to it (so the border wraps the tight clump at any screen size).
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      if (px[i] - radii[i] < minX) minX = px[i] - radii[i];
      if (px[i] + radii[i] > maxX) maxX = px[i] + radii[i];
      if (py[i] - radii[i] < minY) minY = py[i] - radii[i];
      if (py[i] + radii[i] > maxY) maxY = py[i] + radii[i];
    }
    // Box WIDTH is the deterministic available width (W) — NOT the settled cluster's
    // emergent bbox. The emergent bbox disagrees with the rendered prizes (rotation +
    // image aspect make them span wider than their packing circles) and varies with
    // the seed, so hugging it desynced the border from the loot — the box could snap
    // to ~column width while the prizes stayed spread wider and spilled past it. So
    // we fix the width to W and CENTRE the cluster in it; only the HEIGHT hugs the
    // clump, so a tight screen still grows taller.
    const clusterW = maxX - minX;
    const xOff = padL + Math.max(0, (W - clusterW) / 2) - minX;
    pos = prizes.map((_, i) => ({ x: xOff + px[i], y: padT + (py[i] - minY) }));
    const moreBand = 46 * scale;                         // room at the bottom for the "…more to come" line
    stageW = padL + W + padR;
    stageH = padT + (maxY - minY) + moreBand + padB;
    // caption tracks the box width, but inset so it sits INSIDE the sketchy rainbow
    // band rather than flush to stageW (which includes 8px bleed + ~13px border). The
    // max() floor keeps it at the natural column width when the box is within the
    // column (grow≈0) — there the box isn't wider than the text anyway, so don't shrink.
    const borderInset = 30 * scale;                      // per-side keep-out from the box edge
    capW = Math.max(avail, stageW - 2 * borderInset);
    ready = true;
  }

  // re-pack whenever a tuner param changes (and once on mount). Reading each P
  // field here registers it as a dependency.
  $effect(() => {
    void (P.fill, P.aspect, P.space, P.scale, P.seed);
    layout();
  });

  onMount(() => {
    tune = new URLSearchParams(location.search).has('tune');
    // observe the COLUMN (not the box, whose width we set ourselves) so a viewport
    // change relayouts; a width change re-runs the pack, height changes are ignored.
    const host = content?.closest('.prizes-inner') || content?.parentElement;
    let lastW = host?.clientWidth ?? 0;
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      if (Math.abs(w - lastW) > 1) { lastW = w; layout(); }
    });
    if (host) ro.observe(host);
    // the column stops growing at its max-width, so a wider VIEWPORT (gutter change)
    // won't trip the ResizeObserver — watch the viewport too, so the box widens into
    // newly-available gutter room. rAF-throttled, only relayout on real width change.
    let lastDoc = document.documentElement.clientWidth;
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const dw = document.documentElement.clientWidth;
        if (Math.abs(dw - lastDoc) > 1) { lastDoc = dw; layout(); }
      });
    };
    addEventListener('resize', onResize);
    return () => { ro.disconnect(); removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
  });
</script>

<!-- ===== PRIZES =====
     Centre column: the "prizes" title and a decorative rainbow-bordered box.
     The box is responsive (width:100%, capped); its sketchy rainbow border is
     rebuilt at any size by use:rainbowBorder (ResizeObserver), so it just needs
     a fluid width/height. Wide-only doodles ("watch the video", "basically")
     are .deco accents.

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px — used for the wide-only decorations below. -->
<section class="sec sec-prizes">
  <div class="col prizes-inner">
    <h2 class="txt prizes-title" style="--prizes-title-size:{titleSize}px" use:jiggle={{ underline: false }}>prizes</h2>

    <!-- decorative rainbow-bordered box. empty by design; the border action
         draws the sketchy outline + the CSS below paints the rainbow fill.
         the element carries 8px of transparent bleed on every side (756×364
         = visible 740×348 + 8px all round) so outward-nudged border edges
         aren't cropped; rainbowBorder({bleed:8}) draws into the inner box.
         The ripple filter lives on the WRAPPER, not the box: CSS applies
         `filter` BEFORE `mask`, so filtering the box would only displace the
         rainbow texture (then the unchanged mask reclips it). Filtering the
         wrapper feeds the already-masked border into the filter, so the border
         SHAPE itself ripples. -->
    <!-- box: the rainbow border + the prize loot scattered inside it. Height is
         driven by .prizes-content (the only flow child), so the box grows
         vertically as more prizes wrap; the border layer fills the box and its
         ResizeObserver redraws the sketchy outline to whatever height results. -->
    <div class="prizes-box" style={stageW ? `width:${stageW}px` : ''}>
      <!-- border layer: absolutely fills the box (follows the content size). -->
      <div class="box-ripple" use:borderRipple aria-hidden="true">
        <div class="el-prizes_box rainbow-box" use:rainbowBorder={{ bleed: 8 }}></div>
      </div>

      <!-- the prizes, randomly scattered inside the border (absolute, positioned
           by the JS scatter; height of this layer drives the box height). -->
      <div class="prizes-content" class:ready bind:this={content} style="{stageH ? `height:${stageH}px;` : ''}--m:{P.scale}">
        {#snippet prizeImg(p, i)}
          <img
            class="prize"
            src="/assets/prize_{p.src}.png"
            alt={p.alt}
            use:jiggleImage={{ rot: p.r }}
            onmouseenter={(e) => showTip(p, e)}
            onmousemove={moveTip}
            onmouseleave={hideTip}
            style="left:{pos[i].x}px; top:{pos[i].y}px; max-width:calc({p.s}px * var(--scale) * var(--m)); max-height:calc({p.s}px * var(--scale) * var(--m)); --r:{p.r}deg;"
          />
        {/snippet}
        {#each prizes as p, i (p.src)}
          {#if p.src === 'shark'}
            <!-- the blahaj is a live 3D doodle (masquerading as a prize): at rest
                 it's the baked poster; hover it and it slowly turntable-spins.
                 Same widget as the EmailSignup shark, but mode="hoverspin". -->
            <a class="prize-link" href={p.href} target="_blank" rel="noopener" aria-label={p.alt}>
              <div
                class="prize prize-shark"
                role="img"
                aria-label={p.alt}
                onmouseenter={(e) => showTip(p, e)}
                onmousemove={moveTip}
                onmouseleave={hideTip}
                style="left:{pos[i].x}px; top:{pos[i].y}px; width:calc({p.s}px * var(--scale) * var(--m)); height:calc({p.s}px * 64 / 73 * var(--scale) * var(--m)); --r:{p.r}deg;"
              >
                <SharkPrize mode="hoverspin" poster="/assets/blahaj_prize.png" pose={{ rx: -19.08, ry: 100.50986217719377 }} />
              </div>
            </a>
          {:else if p.href}
            <a class="prize-link" href={p.href} target="_blank" rel="noopener" aria-label={p.alt}>{@render prizeImg(p, i)}</a>
          {:else}
            {@render prizeImg(p, i)}
          {/if}
        {/each}

        <!-- deemphasized note pinned to the bottom of the cluster (its space is
             reserved by `moreBand` in layout() so it sits below the prizes). -->
        <p class="prizes-more" aria-hidden="true">&hellip;and more!</p>
      </div>
    </div>

    <!-- caption under the box. Line 1 is always shown; line 2 is reserved space
         (kept in the layout but invisible) that reveals "that's a <prize>" on
         hover, so showing it never shifts the page. -->
    <div class="prizes-caption" style={capW ? `width:${capW}px` : ''}>
      <p class="txt prizes-cap-main">every jam, you can choose any prize from the pool, + stickers &amp; a custom patch for this month&rsquo;s jam</p>
      <p class="txt prizes-cap-hover" class:show={hoverName} aria-hidden="true">{#if hoverName}{#if hoverGame}<span class="cap-lead">that&rsquo;s an</span> <span class="cap-name" style="color:{hoverColor}">indie game</span><span class="cap-lead">, you can pick {GAME_PICK_COUNT}</span>{:else}<span class="cap-lead">{hoverLead}</span> <span class="cap-name" style="color:{hoverColor}">{hoverName}</span>{#if hoverNote}<span class="cap-lead">{hoverNote}</span>{/if}{/if}{:else}&nbsp;{/if}</p>
      <p class="txt cap-suggest">got a prize idea? <a href="https://forms.hackclub.com/jame-gam-prize-suggestion" target="_blank" rel="noopener">suggest one!</a></p>
    </div>
  </div>
</section>

<!-- prize tooltip (temporarily disabled — trying the caption line below the box
     instead). The hover state (hoverName) now drives .prizes-cap-hover. -->
<!-- {#if hoverName}
  <div class="prize-tip" style="left:{tip.x}px; top:{tip.y}px;">{hoverName}</div>
{/if} -->

<!-- live tuner — only when the page is opened with ?tune. Edit the scatter knobs
     in real time; "copy" puts a paste-ready params object on the clipboard so the
     chosen values can become the defaults in `let P = …`. Never shows in prod. -->
{#if tune}
  <div class="tuner">
    <strong>prizes title</strong>
    <label>size<input type="range" min="28" max="96" step="1" bind:value={titleSize} /><span>{titleSize}px</span></label>
    <strong>prize scatter</strong>
    <label>fill<input type="range" min="0.30" max="0.95" step="0.01" bind:value={P.fill} /><span>{P.fill.toFixed(2)}</span></label>
    <label>aspect<input type="range" min="0.80" max="3" step="0.05" bind:value={P.aspect} /><span>{P.aspect.toFixed(2)}</span></label>
    <label>space<input type="range" min="0.80" max="1.30" step="0.01" bind:value={P.space} /><span>{P.space.toFixed(2)}</span></label>
    <label>scale<input type="range" min="0.60" max="1.60" step="0.02" bind:value={P.scale} /><span>{P.scale.toFixed(2)}</span></label>
    <div class="tuner-row">
      <button type="button" onclick={() => (P.seed += 1)}>re-roll</button>
      <button type="button" onclick={copyParams}>copy</button>
    </div>
    <code>{paramStr}</code>
  </div>
{/if}

<style>
  .sec-prizes {
    padding-top: calc(70px * var(--scale));
    padding-bottom: calc(80px * var(--scale));
  }
  .prizes-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .prizes-title {
    position: relative;
    z-index: 3;                 /* sits in front of the box, in its top notch */
    /* FIXED px — NOT the responsive --scale token. The border's notch is a
       fixed-pixel piece (rainbowBorder NW=200, dip ≈128px wide), so the title
       must be fixed too, or the two drift apart as --scale steps per
       breakpoint. The value comes from `titleSize` (inline --prizes-title-size),
       tweakable live via the ?tune slider; 39px is the fallback default. */
    font-weight: normal;     /* it's an <h2>; keep the single-weight pixel look (no faux-bold) */
    font-size: var(--prizes-title-size, 39px);
    color: #4e4a48;
    line-height: 1.05;
    transform: translateY(2px);  /* follow the notch down (rainbowBorder NOTCH_DY=2) */
  }

  /* the box: WIDTH is set inline (stageW) by layout() — it tracks the column width
     and grows into the gutters on roomy screens (the EXTRA budget caps the growth),
     so there's NO CSS max-width to cap it (a CSS cap would override the inline width
     and let the prizes spill past the border). width:100% is just the pre-JS
     fallback before the first layout. HEIGHT is content-driven (stageH) so the box
     grows vertically; the border layer fills it and its ResizeObserver redraws the
     sketchy outline. It overflows .col symmetrically (centred by .prizes-inner);
     the page clips overflow-x, so the bleed never makes a scrollbar. */
  .prizes-box {
    position: relative;
    margin-top: calc(-28px * var(--scale));          /* rides up so the box's notched top overlaps "prizes" */
    width: 100%;
  }
  /* border layer fills the box (follows content height) and carries the ripple
     filter; the rainbow fill (.el-prizes_box) fills it in turn. */
  .box-ripple {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
  .el-prizes_box {
    width: 100%;
    height: 100%;
  }
  /* the prizes scattered INSIDE the border. Positioning context for the JS
     scatter; its height is set inline (the computed scatter height) which drives
     the box height. Padding keeps items off the sketchy edge (border ~8px in +
     ~13px thick; the notch dips ~37px at top-centre, hence the larger top pad).
     Hidden until the first layout so there's no top-left flash before JS runs. */
  .prizes-content {
    position: relative;
    z-index: 2;                                      /* above the border layer */
    min-height: calc(280px * var(--scale));          /* sensible border size pre-JS */
    /* top pad stays a bit larger to clear the title notch (dips ~37px); bottom &
       sides trimmed so the border hugs the prizes without dead space. */
    padding: calc(60px * var(--scale)) calc(46px * var(--scale)) calc(18px * var(--scale));
    box-sizing: border-box;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  .prizes-content.ready { opacity: 1; }
  /* a single piece of scattered loot. Sized to fit a --s×--s box (aspect kept);
     absolutely placed by its centre (translate -50%) at the JS-computed point,
     then tilted by --r. Colour grading + pixelation are baked into the PNGs. */
  .prize {
    position: absolute;
    width: auto;
    height: auto;
    transform: translate(-50%, -50%) rotate(var(--r, 0deg));
    transform-origin: center;
    opacity: 0.72;                       /* dimmed at rest, full on hover */
    transition: opacity 0.18s ease;
  }
  .prize:hover { opacity: 1; }
  /* link wrapper generates no box (display:contents) so the absolute scatter +
     jiggle are untouched; the cursor is inherited by the img inside. */
  .prize-link { display: contents; cursor: pointer; }

  /* caption under the box. Line 2 (.prizes-cap-hover) is always laid out (its
     space is reserved) but invisible until .show, so revealing it on hover never
     shifts the page; nowrap keeps it one line so the height never changes. */
  .prizes-caption {
    margin-top: calc(18px * var(--scale));
    text-align: center;
    line-height: 1.3;
    font-size: calc(var(--t-list) * 0.82);   /* match the how-it-works SUB text size */
  }
  .prizes-cap-main {
    color: #504b49;                    /* full ink, like the rest of the copy */
  }
  .prizes-cap-hover {
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  .prizes-cap-hover.show { opacity: 1; }
  .cap-lead { color: #504b49; opacity: 0.45; }   /* "that's a" — deemphasized */
  /* suggestion-form line: sits under the hover-reveal line with extra air.
     faded via color (not opacity) so the accent link inside stays full red */
  .cap-suggest {
    margin-top: calc(26px * var(--scale));
    color: rgba(80, 75, 73, 0.4);
  }
  .cap-name { /* colour set inline per prize accent */ }

  /* deemphasized "…more to come" pinned to the bottom inside the border */
  .prizes-more {
    position: absolute;
    left: 50%;
    bottom: calc(24px * var(--scale));
    transform: translateX(-50%);
    margin: 0;
    white-space: nowrap;
    font-family: 'augiepixel', sans-serif;
    font-size: calc(var(--t-list) * 0.82);   /* match the caption / how-it-works sub text */
    color: #504b49;
    opacity: 0.34;
  }

  /* hovered-prize tooltip — a paper sticker tag in the site's pixel font, tilted
     a hair for scrappiness, floating just above the cursor. (disabled for now) */
  .prize-tip {
    position: fixed;
    z-index: 60;                                       /* over the grain (50), under the tuner */
    transform: translate(-50%, calc(-100% - 14px)) rotate(-2.5deg);
    transform-origin: center bottom;
    pointer-events: none;
    white-space: nowrap;
    font-family: 'augiepixel', sans-serif;
    font-size: calc(22px * var(--scale));
    line-height: 1;
    color: #504b49;
    background: #fdfbf4;
    padding: calc(6px * var(--scale)) calc(13px * var(--scale)) calc(4px * var(--scale));
    border: 2px solid #504b49;
    border-radius: calc(7px * var(--scale));
    box-shadow: calc(2px * var(--scale)) calc(3px * var(--scale)) 0 rgba(80, 75, 73, 0.18);
  }

  /* ===== dev tuner (?tune only) — plain system UI, fixed overlay ===== */
  .tuner {
    position: fixed;
    top: 12px; right: 12px;
    z-index: 10000;
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    color: #222;
  }
  .tuner strong { font-size: 12px; letter-spacing: 0.02em; }
  .tuner label { display: grid; grid-template-columns: 48px 1fr 34px; align-items: center; gap: 6px; }
  .tuner input[type='range'] { width: 100%; cursor: pointer; }
  .tuner label span { text-align: right; font-variant-numeric: tabular-nums; color: #555; }
  .tuner-row { display: flex; gap: 6px; margin-top: 2px; }
  .tuner-row button {
    flex: 1; padding: 5px 0; cursor: pointer;
    border: 1px solid #bbb; border-radius: 5px; background: #f4f4f4; font: inherit;
  }
  .tuner-row button:hover { background: #e9e9e9; }
  .tuner code { font-size: 10px; color: #666; word-break: break-all; line-height: 1.3; }

  /* dynamic rainbow border (figma "Mask group"): a tiling rainbow texture
     clipped by a sketchy outline. the mask is rebuilt at runtime from 3 pulled
     pieces (straight edge, corner, notch) by use:rainbowBorder — see
     $lib/actions/rainbowBorder.js. */
  .rainbow-box {
    pointer-events: none;             /* decorative — don't block clicks */
    background-image: url('/assets/rainbow_texture.png');
    background-repeat: repeat;
    /* texture rendered 1:1 (each source pixel = 1 comp px) and anchored to the
       box's top-left, so its pixel grid coincides with the border mask's grid
       (also drawn from 0,0). bump to a multiple — e.g. 930px 604px = 2× — for
       chunkier blocks; stays aligned as long as it's an integer multiple. */
    background-size: calc(465px * var(--scale)) calc(302px * var(--scale));
    background-position: 0 0;
    image-rendering: pixelated;       /* crisp blocks, not bilinear-blurred */
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;  mask-size: 100% 100%;
    -webkit-mask-position: 0 0;    mask-position: 0 0;
  }
</style>
