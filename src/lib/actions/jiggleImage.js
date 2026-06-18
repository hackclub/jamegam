/* ----------------------------------------------------------------------------
   jiggleImage — mouse-physics jiggle for whole elements (e.g. the prize images),
   the element-level cousin of jiggle.js (which is per-character text).

   Usage:  <img use:jiggleImage={{ rot: -9 }} />

   Each registered element springs around its resting spot: the cursor's velocity
   nudges it when nearby, then a damped spring pulls it back, with a tiny rotation
   wobble tied to the offset. One shared rAF + one shared mouse drives them all.
   The action OWNS the element's transform, so it composes the resting transform
   itself: translate(-50%,-50%) (centre on the JS-positioned point) + the jiggle
   offset + the base rotation.
   ---------------------------------------------------------------------------- */

const items = new Set();
const m = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false };
let started = false;
let last = 0;

// tuning — lively, on par with the jiggly logo/title text
const K = 260;      // spring stiffness (pull back to rest)
const DAMP = 10;    // velocity damping (lower = bouncier)
const R = 140;      // cursor influence radius (screen px)
const PROX = 0.032; // how much cursor velocity nudges a nearby item
const MAXD = 30;    // max displacement (screen px)
const ROTK = 0.13;  // rotation wobble per px of horizontal offset (deg)

function mv(e) {
  m.x = e.clientX; m.y = e.clientY;
  if (!m.active) { m.px = m.x; m.py = m.y; m.active = true; }
}

function apply(it) {
  const tx = Math.round(it.x), ty = Math.round(it.y);
  const wob = it.x * ROTK;
  const tr = `translate(-50%,-50%) translate(${tx}px,${ty}px) rotate(${(it.rot + wob).toFixed(2)}deg)`;
  if (tr !== it.lastT) { it.el.style.transform = tr; it.lastT = tr; }
}

function frame(now) {
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
  if (m.active) { m.vx = (m.x - m.px) / Math.max(dt, 1 / 240); m.vy = (m.y - m.py) / Math.max(dt, 1 / 240); }
  else { m.vx = 0; m.vy = 0; }

  for (const it of items) {
    const b = it.el.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    if (m.active) {
      const dist = Math.hypot(m.x - cx, m.y - cy);
      if (dist < R) {
        const t = 1 - dist / R, f = t * t;
        it.vx += m.vx * PROX * f; it.vy += m.vy * PROX * f;
      }
    }
    const ax = -K * it.x - DAMP * it.vx, ay = -K * it.y - DAMP * it.vy;
    it.vx += ax * dt; it.vy += ay * dt; it.x += it.vx * dt; it.y += it.vy * dt;
    const d = Math.hypot(it.x, it.y); if (d > MAXD) { it.x = (it.x / d) * MAXD; it.y = (it.y / d) * MAXD; }
    apply(it);
  }
  m.px = m.x; m.py = m.y;
  requestAnimationFrame(frame);
}

function ensureStarted() {
  if (started) return;
  started = true;
  addEventListener('mousemove', mv, { passive: true });
  addEventListener('mouseleave', () => { m.active = false; m.x = m.y = -9999; });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) mv({ clientX: t.clientX, clientY: t.clientY }); }, { passive: true });
  requestAnimationFrame((t) => { last = t; frame(t); });
}

/** Svelte action: give an element a subtle mouse-physics jiggle. */
export function jiggleImage(node, opts = {}) {
  const it = { el: node, rot: opts.rot || 0, x: 0, y: 0, vx: 0, vy: 0, lastT: '' };
  apply(it);                      // set the resting transform immediately
  items.add(it);
  ensureStarted();
  return {
    update(o = {}) { it.rot = o.rot || 0; },
    destroy() { items.delete(it); }
  };
}
