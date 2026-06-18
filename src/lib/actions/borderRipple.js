/* ----------------------------------------------------------------------------
   borderRipple — poke the rainbow border locally, only where the cursor crosses
   it, then spring back with a wiggle that matches the hero text's jiggle.

   SVG `filter` can't be confined to a sub-region on an HTML element (the
   displacement always leaks to the whole border), so — like the prizes underline
   — we draw the border into a canvas ourselves and warp it:

     1. Reproduce the masked border in an offscreen canvas: tile rainbow_texture.png
        (matching the CSS background) and clip it with the very mask rainbowBorder
        built (read off the box). The mask SVG is re-sized to device pixels first so
        it rasterises crisply instead of being upscaled (that upscale left 1–2px
        seams at the piece junctions). Hide the DOM border; show the canvas.
     2. Each crossing drops/feeds a local "dent" — a 2D spring (offset + velocity,
        rest = 0) using the SAME stiffness/damping as the hero text (jiggle.js), so
        it snaps back at the same rate. Impulses ADD velocity in the mouse-movement
        direction, so re-crossing the same spot builds up instead of flipping/
        flashing. Dents are independent (a small pool), so different spots wiggle on
        their own. Each is centred on the nearest point of the border to the cursor.
     3. Each frame we draw the border and resample a disc under each dent by the sum
        of the dents' offsets (radial falloff). Offsets are capped under RADIUS/2 so
        the warp can never fold the line back on itself (no doubled-up strand).

   Usage:  <div use:borderRipple><div use:rainbowBorder ...></div></div>
   ---------------------------------------------------------------------------- */

const TEX_SRC = '/assets/rainbow_texture.png';
const TILE_W = 465, TILE_H = 302;   // rainbow_texture native size (drawn at ×--scale)

