/* ----------------------------------------------------------------------------
   Animated logo engine.

   Intro fly-in → assembles → shrinks into the top logo slot → stays live and
   reacts to the mouse (per-letter spring physics + colour grazes). Faithful
   port of the original site's logo IIFE; only the DOM plumbing changed:
     - elements (`stage`, `word`) are passed in (bound from Logo.svelte),
     - the page element is resolved via `stage.closest('#page')`,
     - the responsive fit/zoom comes from the shared viewport module,
     - showing/hiding the page is delegated to the `setBooting` callback instead
       of toggling a `.booting` class directly (Svelte owns that class now).

   After the intro the logo can be clicked to grow back to full screen (page
   fades out); clicking anywhere then shrinks it home again — the same big/small
   transition the boot uses, driven by a small mode machine.

   initLogo({ stage, word, setBooting }) -> cleanup()
   ---------------------------------------------------------------------------- */

import { fit, getZoom } from '$lib/viewport.js';

export function initLogo({ stage, word, setBooting }) {
  const SCALE = 1.22;                 // resting size ≈ 298px wide logo slot
  const SNAP = SCALE;
  const INK = [47, 43, 41];
  const PINK = [219, 149, 145];
  const PARTS = [
    { name: 'c00', x: 6, y: 24, w: 18, h: 24 },
    { name: 'c01', x: 8, y: 12, w: 8, h: 10, hitPad: 5 },
    { name: 'c02', x: 27, y: 25, w: 29, h: 17 },
    { name: 'c03', x: 58, y: 26, w: 32, h: 19 },
    { name: 'c04', x: 93, y: 21, w: 20, h: 26 },
    { name: 'c05', x: 129, y: 23, w: 24, h: 31 },
    { name: 'c06', x: 154, y: 23, w: 25, h: 17 },
    { name: 'c07', x: 181, y: 20, w: 29, h: 22 },
    { name: 'bhc_0', x: 128, y: 64, w: 12, h: 15, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_1', x: 139, y: 65, w: 10, h: 14, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_2', x: 154, y: 57, w: 13, h: 18, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_3', x: 167, y: 60, w: 12, h: 11, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_4', x: 178, y: 57, w: 11, h: 11, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_5', x: 188, y: 51, w: 13, h: 15, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_6', x: 206, y: 51, w: 11, h: 12, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_7', x: 216, y: 47, w: 5, h: 14, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_8', x: 221, y: 49, w: 11, h: 9, base: PINK, hitPad: 2, byline: true },
    { name: 'bhc_9', x: 232, y: 42, w: 12, h: 16, base: PINK, hitPad: 2, byline: true },
  ];

  const PALETTE_RGB = ['#91a4db', '#97db91', '#db9591', '#dbaf91', '#dbd991', '#b991db']
    .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  let lastIdx = -1;
  function pickColor(ex) {
    let i, c;
    do { i = (Math.random() * PALETTE_RGB.length) | 0; c = PALETTE_RGB[i]; }
    while ((i === lastIdx || (ex && c[0] === ex[0] && c[1] === ex[1] && c[2] === ex[2])) && PALETTE_RGB.length > 1);
    lastIdx = i; return c;
  }

  const page = stage.closest('#page');
  // boot vignette overlay (lives in app.html, painted before any JS). Faded out
  // the moment the fly-in begins so the load gap reads as a staged reveal.
  const vignette = document.getElementById('boot-vignette');
  const liftVignette = () => { if (vignette) vignette.style.opacity = '0'; };
  word.style.width = (244 * SCALE) + 'px';
  word.style.height = (79 * SCALE) + 'px';

  // The stage is an absolute overlay; its resting spot tracks #logo-slot, a
  // transparent flow placeholder the Hero reserves in its centre column. This
  // keeps the logo centred and correctly placed as the layout reflows, instead
  // of pinning it to a fixed canvas coordinate.
  const slot = () => document.getElementById('logo-slot');
  function placeStage() {
    const s = slot();
    if (!s) return;
    const pr = page.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    // centre the logo (word width) horizontally over the slot, align tops
    stage.style.left = (sr.left - pr.left + (sr.width - word.offsetWidth) / 2) + 'px';
    stage.style.top = (sr.top - pr.top) + 'px';
  }
  placeStage();

  const items = PARTS.map((P) => {
    const base = P.base || INK;
    const el = document.createElement('div');
    el.className = 'letter';
    el.style.width = (P.w * SCALE) + 'px';
    el.style.height = (P.h * SCALE) + 'px';
    el.style.left = (P.x * SCALE) + 'px';
    el.style.top = (P.y * SCALE) + 'px';
    const url = `url("/letters/${P.name}.png")`;
    el.style.webkitMaskImage = url; el.style.maskImage = url;
    el.style.backgroundColor = `rgb(${base[0]},${base[1]},${base[2]})`;
    el.style.zIndex = P.byline ? '0' : '1';
    word.appendChild(el);
    return {
      el, restX: P.x * SCALE, restY: P.y * SCALE, w: P.w * SCALE, h: P.h * SCALE,
      hitPad: (P.hitPad || 0) * SCALE, x: 0, y: 0, vx: 0, vy: 0,
      base, r: base[0], g: base[1], b: base[2],
      armed: true, grazeColor: null, grazePeak: 0,
      lastTx: 0, lastTy: 0, lastColor: `rgb(${base[0]},${base[1]},${base[2]})`, lastOp: 1,
      byline: !!P.byline, moveScale: P.byline ? 0.08 : 1, colorOn: !P.byline,
    };
  });

  // prefers-reduced-motion: render the logo at rest in its slot right away —
  // skip the fly-in, the boot enlargement, and the live mouse physics — and
  // reveal the page. The letters are already placed at their rest positions
  // (and the byline is fully opaque), so there's nothing to animate.
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    placeStage();
    liftVignette();
    setBooting && setBooting(false);
    const onResizeStatic = () => placeStage();
    window.addEventListener('resize', onResizeStatic);
    return function cleanup() { window.removeEventListener('resize', onResizeStatic); };
  }

  // intro fly-in setup
  const dir = items.map((_, i) => i);
  for (let i = dir.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [dir[i], dir[j]] = [dir[j], dir[i]]; }
  const FLY = Math.max(window.innerWidth, window.innerHeight) * 0.7;
  items.forEach((it, i) => {
    if (it.byline) { it.intro = false; return; }
    const ang = (dir[i] / items.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    it.x = Math.cos(ang) * FLY; it.y = Math.sin(ang) * FLY;
    it.intro = true; it.introDelay = i * 34 + Math.random() * 18;
    const tx = Math.round(it.x / SNAP) * SNAP, ty = Math.round(it.y / SNAP) * SNAP;
    it.el.style.transform = `translate3d(${tx}px,${ty}px,0)`; it.lastTx = tx; it.lastTy = ty;
  });
  const lastRelease = Math.max(...items.filter((x) => !x.byline).map((x) => x.introDelay));

  let bylineStart = null;
  items.filter((it) => it.byline).forEach((it, bi) => { it.ent = true; it.entDelay = bi * 22; it.el.style.opacity = '0'; it.lastOp = 0; });

  // ---- big/small machine -------------------------------------------------
  // The logo lives at one of: 'boot' (initial fly-in, big, non-interactive),
  // 'small' (shrunk into the slot, mouse-interactive), 'big' (clicked back to
  // full screen, page faded out), or 'transitioning' (mid-tween, clicks ignored).
  let mode = 'boot';
  // The logo's current visual scale, fed into the interactive physics so the
  // mouse response stays correct at any size: 1 when shrunk into the slot, the
  // big factor `k` when grown to full screen. (Interaction is off mid-tween.)
  let curScale = 1;
  let bigK = 1;                                         // most recent computed big-scale factor

  // The "big, centred over the viewport" transform, always measured from the
  // resting (identity) state so it's correct no matter the current transform —
  // important for resizes while big and for the click-to-grow tween.
  function computeBig() {
    fit();
    const ZOOM = getZoom();
    stage.style.transition = 'none';
    stage.style.transform = '';                         // measure at rest (forces reflow below)
    const r = stage.getBoundingClientRect();
    const bigW = Math.min(window.innerWidth * 0.6, 760);
    const k = bigW / r.width;
    bigK = k;
    const dx = (window.innerWidth / 2 - (r.left + r.width / 2)) / ZOOM;
    const dy = (window.innerHeight / 2 - (r.top + r.height / 2)) / ZOOM;
    return `translate(${dx}px, ${dy}px) scale(${k})`;
  }

  // ---- boot: enlarge + center logo over the viewport (no animation) ----
  function enterBoot() {
    const t = computeBig();
    stage.style.transition = 'none';
    stage.style.transform = t;
    document.body.style.overflow = 'hidden';
  }
  enterBoot();
  const onResize = () => {
    placeStage();                                       // keep resting spot glued to the slot
    if (mode === 'boot' || mode === 'big') { enterBoot(); if (mode === 'big') curScale = bigK; }
  };
  window.addEventListener('resize', onResize);

  const SHRINK = 'transform .8s cubic-bezier(.6,0,.2,1)';

  // grow the small logo back to full screen, fading the page out
  function expand() {
    if (mode !== 'small') return;
    mode = 'transitioning';
    live = false;                                       // freeze mouse physics during the tween
    const t = computeBig();                             // commits identity (reflow) + sets bigK, then we tween to big
    stage.style.transition = SHRINK;
    stage.style.transform = t;
    document.body.style.overflow = 'hidden';
    setBooting && setBooting(true);                     // fade the rest of the page out
    stage.addEventListener('transitionend', () => {
      mode = 'big';
      curScale = bigK;                                  // physics now reads the big size
      live = true;                                      // interactive at full screen, like the playground
    }, { once: true });
  }

  // shrink the logo home into the slot, fading the page back in
  function collapse() {
    if (mode !== 'big') return;                         // release() flips mode to 'big' before calling in
    mode = 'transitioning';
    live = false;                                       // freeze mouse physics during the tween
    placeStage();                                       // re-glue the resting spot to the slot
    // The slot can shift down while the logo flies in (the augiepixel font and
    // hero content settle after first paint). placeStage() just moved the stage
    // box, but the big transform still on it was calibrated for the OLD box — so
    // without this the logo teleports by the layout delta before shrinking.
    // Re-pin the centred-big transform to the re-placed box (same pattern as
    // expand()), then tween home from there with no jump.
    stage.style.transform = computeBig();               // commits identity + remeasures; transition already 'none'
    void stage.offsetWidth;                             // flush so SHRINK animates from this point
    stage.style.transition = SHRINK;
    stage.style.transform = '';
    setTimeout(() => setBooting && setBooting(false), 600);  // fade page in near the end (no overlap)
    stage.addEventListener('transitionend', () => {
      document.body.style.overflow = '';
      mode = 'small';
      curScale = 1;                                     // physics back to the small resting size
      live = true;                                      // re-enable mouse interaction
    }, { once: true });
  }

  // click the logo (small) → grow; click anywhere (big) → shrink
  word.style.pointerEvents = 'auto';
  word.style.cursor = "url('/cursor-pointer.png?v=3') 2 2, pointer";  // match the site's custom pointer cursor
  const onWordClick = (e) => { if (mode === 'small') { e.stopPropagation(); expand(); } };
  word.addEventListener('click', onWordClick);
  const onDocClick = () => { if (mode === 'big') collapse(); };
  window.addEventListener('click', onDocClick);

  // physics constants
  const K = 320, DAMP = 12, IK = 190, IDAMP = 21, COLOR_DECAY = 2.6, MAX_V = 4500;
  const R_OUTER = 110, PROX = 0.26;
  // MS scales the mouse response to the logo's *displayed* size: SCALE*4 (the
  // playground's resting scale) ⇒ full strength. Computed per-frame from
  // curScale so the small logo stays gentle while the grown one hits like the
  // playground. See its use below.
  // timing
  const START_DELAY = 350;       // pause before the fly-in begins
  const HOLD = 0;                // start shrinking immediately once assembled
  let settledAt = null;

  const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false };
  function onMove(ev) { mouse.x = ev.clientX; mouse.y = ev.clientY; if (!mouse.active) { mouse.px = mouse.x; mouse.py = mouse.y; mouse.active = true; } }
  window.addEventListener('mousemove', onMove, { passive: true });
  const onLeave = () => { mouse.active = false; mouse.x = mouse.y = -9999; };
  window.addEventListener('mouseleave', onLeave);
  const onTouch = (e) => { const t = e.touches[0]; if (t) onMove({ clientX: t.clientX, clientY: t.clientY }); };
  window.addEventListener('touchmove', onTouch, { passive: true });

  function pointIn(px, py, rx, ry, rw, rh) { return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh; }
  function distPtRect(px, py, rx, ry, rw, rh) { const dx = Math.max(rx - px, 0, px - (rx + rw)), dy = Math.max(ry - py, 0, py - (ry + rh)); return Math.hypot(dx, dy); }
  function distSegRect(p0x, p0y, p1x, p1y, rx, ry, rw, rh) {
    let mm = Math.min(distPtRect(p0x, p0y, rx, ry, rw, rh), distPtRect(p1x, p1y, rx, ry, rw, rh)); if (mm === 0) return 0;
    const dx = p1x - p0x, dy = p1y - p0y, len = Math.hypot(dx, dy); if (len < 1) return mm;
    const steps = Math.min(16, Math.max(2, Math.ceil(len / 8)));
    for (let i = 1; i < steps; i++) { const t = i / steps, d = distPtRect(p0x + dx * t, p0y + dy * t, rx, ry, rw, rh); if (d < mm) mm = d; if (mm === 0) return 0; }
    return mm;
  }

  let live = false, handed = false, introT0 = null, last = performance.now();
  let rafId = 0;
  let vignetteLifted = false;            // boot vignette fades once the fly-in starts

  function release() {
    handed = true;
    mode = 'big';                               // boot just finished assembling, big → shrink it home
    collapse();                                 // shrink into the slot + reveal the page (shared path)
  }

  function frame(now) {
    let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
    const ZOOM = getZoom();
    // local→screen scale (page zoom × the logo's own visual scale) and the
    // size-aware mouse-response multiplier; both track curScale so the grown
    // logo reacts like the playground and the shrunk one stays subtle.
    const S = ZOOM * curScale;
    const MS = (SCALE * curScale) / 4;
    if (introT0 === null) introT0 = now;
    const elapsed = now - introT0;
    // lift the vignette exactly as the first letters are released into flight
    if (!vignetteLifted && elapsed >= START_DELAY) { vignetteLifted = true; liftVignette(); }
    if (bylineStart === null && elapsed >= lastRelease + START_DELAY + 120) bylineStart = now;

    if (mouse.active && live) {
      mouse.vx = (mouse.x - mouse.px) / Math.max(dt, 1 / 240);
      mouse.vy = (mouse.y - mouse.py) / Math.max(dt, 1 / 240);
    } else { mouse.vx = 0; mouse.vy = 0; }

    const orig = word.getBoundingClientRect();   // viewport top-left of word
    let allSettled = true;

    for (const it of items) {
      if (it.ent) {
        allSettled = false;
        if (bylineStart !== null) {
          const t = now - bylineStart - it.entDelay;
          if (t >= 0) {
            const p = Math.min(1, t / 150); it.y = (1 - p) * 2 * SNAP;
            if (p !== it.lastOp) { it.el.style.opacity = p.toFixed(3); it.lastOp = p; }
            if (p >= 1) { it.ent = false; it.y = 0; }
          } else allSettled = false;
        }
      } else if (it.intro) {
        allSettled = false;
        if (elapsed >= it.introDelay + START_DELAY) {
          const ax = -IK * it.x - IDAMP * it.vx, ay = -IK * it.y - IDAMP * it.vy;
          it.vx += ax * dt; it.vy += ay * dt; it.x += it.vx * dt; it.y += it.vy * dt;
          if (Math.hypot(it.x, it.y) < SNAP * 1.2 && Math.hypot(it.vx, it.vy) < 60) { it.intro = false; it.x = 0; it.y = 0; }
        }
      } else if (live) {
        // ---- interactive physics (viewport geometry = local * S) ----
        const pad = it.hitPad;
        const rx = orig.x + (it.restX + it.x - pad) * S, ry = orig.y + (it.restY + it.y - pad) * S;
        const rw = (it.w + pad * 2) * S, rh = (it.h + pad * 2) * S;
        let inside = false, crossed = false, dist = Infinity;
        if (mouse.active) {
          inside = pointIn(mouse.x, mouse.y, rx, ry, rw, rh);
          if (inside) dist = 0;
          else { dist = distSegRect(mouse.px, mouse.py, mouse.x, mouse.y, rx, ry, rw, rh); crossed = (dist === 0); }
        }
        if (mouse.active && dist < R_OUTER) {
          const tt = 1 - dist / R_OUTER, falloff = tt * tt;
          it.vx += (mouse.vx / S) * PROX * falloff * it.moveScale * MS;
          it.vy += (mouse.vy / S) * PROX * falloff * it.moveScale * MS;
          const vmax = MAX_V * MS, v = Math.hypot(it.vx, it.vy); if (v > vmax) { it.vx = it.vx / v * vmax; it.vy = it.vy / v * vmax; }
          if (it.colorOn) {
            if (it.grazeColor === null) { it.grazeColor = pickColor(it.base); it.grazePeak = 0; }
            const mspd = Math.hypot(mouse.vx, mouse.vy), s = falloff * Math.min(1, mspd / 500);
            if (s > it.grazePeak) {
              it.grazePeak = s; const [gr, gg, gb] = it.grazeColor;
              it.r = it.base[0] + (gr - it.base[0]) * s; it.g = it.base[1] + (gg - it.base[1]) * s; it.b = it.base[2] + (gb - it.base[2]) * s;
            }
          }
        } else { it.grazeColor = null; it.grazePeak = 0; }
        if (it.armed && (inside || crossed)) {
          if (it.colorOn) { const [r, g, b] = pickColor(it.base); it.r = r; it.g = g; it.b = b; it.grazePeak = 1; }
          it.armed = false;
        }
        if (!inside && !crossed) it.armed = true;
        const ax = -K * it.x - DAMP * it.vx, ay = -K * it.y - DAMP * it.vy;
        it.vx += ax * dt; it.vy += ay * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      }

      // color fade back to rest
      const kf = 1 - Math.exp(-COLOR_DECAY * dt);
      it.r += (it.base[0] - it.r) * kf; it.g += (it.base[1] - it.g) * kf; it.b += (it.base[2] - it.b) * kf;

      const tx = Math.round(it.x / SNAP) * SNAP, ty = Math.round(it.y / SNAP) * SNAP;
      if (tx !== it.lastTx || ty !== it.lastTy) { it.el.style.transform = `translate3d(${tx}px,${ty}px,0)`; it.lastTx = tx; it.lastTy = ty; }
      const cr = Math.round(it.r), cg = Math.round(it.g), cb = Math.round(it.b), col = `rgb(${cr},${cg},${cb})`;
      if (col !== it.lastColor) { it.el.style.backgroundColor = col; it.lastColor = col; }
    }

    if (allSettled) { if (settledAt === null) settledAt = now; } else settledAt = null;
    if (!handed && settledAt !== null && (now - settledAt) >= HOLD) release();

    mouse.px = mouse.x; mouse.py = mouse.y;
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame((t) => { last = t; frame(t); });

  // cleanup for HMR / unmount
  return function cleanup() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('touchmove', onTouch);
    window.removeEventListener('click', onDocClick);
    word.removeEventListener('click', onWordClick);
    document.body.style.overflow = '';
  };
}
