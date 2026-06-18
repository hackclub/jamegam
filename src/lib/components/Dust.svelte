<!--
  Background dust: sparse light-gray pixel particles drifting on a low-res
  canvas, behind everything. A port of the original logo prototype's #dust
  system (dustSpawn / dustInit / dustFrame) — pure ambient drift, no mouse
  interaction.

  Unlike the prototype (a fixed viewport underlay), this canvas is an ABSOLUTE
  full-document layer (like #edge-doodles / #noise): it's as tall as the whole
  page and scrolls WITH the content, so the motes are part of the document
  rather than pinned to the viewport. The canvas renders at 1/DUST_PX resolution
  and is CSS-stretched with image-rendering:pixelated, so each mote is a crisp
  DUST_PX-sized square.
-->
<script>
  import { onMount } from 'svelte';

  // CSS px per dust pixel — chunky, pixel-art motes matching the site's look.
  const DUST_PX = 4;
  // lightest → darkest; the roll is squared so most motes whisper at the light end.
  const DUST_COLORS = ['#eceae8', '#e6e4e1', '#dedbd8', '#d6d3cf', '#cdc9c5', '#c6c2be'];

  let canvas;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    let dust = [];
    let dw = 0, dh = 0;
    let rafId = 0;
    let last = performance.now();

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function spawn(p) {
      p.x = Math.random() * dw;
      p.y = Math.random() * dh;
      p.ang = Math.random() * Math.PI * 2;
      p.speed = 0.5 + Math.random() * 1.0;          // dust px/s — glacial
      p.turn = 0.25 + Math.random() * 0.4;          // rad/s of wander
      p.size = Math.random() < 0.8 ? 1 : 2;
      // square the roll: index 0 (lightest) most common, darkest rare
      p.color = DUST_COLORS[(Math.random() * Math.random() * DUST_COLORS.length) | 0];
      p.alpha = 0.18 + Math.random() * 0.22;
      p.maxLife = 12 + Math.random() * 18;          // s
      p.life = 0;
      return p;
    }

    // size the low-res backing store to the canvas's rendered box (full document,
    // since it's height:100% of #content) and reconcile the mote field to it.
    // On reflow (FAQ expand/collapse, fonts/images loading) the page height
    // changes, so this fires repeatedly — we must NOT respawn existing motes, or
    // every mote visibly teleports. Mote coords are absolute dust-px and stay
    // valid as the page grows, so we keep them in place and only add/trim to
    // match the new area's target count.
    function init() {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      const ndw = Math.ceil(w / DUST_PX);
      const ndh = Math.ceil(h / DUST_PX);
      if (ndw < 1 || ndh < 1) return;
      if (ndw === dw && ndh === dh && dust.length) return;  // nothing changed
      dw = ndw;
      dh = ndh;
      // Reassigning the backing store clears it. RO callbacks fire AFTER the rAF
      // draw but BEFORE paint, so we must redraw below or the paint shows a blank
      // canvas — that's the flicker on FAQ expand/collapse.
      canvas.width = dw;
      canvas.height = dh;
      const count = Math.round((w * h) / (120 * 120));  // ~1 mote / 120² css px
      if (dust.length > count) {
        dust.length = count;                         // trim extras (page shrank)
      } else {
        while (dust.length < count) {                // top up new area only
          const p = spawn({});
          p.life = Math.random() * p.maxLife;        // desync lifecycles
          dust.push(p);
        }
      }
      draw(0);                                       // repaint immediately post-clear
    }

    function draw(dt) {
      ctx.clearRect(0, 0, dw, dh);
      for (const p of dust) {
        p.life += dt;
        if (p.life >= p.maxLife) spawn(p);
        // smooth wander: heading drifts, position follows
        p.ang += (Math.random() - 0.5) * p.turn * dt * 2;
        p.x += Math.cos(p.ang) * p.speed * dt;
        p.y += Math.sin(p.ang) * p.speed * dt;
        // wrap
        if (p.x < -2) p.x = dw + 1; else if (p.x > dw + 2) p.x = -1;
        if (p.y < -2) p.y = dh + 1; else if (p.y > dh + 2) p.y = -1;
        // fade in/out over the first/last 20% of life
        const t = p.life / p.maxLife;
        const env = Math.min(1, Math.min(t, 1 - t) / 0.2);
        ctx.globalAlpha = p.alpha * env;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
      draw(dt);
      rafId = requestAnimationFrame(frame);
    }

    init();
    // re-seed when the document reflows (fonts/images load → page height changes),
    // mirroring how #edge-doodles re-measures off document.body.
    const ro = new ResizeObserver(init);
    ro.observe(canvas);

    if (!reduce) rafId = requestAnimationFrame((t) => { last = t; frame(t); });

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  });
</script>

<canvas id="dust" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  /* absolute full-document layer (inside #content) — as tall as the whole page,
     scrolls with the content. z-index 0 keeps it behind every section (1+). */
  #dust {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    image-rendering: pixelated;
  }
</style>
