/* ----------------------------------------------------------------------------
   squiggle — the hand-drawn rainbow underline under "prizes", drawn from math.

   The original underline was a baked PNG (email_line538.png, 104×15): a rainbow
   squiggle that was really `rainbow_texture.png` masked by a hand-drawn line. We
   reproduce that here procedurally so it can be drawn at any size with the rainbow
   at a controlled pixel scale (instead of stretching a tiny bitmap):

     • CENTERLINE  — the path the pen took, reverse-engineered from the PNG's
                     per-column centre-of-mass. Authored in the PNG's native
                     104×15 space; the consumer scales that to the word box (so a
                     wider/narrower "prizes" squishes the line exactly as the old
                     stretched-background did). Comes in low at the left, hooks
                     down, whips up past the baseline, settles to a plateau, then
                     drifts gently upward to the right.
     • THICKNESS   — a constant ~3.8 native-px stroke (round cap/join), matching
                     the PNG's ~4px line.
     • WOBBLE      — small seeded perpendicular jitter on the control points so it
                     reads hand-drawn, the way the original's manual wiggle does.

   This module is framework-agnostic (no DOM, no $lib) so the offline pixel-diff
   harness and the Svelte action can share the exact same geometry.
   ---------------------------------------------------------------------------- */

// native PNG metrics — the coordinate space the centerline is authored in.
export const NATIVE_W = 104;
export const NATIVE_H = 15;

// reverse-engineered centerline of email_line538.png (native px, x → centre y).
// hook at the bottom-left, steep whip-up with a small overshoot, ~4.5 plateau,
// then a gentle climb to the top-right. See workspace/underline analysis.
const CENTERLINE = [
  [0, 11.0],
  [6, 12.5],   // bottom of the start hook
  [10, 12.0],
  [13, 10.0],
  [16, 5.6],   // steep rise (the elbow)
  [18, 3.6],   // little overshoot above the plateau
  [22, 3.5],
  [27, 4.5],   // settle onto the plateau
  [45, 4.5],
  [62, 4.5],
  [67, 4.0],
  [73, 3.5],
  [79, 3.0],
  [88, 2.5],
  [95, 2.0],
  [103, 1.5]
];

// the constant stroke thickness (native px) and how hard the hand-drawn jitter is.
export const STROKE = 4.0;
const WOBBLE = 0.22;     // max perpendicular jitter on resampled points (native px)
const RESAMPLE = 4.0;    // resample the centerline to ~this spacing before wobbling
// the measured centerline sits a hair high vs the bilinear-smeared original;
// +0.5px lands the stroke's optical centre on the PNG's (pixel-diff calibrated).
const Y_OFFSET = 0.5;

// tiny deterministic PRNG so a given seed always draws the same line.
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// linear sample of the centerline polyline at native-x.
function centerAt(x) {
  const pts = CENTERLINE;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const t = (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return pts[pts.length - 1][1];
}

// resample the centerline at a fixed step, then nudge each interior point along
// the local normal by a seeded random amount — the "drawn by a slightly shaky
// hand" wobble. Endpoints stay put so the line keeps its length.
function wobbledPoints(seed) {
  const x0 = CENTERLINE[0][0], x1 = CENTERLINE[CENTERLINE.length - 1][0];
  const n = Math.max(2, Math.round((x1 - x0) / RESAMPLE));
  const base = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    base.push([x, centerAt(x) + Y_OFFSET]);
  }
  const rnd = mulberry32(seed);
  // a touch of value smoothing on the noise so it undulates rather than buzzes.
  const out = base.map((p) => p.slice());
  for (let i = 1; i < out.length - 1; i++) {
    const [px, py] = base[i - 1], [nx, ny] = base[i + 1];
    let tx = nx - px, ty = ny - py;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const nrmx = -ty, nrmy = tx;            // unit normal
    const j = (rnd() * 2 - 1) * WOBBLE;
    out[i][0] += nrmx * j;
    out[i][1] += nrmy * j;
  }
  return out;
}