let texImg = null, texPromise = null;
function loadTexture() {
  if (texPromise) return texPromise;
  texPromise = new Promise((res) => { const im = new Image(); im.onload = () => { texImg = im; res(im); }; im.src = TEX_SRC; });
  return texPromise;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// nearest point on an axis-aligned rectangle's OUTLINE to (mx,my). Lets a dent sit
// on the border line wherever the cursor crosses it, instead of floating at the cursor.
function nearestOnBorder(mx, my, L, T, R, B) {
  const cands = [
    { x: clamp(mx, L, R), y: T }, // top
    { x: clamp(mx, L, R), y: B }, // bottom
    { x: L, y: clamp(my, T, B) }, // left
    { x: R, y: clamp(my, T, B) }  // right
  ];
  let best = cands[0], bd = Infinity;
  for (const c of cands) { const d = Math.hypot(mx - c.x, my - c.y); if (d < bd) { bd = d; best = c; } }
  best.dist = bd;
  return best;
}

export function borderRipple(node, options = {}) {
  const o = options;
  // spring — matched to the hero text (jiggle.js: K=320, DAMP=12) so it snaps back
  // at the same rate; impulse a touch stronger for a more tactile border poke.
  const K = o.k ?? 440;            // stiffness (stiffer/snappier than the hero text)
  const DAMP = o.damp ?? 15;       // damping (scaled with K so it doesn't get floppier)
  const IMPULSE = o.impulse ?? 0.044; // mouse-velocity → dent velocity (smaller, subtler push)
  const REACH = o.reach ?? 60;     // engage within this of the border line (css px)
  const RWARP = o.radius ?? 200;   // dent disc radius (css px) — ripple reaches far down the border
  const MAXOFF = o.maxOff ?? RWARP * 0.13; // per-dent cap (~26px peak — smaller); big reach kept via RWARP
  const MERGE = o.merge ?? 85;     // re-cross within this of a dent → feed it (a wiggle builds one broad dent)
  const MAX_DENTS = o.maxDents ?? 5;
  const MARGIN = Math.ceil(MAXOFF + 12); // canvas overhangs the box this far (css px) so an outward poke isn't clipped

  const box = node.querySelector('.el-prizes_box') || node.firstElementChild;
  if (!box) return {};
  if (getComputedStyle(node).position === 'static') node.style.position = 'relative';

  // guard against HMR re-init leaving a stale overlay (would read as "two borders")
  node.querySelectorAll(':scope > canvas[aria-hidden="true"]').forEach((c) => c.remove());

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `position:absolute;left:${-MARGIN}px;top:${-MARGIN}px;width:calc(100% + ${2 * MARGIN}px);height:calc(100% + ${2 * MARGIN}px);image-rendering:pixelated;pointer-events:none`;
  node.appendChild(canvas);

  const src = document.createElement('canvas');
  let srcData = null, maskImg = null, lastMask = '', ready = false;

  function rebuild() {
    if (!texImg || !maskImg) return;
    const W = Math.round(box.clientWidth), H = Math.round(box.clientHeight);
    if (!W || !H) return;
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
    // Render at the pixel-art's NATIVE resolution (1 canvas px = 1 texture source
    // px). CSS then upscales the canvas with image-rendering:pixelated, so the
    // warp quantises to the art grid — the whole border (warp included) stays
    // chunky pixel-art instead of smoothly resampled. Bonus: far fewer pixels to
    // warp each frame than device resolution.
    const Ma = Math.round(MARGIN / scale);                     // overhang in art px
    const bw = Math.max(1, Math.round(W / scale)), bh = Math.max(1, Math.round(H / scale)); // box at art res
    const nw = bw + 2 * Ma, nh = bh + 2 * Ma;                  // full canvas (box + overhang on every side)
    src.width = nw; src.height = nh;
    const c = src.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, nw, nh);
    // tile the rainbow so a tile origin lands at the box origin (Ma,Ma) — same
    // phase as the CSS background, so the rest border still lines up exactly.
    const px0 = (((Ma % TILE_W) + TILE_W) % TILE_W) - TILE_W;
    const py0 = (((Ma % TILE_H) + TILE_H) % TILE_H) - TILE_H;
    for (let y = py0; y < nh; y += TILE_H) for (let x = px0; x < nw; x += TILE_W) c.drawImage(texImg, x, y, TILE_W, TILE_H);
    c.globalCompositeOperation = 'destination-in';             // clip to the sketchy outline (drawn at the box position)
    c.drawImage(maskImg, Ma, Ma, bw, bh);
    c.globalCompositeOperation = 'source-over';
    srcData = c.getImageData(0, 0, nw, nh);
    canvas.width = nw; canvas.height = nh;
    box.style.visibility = 'hidden';                           // hide the DOM border; canvas shows it
    ready = true;
    canvas.getContext('2d').drawImage(src, 0, 0);
  }

  // read the mask rainbowBorder set on the box (a self-contained data-URI svg) and
  // load it as an image, re-sized to the pixel-art NATIVE resolution (1/scale) so
  // it rasterises on the same grid the canvas renders at — the border shape stays
  // chunky pixel-art to match the texture.
  function syncMask() {
    const mi = box.style.maskImage || box.style.webkitMaskImage || '';
    // anchor on the closing quote — encodeURIComponent leaves literal "(" / ")"
    // in the data-URI, so a non-greedy [^"]+? would truncate at the first ")".
    const match = mi.match(/url\(\s*"(data:[^"]+)"\s*\)/);
    if (!match) return;
    if (match[1] === lastMask) { rebuild(); return; }
    lastMask = match[1];
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1;
    let svg = decodeURIComponent(match[1].slice(match[1].indexOf(',') + 1));
    // bump only the <svg> root's pixel size to native art res; keep its viewBox so
    // the internal piece geometry is unchanged, just rasterised on the art grid.
    svg = svg.replace(/width='(\d+)' height='(\d+)'/,
      (mm, w, h) => `width='${Math.round(+w / scale)}' height='${Math.round(+h / scale)}'`);
    const im = new Image();
    im.onload = () => { maskImg = im; rebuild(); };
    im.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  let tries = 0;
  const waitMask = () => {
    const mi = box.style.maskImage || box.style.webkitMaskImage || '';
    if (texImg && /data:/.test(mi)) syncMask();
    else if (tries++ < 600) requestAnimationFrame(waitMask);
  };
  loadTexture().then(waitMask);
  const ro = new ResizeObserver(() => syncMask());
  ro.observe(box);

  // ---- interaction: a pool of independent local dents, each a 2D spring ----
  const dents = [];               // { cx, cy, ox, oy, vx, vy }  (css px)
  let warping = false, last = 0, raf = 0;
  const m = { x: -9999, y: -9999, px: -9999, py: -9999, active: false };
  const onMove = (e) => { m.x = e.clientX; m.y = e.clientY; if (!m.active) { m.px = m.x; m.py = m.y; m.active = true; } };
  const onLeave = () => { m.active = false; };

  // draw the border, then resample each pixel by the SUM of every dent's offset
  // (radial falloff). Summing in one pass handles overlapping dents and never
  // erases a neighbour, so re-crossing/over-poking stays clean.
  function warp() {
    const vctx = canvas.getContext('2d');
    vctx.drawImage(src, 0, 0);
    if (!dents.length) return;
    const r = canvas.getBoundingClientRect();                  // canvas overhangs the box → map via its own rect
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const RD = RWARP * sx, RD2 = RD * RD;
    const P = dents.map((d) => ({ cx: (d.cx - r.left) * sx, cy: (d.cy - r.top) * sy, ox: d.ox * sx, oy: d.oy * sy }));
    let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
    for (const p of P) { x0 = Math.min(x0, p.cx - RD); x1 = Math.max(x1, p.cx + RD); y0 = Math.min(y0, p.cy - RD); y1 = Math.max(y1, p.cy + RD); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(canvas.width, Math.ceil(x1)); y1 = Math.min(canvas.height, Math.ceil(y1));
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return;
    const SW = canvas.width, SH = canvas.height, S = srcData.data;
    const out = vctx.createImageData(w, h), O = out.data;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let dxs = 0, dys = 0;
        for (let k = 0; k < P.length; k++) {
          const p = P[k], ddx = x - p.cx, ddy = y - p.cy, d2 = ddx * ddx + ddy * ddy;
          if (d2 < RD2) { const fo = 1 - Math.sqrt(d2) / RD, f = fo * fo * fo; dxs += p.ox * f; dys += p.oy * f; }
        }
        const ix = dxs ? Math.round(x - dxs) : x, iy = dys ? Math.round(y - dys) : y;
        const oi = ((y - y0) * w + (x - x0)) * 4;
        if (ix >= 0 && ix < SW && iy >= 0 && iy < SH) {
          const si = (iy * SW + ix) * 4;
          O[oi] = S[si]; O[oi + 1] = S[si + 1]; O[oi + 2] = S[si + 2]; O[oi + 3] = S[si + 3];
        }
      }
    }
    vctx.putImageData(out, x0, y0);
  }

  const frame = (now) => {
    let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05; if (dt <= 0) dt = 1 / 60;
    const vx = (m.x - m.px) / dt, vy = (m.y - m.py) / dt;

    if (m.active && ready) {
      const speed = Math.hypot(vx, vy);
      if (speed > 5) {
        const r = box.getBoundingClientRect();
        // Check this frame's whole movement SEGMENT, not just the latest point:
        // mousemove reports discrete positions, so a fast flick can jump clean
        // across a thin border with no event near it. Walk px→x and engage at the
        // closest border point along the way.
        const segLen = Math.hypot(m.x - m.px, m.y - m.py);
        const steps = Math.max(1, Math.min(48, Math.ceil(segLen / 6)));
        let best = null;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const sxp = m.px + (m.x - m.px) * t, syp = m.py + (m.y - m.py) * t;
          const np = nearestOnBorder(sxp, syp, r.left, r.top, r.right, r.bottom);
          if (np.dist < REACH && (!best || np.dist < best.dist)) best = np;
        }
        if (best) {
          const fo = 1 - best.dist / REACH, f = fo * fo;        // closer = harder
          // re-cross near an existing dent → feed it (additive); else spawn one
          let d = null, bd = MERGE;
          for (const q of dents) { const dd = Math.hypot(q.cx - best.x, q.cy - best.y); if (dd < bd) { bd = dd; d = q; } }
          if (!d) {
            if (dents.length >= MAX_DENTS) {                     // recycle the weakest
              let wi = 0, we = Infinity;
              for (let i = 0; i < dents.length; i++) { const e = Math.hypot(dents[i].ox, dents[i].oy); if (e < we) { we = e; wi = i; } }
              d = dents[wi]; d.cx = best.x; d.cy = best.y; d.ox = d.oy = d.vx = d.vy = 0;
            } else { d = { cx: best.x, cy: best.y, ox: 0, oy: 0, vx: 0, vy: 0 }; dents.push(d); }
          } else { d.cx += (best.x - d.cx) * 0.35; d.cy += (best.y - d.cy) * 0.35; } // track a slide
          d.vx += vx * IMPULSE * f; d.vy += vy * IMPULSE * f;    // ADD velocity in movement dir
        }
      }
    }

    // integrate every dent (hero-matched spring), drop the ones that have settled
    for (let i = dents.length - 1; i >= 0; i--) {
      const d = dents[i];
      const ax = -K * d.ox - DAMP * d.vx, ay = -K * d.oy - DAMP * d.vy;
      d.vx += ax * dt; d.vy += ay * dt; d.ox += d.vx * dt; d.oy += d.vy * dt;
      const mag = Math.hypot(d.ox, d.oy);
      if (mag > MAXOFF) { d.ox = d.ox / mag * MAXOFF; d.oy = d.oy / mag * MAXOFF; }
      if (mag < 0.25 && Math.hypot(d.vx, d.vy) < 3) dents.splice(i, 1);
    }

    if (ready) {
      if (dents.length) { warp(); warping = true; }
      else if (warping) { canvas.getContext('2d').drawImage(src, 0, 0); warping = false; }
    }
    m.px = m.x; m.py = m.y;
    raf = requestAnimationFrame(frame);
  };
  addEventListener('mousemove', onMove, { passive: true });
  addEventListener('mouseleave', onLeave);
  raf = requestAnimationFrame((t) => { last = t; frame(t); });

  return {
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect();
      removeEventListener('mousemove', onMove); removeEventListener('mouseleave', onLeave);
      box.style.visibility = ''; canvas.remove();
    }
  };
}
