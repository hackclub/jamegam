/* ----------------------------------------------------------------------------
   rainbowUnderline — the hand-drawn rainbow scribble under "prizes", drawn live.

   Usage:  <span class="jw jw-prizes" use:rainbowUnderline>…letter spans…</span>
           <span ... use:rainbowUnderline={{ seed: 7, chunk: 2, smooth: false }}>…</span>

   Replaces the baked email_line538.png with a canvas the same rainbow_texture
   slice, masked by a procedural squiggle. Two properties:

   1. SHAPE — the resting line IS the original's reverse-engineered centerline
      (the hook under "p", plateau, gentle rise), mapped onto the word's bottom
      band exactly where the old background sat. On top of that, each letter adds
      a DISPLACEMENT: when a letter is nudged down (jiggle physics, or moved in
      the design) the line curves down to make space under it, then returns to the
      resting shape. So at rest it matches today; when letters move it follows.

   2. RENDERING — drawn into a canvas and scaled by an integer factor so the pixel
      grid stays crisp (no jagged non-integer nearest-neighbour scaling). `chunk`
      is device-px per art-pixel (bigger = chunkier pixel art); `smooth:true`
      renders at full device resolution with no thresholding (soft, like the
      original's bilinear-scaled bitmap) for comparison.

   A light rAF watches the letters and redraws only when something actually moved.
   ---------------------------------------------------------------------------- */

import { sampleCenterline, NATIVE_H, NATIVE_W } from '$lib/squiggle.js';

// tiny seeded PRNG for the hand-drawn wobble (kept low-frequency on purpose).
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEX_SRC = '/assets/rainbow_texture.png';
const WIN = { x: 2, w: 203, y: 3, h: 11 };   // rainbow_texture slice (red→purple)
const BRUSH = 4;                               // brush diameter, art px (the original ≈4px line)
const WOBBLE_CSS = 0.26;                       // hand-drawn jitter amplitude (css px)
const WOBBLE_N = 12;                            // control points → wobble frequency (fewer = longer, gentler waves)
const EXTRA = 3;                               // extra gap below the original hand-drawn resting position (css px)
const REACT_UP = 6;                            // how far the line follows a letter that bobs UP (css px) — small, stays near the text
const REACT_DOWN = 34;                         // how far it dips to follow a letter pushed DOWN (css px)
const SIGMA_F = 0.45;                          // reaction spread as a fraction of letter pitch (tighter = each letter pulls its own stretch more)

// the brush footprint: pixel offsets covered by a round brush of `diam` px =
// a square with the corners removed (e.g. 4×4 minus 4 corners). Stamped HARD (no
// anti-aliasing) at integer positions, so every stamp is identical → the stroke
// is always ≥ the diameter thick and grows thicker, never thinner, at turns.
function buildBrush(diam) {
  const r = diam / 2;
  const c = diam % 2 === 0 ? 0.5 : 0;          // even diameters centre between pixels
  const R = Math.ceil(r);
  const off = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if ((dx + c) * (dx + c) + (dy + c) * (dy + c) <= r * r + 1e-6) off.push([dx, dy]);
    }
  }
  return off;
}

let texImg = null, texPromise = null;
function loadTexture() {
  if (texPromise) return texPromise;
  texPromise = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => { texImg = im; resolve(im); };
    im.src = TEX_SRC;
  });
  return texPromise;
}

function letterEls(word, sel) {
  const found = word.querySelectorAll(sel);
  if (found.length) return [...found];
  return [...word.children].filter((c) => c.tagName !== 'CANVAS' && (c.textContent || '').trim().length === 1);
}

// font metrics for the active font (cached): ink ascent/descent from the baseline.
function fontMetrics(font) {
  const c = (fontMetrics._c ||= document.createElement('canvas').getContext('2d'));
  c.font = font;
  const m = c.measureText('Hxgpq');
  return { asc: m.fontBoundingBoxAscent || 0, desc: m.fontBoundingBoxDescent || 0 };
}