// Catmull-Rom → cubic-bezier path through the points, for a smooth hand-drawn
// curve (round joins between segments). Coordinates are native 104×15 px.
function catmullRom(points) {
  if (points.length < 2) return '';
  const p = points;
  let d = `M ${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Build the squiggle path `d` (native 104×15 coords) for a given seed. */
export function squigglePath(seed = 1) {
  return catmullRom(wobbledPoints(seed));
}

/* ---- dynamic contour (letter-following) ---------------------------------- */

// resample a sorted [x,y] polyline at ~`step` spacing in x, so the sparse
// per-letter control points become a dense smooth line we can wobble + curve.
function resampleByX(points, step) {
  const x0 = points[0][0], x1 = points[points.length - 1][0];
  const n = Math.max(1, Math.round((x1 - x0) / step));
  const out = [];
  let seg = 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    while (seg < points.length - 1 && points[seg][0] < x) seg++;
    const [ax, ay] = points[seg - 1], [bx, by] = points[seg];
    const t = bx === ax ? 0 : (x - ax) / (bx - ax);
    out.push([x, ay + (by - ay) * t]);
  }
  return out;
}

// nudge interior points along their local normal by a seeded amount (the shaky
// hand). Endpoints stay put. Shared shape of the fixed + dynamic squiggles.
function wobbleAlongNormal(points, seed, amp) {
  const rnd = mulberry32(seed);
  const out = points.map((p) => p.slice());
  for (let i = 1; i < out.length - 1; i++) {
    const [px, py] = points[i - 1], [nx, ny] = points[i + 1];
    let tx = nx - px, ty = ny - py;
    const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    const j = (rnd() * 2 - 1) * amp;
    out[i][0] += -ty * j;
    out[i][1] += tx * j;
  }
  return out;
}

/** Sample the original reverse-engineered centerline at x-fraction [0,1],
 *  returning native-px y (0..15). The resting shape of the underline. */
export function sampleCenterline(frac) {
  return centerAt(Math.max(0, Math.min(1, frac)) * NATIVE_W);
}

/** Smooth a sequence of already-dense control points into a path `d`: seeded
 *  wobble along the normal, then a Catmull-Rom curve through them. The caller
 *  passes points that already trace the intended shape (any coord space); we do
 *  NOT linearly resample (that was what made the line look like straight
 *  segments) — the curve flows smoothly through whatever is handed in. */
export function contourPath(points, { seed = 1, wobble = WOBBLE } = {}) {
  if (points.length < 2) return '';
  return catmullRom(wobbleAlongNormal(points, seed, wobble));
}

// evaluate one Catmull-Rom segment at t∈[0,1].
function catmullPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

/** Return densely-sampled points ALONG the smooth (wobbled) Catmull-Rom curve
 *  through `points` — for rasterising the line by stamping a brush along it,
 *  rather than stroking a thin path. `perSeg` samples per control segment. */
export function contourPoints(points, { seed = 1, wobble = WOBBLE, perSeg = 12 } = {}) {
  if (points.length < 2) return points.slice();
  const p = wobbleAlongNormal(points, seed, wobble);
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    for (let s = 0; s < perSeg; s++) out.push(catmullPoint(p0, p1, p2, p3, s / perSeg));
  }
  out.push(p[p.length - 1]);
  return out;
}

/** Build a complete SVG string (native viewBox) of the stroked squiggle, in
 *  solid `color`. Used directly as a CSS mask (its alpha is the mask) — author
 *  the stroke opaque on a transparent canvas. */
export function squiggleSvg(seed = 1, { color = '#000', stroke = STROKE } = {}) {
  const d = squigglePath(seed);
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='${NATIVE_W}' height='${NATIVE_H}' ` +
    `viewBox='0 0 ${NATIVE_W} ${NATIVE_H}'>` +
    `<path d='${d}' fill='none' stroke='${color}' stroke-width='${stroke}' ` +
    `stroke-linecap='round' stroke-linejoin='round'/></svg>`
  );
}
