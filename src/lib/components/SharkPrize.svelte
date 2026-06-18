<script>
  // Progressive prize doodle. A tiny pre-baked pixel-art blahaj (<700 bytes,
  // /assets/blahaj.png) paints instantly. A lightweight three.js scene then
  // lazy-loads the 98KB glb in the background. The poster was baked from the
  // SAME scene module ($lib/shark/scene.js) at the same backing resolution and
  // rest pose, so it is pixel-identical to the model's resting frame.
  //
  // Key idea: the POSTER is the at-rest display, always. The WebGL canvas is
  // only shown + rendered while the user is actively dragging/spinning it; the
  // instant it coasts to a stop, we snapshot that final frame back into the
  // poster <img> and hide the canvas again. So the upgrade is invisible (at
  // rest it's always the same crisp image — no flash, no GPU idle cost, and it
  // degrades to a plain image if WebGL ever fails), yet every frame the canvas
  // shows starts from the exact pose the poster shows, so the hand-off is
  // seamless in both directions.
  import { onMount } from 'svelte';

  // Two interaction flavours of the SAME widget:
  //  - 'flick'     (default, used in EmailSignup): drag / hover-swipe imparts yaw
  //                velocity, then it coasts to a stop.
  //  - 'hoverspin' (Prizes section): no direction-following — it just turntables
  //                at a slow constant speed for as long as the cursor is over it,
  //                then coasts to a stop and bakes the resting frame.
  // `pose` overrides the model's starting rotation (and the baked poster must be
  // rendered at that same pose for a seamless poster↔canvas hand-off).
  let {
    mode = 'flick',
    poster = '/assets/blahaj.png',
    pose = null,
  } = $props();

  let canvasEl;
  let wrapEl;
  // at rest we show the `poster` prop; once a spin settles we bake that final
  // frame into `bakedSrc`, which then takes over. (seeding state from a literal,
  // not the prop, keeps the poster as the stable at-rest fallback.)
  let bakedSrc = $state(null);
  let posterSrc = $derived(bakedSrc ?? poster);
  let showCanvas = $state(false);     // canvas visible (poster hidden) during interaction
  let handlePosterLoad = () => {};    // assigned in onMount; called by the <img> onload

  onMount(() => {
    let scene = null;
    let raf = 0, lastFrame = 0;
    let dragging = false;
    let vy = 0;                      // yaw angular velocity (rad/s) for coast-to-stop
    let px = 0, py = 0, pt = 0;
    // Rotation is locked to the horizontal axis (yaw / ry only). Pitch (rx) stays
    // at the rest pose, so the shark turns left↔right like a turntable and never
    // tips up/down — vertical mouse motion is ignored.
    let started = false, destroyed = false, ready = false;
    let hovering = false;            // (hoverspin) cursor is over the box → keep turning
    let snapping = false;            // a snapshot data-url is loading into the poster
    let gx = 0, gy = 0, gT = 0, gInit = false;  // last global pointer sample (for swept-segment hits)
    let rect = null;                 // cached wrap rect, refreshed on scroll/resize (no per-move reflow)

    const DRAG = 0.01;               // screen px → radians (click-drag position mapping)
    const FLICK = 0.004;             // mouse speed (px/s) → angular velocity (rad/s) on a hover-swipe
    const MAXV = 6;                  // cap a wild flick (rad/s)
    const GRAZE = 3;                 // px of forgiveness added to the shark's centre-circle hit radius
    const FRAME = 1000 / 60;
    const STOP = 0.02;               // settle threshold (rad/s)
    const SPIN = 1.1;                // (hoverspin) constant turntable speed (rad/s)

    // ---- interaction render loop (only alive while moving) ----
    function loop(now) {
      if (destroyed || !scene) return;
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < FRAME) return;
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      if (mode === 'hoverspin') {
        // while hovered: hold a constant slow spin. on leave: coast to a stop
        // (same exponential damping as a flick) and bake the resting frame.
        if (hovering) vy = SPIN; else vy *= Math.exp(-3 * dt);
        scene.state.ry += vy * dt;
        scene.render();
        if (!hovering && Math.abs(vy) < STOP) settle();
        return;
      }
      if (!dragging) {
        scene.state.ry += vy * dt;
        vy *= Math.exp(-3 * dt);
      }
      scene.render();
      if (!dragging && Math.abs(vy) < STOP) settle();
    }
    function startLoop() { if (!raf) { lastFrame = performance.now() - FRAME; raf = requestAnimationFrame(loop); } }
    function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    // coasted to a stop: bake the final pose into the poster, then drop back to
    // the image (canvas hidden). The poster swap waits for the snapshot to load
    // (handlePosterLoad) so there's never a blank frame.
    function settle() {
      stopLoop();
      scene.render();                                  // ensure the buffer is current
      try {
        snapping = true;
        bakedSrc = canvasEl.toDataURL('image/png');    // exact final frame → poster
      } catch (err) {
        snapping = false;
        showCanvas = false;                            // readback failed: just reveal poster
      }
    }
    handlePosterLoad = () => { if (snapping) { snapping = false; showCanvas = false; } };

    // ---- pointer: grab anywhere in the box ----
    function onDown(e) {
      if (!ready) return;                              // model not loaded yet → stays a static image
      dragging = true; vy = 0;
      px = e.clientX; py = e.clientY; pt = performance.now();
      scene.render();                                  // draw current pose BEFORE revealing canvas
      showCanvas = true;                               // poses match → seamless reveal
      wrapEl.setPointerCapture?.(e.pointerId);
      startLoop();
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging || !scene) return;
      const now = performance.now();
      const dt = Math.max((now - pt) / 1000, 1 / 240);
      const dx = (e.clientX - px) * DRAG;
      scene.state.ry += dx;                            // yaw only — pitch (rx) is locked
      vy = dx / dt;
      px = e.clientX; py = e.clientY; pt = now;
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      wrapEl.releasePointerCapture?.(e.pointerId);
      startLoop();                                     // inertia runs until settle()
    }

    // ---- hoverspin: turntable for as long as the cursor is over the box ----
    // enter → reveal the canvas (drawing the current pose first so the swap is
    // seamless) and start the loop, which holds a constant slow spin. leave →
    // drop `hovering`; the loop then coasts to a stop and bakes the rest frame.
    function onEnter() {
      if (!ready) return;                              // model not loaded yet → stays a static image
      hovering = true;
      scene.render();                                  // draw current pose BEFORE revealing canvas
      showCanvas = true;
      startLoop();
    }
    function onLeave() { hovering = false; startLoop(); }

    // ---- hover-swipe: like swiping the jiggle letters — sweeping the mouse over
    // the shark imparts angular VELOCITY (∝ mouse speed), which then coasts to a
    // stop and keeps the pose. No position-follow, no spring-back — pure imparted
    // momentum, carried by the same coast loop as a drag fling.
    //
    // Detection is swept-segment, not per-event hover: we test whether the line
    // between consecutive global pointer samples crosses the shark, so a fast
    // flick that jumps clear over it still registers (a plain mouseover would
    // miss it). The hit zone is a CENTRE CIRCLE, not the box: the box is sized to
    // the model's rotation sphere, so its corners are empty margin — the shark
    // only ever sweeps within the inscribed circle (box height ≈ sphere diameter).
    // One cached rect + a segment↔circle distance test per move, no reflow. Mouse
    // only; touch has no hover, it drags. ----
    function refreshRect() { rect = wrapEl.getBoundingClientRect(); }

    // does segment (x0,y0)->(x1,y1) come within the shark's centre circle?
    function segHitsShark(x0, y0, x1, y1) {
      if (!rect || rect.width < 1) return false;       // not laid out / hidden (e.g. resized narrow)
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      const r = Math.min(rect.width, rect.height) / 2 + GRAZE;   // inscribed circle ≈ the shark's swept extent
      const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
      let t = len2 ? ((cx - x0) * dx + (cy - y0) * dy) / len2 : 0; // closest point on the segment to the centre
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x0 + t * dx - cx, ey = y0 + t * dy - cy;
      return ex * ex + ey * ey <= r * r;
    }

    function onGlobalMove(e) {
      const now = performance.now();
      const x0 = gx, y0 = gy, t0 = gT;
      gx = e.clientX; gy = e.clientY; gT = now;            // always advance the baseline
      if (!gInit) { gInit = true; return; }
      if (dragging || !ready) return;                      // drag handled elsewhere; not loaded yet → static
      const dt = (now - t0) / 1000;
      if (dt <= 0 || dt > 0.1) return;                     // idle gap / window re-entry teleport: ignore
      if (!segHitsShark(x0, y0, gx, gy)) return;            // path didn't cross the shark's circle
      const nvy = Math.max(-MAXV, Math.min(MAXV, (gx - x0) / dt * FLICK));  // horizontal swipe speed → yaw velocity
      if (Math.abs(nvy) < STOP) return;                    // too slow to matter (and don't disturb a coast)
      vy = nvy;                                            // yaw only; vertical motion is ignored
      if (!showCanvas) { scene.render(); showCanvas = true; }
      startLoop();                                         // loop integrates the velocity, coasts, then settle()s
    }

    async function start() {
      if (started) return;
      started = true;
      try {
        const [THREE, { GLTFLoader }, { createSharkScene, BACKING }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('$lib/shark/scene.js'),
        ]);
        if (destroyed) return;
        scene = createSharkScene({
          THREE, GLTFLoader, canvas: canvasEl,
          glbUrl: '/assets/blahaj.glb',
          backing: { ...BACKING },
          ...(pose ? { pose } : {}),                   // starting rotation override
          preserveDrawingBuffer: true,                 // needed for the settle() snapshot readback
        });
        await scene.ready;                             // loaded + rest frame drawn; canvas stays hidden
        if (destroyed) { scene.dispose(); return; }
        refreshRect();                                 // cache the box now that layout is settled
        ready = true;                                  // the poster already shows this exact pose —
        wrapEl.dataset.ready = '1';                    // the doodle is now silently draggable.
      } catch (err) {
        console.warn('[shark] 3D load failed, keeping poster', err);
      }
    }

    // load only when the doodle nears the viewport (wide-screen gutter deco,
    // usually below the fold) so we never compete with first paint.
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '300px' });
    io.observe(wrapEl);

    if (mode === 'hoverspin') {
      wrapEl.addEventListener('pointerenter', onEnter);
      wrapEl.addEventListener('pointerleave', onLeave);
    } else {
      wrapEl.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);      // drag
      window.addEventListener('pointermove', onGlobalMove); // swept-segment hover-swipe
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('scroll', refreshRect, { passive: true });
      window.addEventListener('resize', refreshRect);
    }

    return () => {
      destroyed = true;
      io.disconnect();
      stopLoop();
      wrapEl.removeEventListener('pointerenter', onEnter);
      wrapEl.removeEventListener('pointerleave', onLeave);
      wrapEl.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointermove', onGlobalMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('scroll', refreshRect);
      window.removeEventListener('resize', refreshRect);
      scene?.dispose();
    };
  });
