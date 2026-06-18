/* ----------------------------------------------------------------------------
   jiggle — per-letter mouse-physics text that stays selectable/accessible.

   Usage:  <p class="txt" use:jiggle>some copy</p>

   Each paragraph keeps a screen-reader-only clean copy of its sentence and a
   visible aria-hidden copy split into per-character spans. One shared rAF loop
   + one shared mouse drives every registered paragraph, so sections can opt in
   independently without each spinning up their own loop. (Faithful port of the
   original site's jiggle IIFE, generalised from a global `.jiggle` query into a
   Svelte action so each section owns its own paragraphs.)
   ---------------------------------------------------------------------------- */

import { getZoom } from '$lib/viewport.js';
import { rainbowUnderline } from '$lib/actions/rainbowUnderline.js';

const PALETTE = ['#91a4db', '#97db91', '#db9591', '#dbaf91', '#dbd991', '#b991db']
  .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
// rainbow (red, orange, yellow, green, blue, purple) drawn from the exact flash palette
const RAINBOW = [2, 3, 4, 1, 0, 5].map((i) => PALETTE[i]);
const lighten = (b) => b.map((v) => Math.round(v + (255 - v) * 0.62)); // "flash lighter"

// tuning
// ~3x the "by hack club" byline movement (byline ≈0.0063); flash dampened to ~2/3.
const K = 320, DAMP = 12, DECAY = 2.6, R = 45, PROX = 0.019, MAXD = 17, FLASH = 0.667;

const chars = [];
const nodes = new Set();
const built = new WeakSet();
const m = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false };

let started = false;
let ready = false;
let last = 0;
let rt;

function buildNode(p) {
  if (built.has(p)) return;
  built.add(p);
  const txt = p.getAttribute('data-text') || p.textContent;
  p.setAttribute('data-text', txt);
  const base = (getComputedStyle(p).color.match(/\d+/g) || [80, 75, 73]).map(Number);
  // which word gets the full "prizes" treatment (rainbow per-letter flash, extra
  // wiggle, live rainbow underline). Defaults to "prizes"; set per-node via
  // use:jiggle={{ prizeWord: 'ready' }} to give another word the same effect.
  const prizeWord = p.__jigglePrizeWord || 'prizes';
  p.textContent = '';
  const sr = document.createElement('span'); sr.className = 'jiggle-sr'; sr.textContent = txt; p.appendChild(sr);
  const vis = document.createElement('span'); vis.className = 'jiggle-vis'; vis.setAttribute('aria-hidden', 'true'); p.appendChild(vis);
  txt.split(/(\s+)/).forEach((tok) => {
    if (tok === '') return;
    if (/^\s+$/.test(tok)) { vis.appendChild(document.createTextNode(tok)); return; } // real whitespace: wraps + copies
    const isPrizes = tok.replace(/[^a-z]/gi, '').toLowerCase() === prizeWord;
    const w = document.createElement('span'); w.className = isPrizes ? 'jw jw-prizes' : 'jw';
    let ci = 0;
    for (const ch of tok) {
      const c = document.createElement('span'); c.className = 'jc'; c.textContent = ch;
      w.appendChild(c);
      // prizes flashes a fixed rainbow per letter; everything else just flashes lighter
      const flash = isPrizes ? RAINBOW[ci % RAINBOW.length] : lighten(base);
      chars.push({ el: c, p, base: base.slice(), flash, r: base[0], g: base[1], b: base[2],
                   x: 0, y: 0, vx: 0, vy: 0, armed: true, grazeColor: null, grazePeak: 0,
                   lastT: '', lastC: '', offX: 0, offY: 0, w: 0, h: 0,
                   jig: isPrizes ? 2.5 : 1 });   // prizes wiggles much more than the rest
      ci++;
    }
    vis.appendChild(w);
    // the prizes word gets the live rainbow underline — it follows the letters
    // and reacts as the jiggle physics move them. Opt out per-node with
    // use:jiggle={{ underline: false }} (the prizes-section title does this).
    if (isPrizes && p.__jiggleUnderline !== false) w._ul = rainbowUnderline(w, { noHook: p.__jiggleUnderlineNoHook, extendLeft: p.__jiggleUnderlineExtendLeft });
  });
}

function measure() {
  for (const c of chars) c.el.style.transform = '';
  const pr = new Map();
  nodes.forEach((p) => pr.set(p, p.getBoundingClientRect()));
  for (const c of chars) {
    const b = pr.get(c.p);
    if (!b) continue;
    const r = c.el.getBoundingClientRect();
    c.offX = r.left - b.left + r.width / 2;
    c.offY = r.top - b.top + r.height / 2;
    c.w = r.width; c.h = r.height;
  }
}