function draw(word, canvas, opts) {
  if (!texImg) return;
  const els = letterEls(word, opts.letters || '.jc');
  if (!els.length) return;
  const wr = word.getBoundingClientRect();
  if (!wr.width || !wr.height) return;

  const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
  const art = Math.max(1, opts.art || 1);
  const f = (1 / scale) / art;                  // css px → art px (the original's pixel grid)
  const brushD = opts.brush ?? BRUSH;           // per-word thickness (art px) for bigger type
  const radius = Math.max(2, Math.round(brushD / art)) / 2;

  // baseline position inside each letter box, from font metrics
  const cs = getComputedStyle(els[0]);
  const fm = fontMetrics(`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`);
  const lh = parseFloat(cs.lineHeight) || (fm.asc + fm.desc);
  const baseTop = (lh - (fm.asc + fm.desc)) / 2 + fm.asc;   // box top → baseline (css)

  // each letter's current centre-x (rel word) and its vertical displacement from
  // rest = its transform translateY (negative up, positive down).
  const tyOf = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    try { return new DOMMatrixReadOnly(t).m42; } catch { return 0; }
  };
  const L = els.map((el) => {
    const r = el.getBoundingClientRect();
    return { cx: (r.left + r.right) / 2 - wr.left, top: r.top - wr.top, dy: tyOf(el) };
  });
  let restMaxBaseCss = 0;
  for (const it of L) restMaxBaseCss = Math.max(restMaxBaseCss, (it.top - it.dy) + baseTop);

  // optionally extend the line past the word's LEFT edge (comp px → css, scaled).
  // Used by no-hook words like "ready?" so the line reaches to / just past the
  // first letter — the hook used to provide that reach for "prizes".
  const extendCss = (opts.extendLeft || 0) * scale;

  // canvas: word width (+ left extension) × tall enough for the resting hook + the
  // reaction dip. Sized from the REST layout so the backing doesn't resize as
  // letters bounce.
  const heightCss = restMaxBaseCss + fm.desc + EXTRA + REACT_DOWN + 12;
  const widthCss = wr.width + extendCss;
  const bw = Math.max(1, Math.round(widthCss * f));
  const bh = Math.max(1, Math.round(heightCss * f));
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  canvas.style.height = heightCss.toFixed(1) + 'px';
  // when extended, shift the canvas left so word-space x=0 still sits at the word's
  // left edge; otherwise fall back to the CSS default (left:0; width:100%).
  canvas.style.left = extendCss ? `${(-extendCss).toFixed(1)}px` : '';
  canvas.style.width = extendCss ? `${widthCss.toFixed(1)}px` : '';
  canvas.style.imageRendering = 'pixelated';

  // REACTION: every letter pulls the stretch of line near it, blended smoothly
  // (Gaussian-weighted by the letter's live centre). So the WHOLE line jiggles
  // with the letters — none of it stays static — and it tracks a letter's x too.
  const sigma = Math.max(6, (wr.width / els.length) * SIGMA_F);
  const dispAt = (xc) => {
    let sw = 0, sv = 0;
    for (const it of L) { const d = (xc - it.cx) / sigma; const w = Math.exp(-d * d); sw += w; sv += w * it.dy; }
    const v = sw > 1e-6 ? sv / sw : 0;
    return Math.max(-REACT_UP, Math.min(REACT_DOWN, v));
  };

  // low-frequency hand-drawn wobble (a few seeded nodes, smoothstep-interpolated,
  // pinned to 0 at the ends so the caps stay clean).
  const rnd = mulberry32(Math.imul(opts.seed ?? 1, 2654435761) >>> 0);
  const wn = [];
  for (let i = 0; i <= WOBBLE_N; i++) wn.push(i === 0 || i === WOBBLE_N ? 0 : rnd() * 2 - 1);
  const wobAt = (t) => {
    const u = Math.min(0.99999, Math.max(0, t)) * WOBBLE_N;
    const i = Math.floor(u), fr = u - i, s = fr * fr * (3 - 2 * fr);
    return (wn[i] * (1 - s) + wn[i + 1] * s) * WOBBLE_CSS;
  };

  // the drawn line (built in css, then → art): the designed hand-drawn shape (hook
  // + slight curve) + the live reaction + the gentle wobble. Sampled densely so the
  // hook's hard corner survives.
  // resting shape: the reverse-engineered "prizes" centerline (start hook,
  // plateau, gentle rise). With opts.noHook we map the word onto the centerline
  // PAST the hook (native x≈HOOK_END→end) — keeping the plateau + gentle rightward
  // climb (and its mild undulation), just without the big left bump "prizes" has
  // under its "p". For words like "ready?" that don't sit on one tall descender.
  const HOOK_END = 27;   // native-px: where the start hook settles onto the plateau
  const centerline = opts.noHook
    ? (frac) => sampleCenterline((HOOK_END + frac * (NATIVE_W - HOOK_END)) / NATIVE_W)
    : (frac) => sampleCenterline(frac);

  const insetCss = (radius + 0.5) / f;
  // word-space x runs from -extendCss (past the left edge) to the inset right end;
  // pixel x is shifted right by extendCss so word-space 0 lands at the word's left.
  const pts = [];
  for (let xc = insetCss - extendCss; xc <= wr.width - insetCss + 1e-6; xc += 1.2) {
    const x = Math.min(wr.width - insetCss, xc);
    const designed = wr.height + (centerline(x / wr.width) - NATIVE_H) * scale + EXTRA;
    const y = designed + dispAt(x) + wobAt(x / wr.width);
    pts.push([(x + extendCss) * f, y * f]);
  }

  // rainbow fill + hard brush stamp (crisp pixels, rounded cut-corner ends)
  const ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, bw, bh);
  ctx.drawImage(texImg, WIN.x, WIN.y, WIN.w, WIN.h, 0, 0, bw, bh);
  const img = ctx.getImageData(0, 0, bw, bh);
  const data = img.data;
  const brush = buildBrush(Math.max(2, Math.round(brushD / art)));
  const mask = new Uint8Array(bw * bh);
  const stamp = (cx, cy) => {
    const ix = Math.round(cx), iy = Math.round(cy);
    for (let b = 0; b < brush.length; b++) {
      const x = ix + brush[b][0], y = iy + brush[b][1];
      if (x >= 0 && x < bw && y >= 0 && y < bh) mask[y * bw + x] = 1;
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.4));
    for (let s = 0; s <= n; s++) stamp(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n);
  }
  for (let i = 0; i < mask.length; i++) data[i * 4 + 3] = mask[i] ? 255 : 0;
  ctx.putImageData(img, 0, 0);
}