</script>

<span class="shark-wrap" class:hoverspin={mode === 'hoverspin'} bind:this={wrapEl}>
  <!-- at-rest display + no-JS / WebGL-fail fallback. src is rewritten to the
       last spun pose when the 3D canvas settles. -->
  <img
    class="shark-poster"
    class:hidden={showCanvas}
    src={posterSrc}
    onload={() => handlePosterLoad()}
    alt=""
    aria-hidden="true"
  />
  <!-- only visible while actively dragging/spinning -->
  <canvas
    class="shark-canvas"
    class:show={showCanvas}
    bind:this={canvasEl}
    aria-hidden="true"
  ></canvas>
</span>

<style>
  .shark-wrap {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
    touch-action: none;          /* own drag gestures on touch */
  }
  .shark-wrap:active { cursor: grabbing; }
  /* hoverspin: not draggable — inherit the surrounding cursor (e.g. the prize
     link's pointer) and just spin while hovered. */
  .shark-wrap.hoverspin,
  .shark-wrap.hoverspin:active { cursor: inherit; }

  .shark-poster,
  .shark-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: pixelated;
    pointer-events: none;        /* the wrap owns all pointer handling */
  }
  /* poster shows at rest; canvas shows only mid-interaction. They render the
     same pose at every hand-off, so toggling instantly is invisible. */
  .shark-canvas { opacity: 0; }
  .shark-canvas.show { opacity: 1; }
  .shark-poster.hidden { opacity: 0; }
</style>