function mv(e) {
  m.x = e.clientX; m.y = e.clientY;
  if (!m.active) { m.px = m.x; m.py = m.y; m.active = true; }
}

function frame(now) {
  let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
  const Z = getZoom();
  if (m.active) { m.vx = (m.x - m.px) / Math.max(dt, 1 / 240); m.vy = (m.y - m.py) / Math.max(dt, 1 / 240); }
  else { m.vx = 0; m.vy = 0; }
  const pr = new Map();
  for (const p of nodes) pr.set(p, p.getBoundingClientRect());

  for (const c of chars) {
    const b = pr.get(c.p);
    if (!b) continue;
    const cx = b.left + c.offX + c.x * Z, cy = b.top + c.offY + c.y * Z;
    const hw = c.w / 2, hh = c.h / 2;
    let dist = Infinity, inside = false;
    if (m.active) {
      const dx = Math.max((cx - hw) - m.x, 0, m.x - (cx + hw)), dy = Math.max((cy - hh) - m.y, 0, m.y - (cy + hh));
      dist = Math.hypot(dx, dy); inside = dist === 0;
    }
    if (m.active && dist < R) {
      const t = 1 - dist / R, f = t * t;
      c.vx += (m.vx / Z) * PROX * f * c.jig; c.vy += (m.vy / Z) * PROX * f * c.jig;
      if (c.grazeColor === null) { c.grazeColor = c.flash; c.grazePeak = 0; }
      const sp = Math.hypot(m.vx, m.vy), s = f * Math.min(1, sp / 500);
      if (s > c.grazePeak) {
        c.grazePeak = s; const [gr, gg, gb] = c.grazeColor;
        c.r = c.base[0] + (gr - c.base[0]) * s * FLASH; c.g = c.base[1] + (gg - c.base[1]) * s * FLASH; c.b = c.base[2] + (gb - c.base[2]) * s * FLASH;
      }
    } else { c.grazeColor = null; c.grazePeak = 0; }
    if (c.armed && inside) {
      const [fr, fg, fb] = c.flash;
      c.r = c.base[0] + (fr - c.base[0]) * FLASH; c.g = c.base[1] + (fg - c.base[1]) * FLASH; c.b = c.base[2] + (fb - c.base[2]) * FLASH;
      c.grazePeak = 1; c.armed = false;
    }
    if (!inside) c.armed = true;

    const ax = -K * c.x - DAMP * c.vx, ay = -K * c.y - DAMP * c.vy;
    c.vx += ax * dt; c.vy += ay * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    const md = MAXD * c.jig;
    const d = Math.hypot(c.x, c.y); if (d > md) { c.x = c.x / d * md; c.y = c.y / d * md; }

    const k = 1 - Math.exp(-DECAY * dt);
    c.r += (c.base[0] - c.r) * k; c.g += (c.base[1] - c.g) * k; c.b += (c.base[2] - c.b) * k;

    const tx = Math.round(c.x), ty = Math.round(c.y);
    const tr = (tx || ty) ? `translate(${tx}px,${ty}px)` : '';
    if (tr !== c.lastT) { c.el.style.transform = tr; c.lastT = tr; }
    const col = `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
    if (col !== c.lastC) { c.el.style.color = col; c.lastC = col; }
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
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 150); });

  const begin = () => {
    ready = true;
    nodes.forEach(buildNode);
    measure();
    requestAnimationFrame((t) => { last = t; frame(t); });
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin);
  else addEventListener('load', begin);
}

/** Svelte action: register a paragraph for jiggle physics.
 *  options.underline === false skips the rainbow underline on a "prizes" word. */
export function jiggle(node, options = {}) {
  // respect prefers-reduced-motion: leave the paragraph as plain, selectable
  // text (no per-letter spans, no physics loop, no rainbow underline).
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return {};
  }
  node.__jiggleUnderline = options.underline !== false;
  node.__jigglePrizeWord = options.prizeWord || 'prizes';
  node.__jiggleUnderlineNoHook = options.underlineNoHook === true;
  node.__jiggleUnderlineExtendLeft = options.underlineExtendLeft || 0;
  nodes.add(node);
  ensureStarted();
  if (ready) { buildNode(node); measure(); } // late joiner: build immediately
  return {
    destroy() {
      nodes.delete(node);
      built.delete(node);
      const pw = node.querySelector?.('.jw-prizes');
      if (pw && pw._ul) { pw._ul.destroy(); pw._ul = null; }
      for (let i = chars.length - 1; i >= 0; i--) if (chars[i].p === node) chars.splice(i, 1);
    }
  };
}