function signature(word, sel) {
  const wr = word.getBoundingClientRect();
  let s = Math.round(wr.width) + 'x' + Math.round(wr.height) + ':';
  for (const el of letterEls(word, sel)) {
    const r = el.getBoundingClientRect();
    s += `${Math.round((r.top - wr.top) * 4)},${Math.round((r.left - wr.left) * 4)};`;
  }
  return s;
}

/** Svelte action: paint the dynamic rainbow underline. */
export function rainbowUnderline(word, options = {}) {
  let opts = options;
  if (getComputedStyle(word).position === 'static') word.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.className = 'jw-ul';
  canvas.setAttribute('aria-hidden', 'true');
  word.insertBefore(canvas, word.firstChild);

  let last = '';
  const redraw = () => { last = signature(word, opts.letters || '.jc'); draw(word, canvas, opts); };

  let raf = 0;
  const tick = () => {
    const sig = signature(word, opts.letters || '.jc');
    if (sig !== last) { last = sig; draw(word, canvas, opts); }
    raf = requestAnimationFrame(tick);
  };

  loadTexture().then(() => {
    redraw();
    if (opts.live !== false) raf = requestAnimationFrame(tick);
  });
  if (document.fonts?.ready) document.fonts.ready.then(redraw);

  return {
    update(next = {}) { opts = next; redraw(); },
    destroy() { cancelAnimationFrame(raf); canvas.remove(); }
  };
}
