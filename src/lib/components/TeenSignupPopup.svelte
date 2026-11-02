<script>
  // /prizes: the "teenager?" popup. Opens only for visitors who clicked a prize
  // link on an itch jam page: those links carry ?ref=<slug> and the slug is in
  // ITCH_PRIZE_REFS. The page reads + strips the param (so a reload or a copied
  // url won't re-open it) and mounts this only when it should show. Dismissing it is remembered in
  // this browser, so clicking through from itch again doesn't nag twice.
  // The title + line are Augie's copy, verbatim.
  import TeenSignup from './TeenSignup.svelte';
  import { signup } from '$lib/signup.js';

  /** @type {{ ref?: string, onclose?: () => void }} */
  let { ref = '', onclose = () => {} } = $props();

  /** @type {HTMLElement | null} */
  let dialogEl = $state(null);
  /** @type {Element | null} */
  let lastFocus = null;

  // signed up from here: leave "you're in" up for a moment, then get out of
  // the way (the box on the page shows the same line underneath)
  $effect(() => {
    let t = 0;
    const off = signup.subscribe((st) => {
      if (st.done && !t) t = window.setTimeout(onclose, 1800);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  });

  $effect(() => {
    lastFocus = document.activeElement;
    return () => /** @type {HTMLElement | null} */ (lastFocus)?.focus?.();
  });

  // keep Tab inside the dialog while it's open; Escape closes it
  /** @param {KeyboardEvent} e */
  function keydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      return;
    }
    if (e.key !== 'Tab' || !dialogEl) return;
    const sel = 'button:not(:disabled), input:not([tabindex="-1"]):not(:disabled), a[href]';
    const f = /** @type {HTMLElement[]} */ ([...dialogEl.querySelectorAll(sel)]);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<!-- the backdrop click is a mouse shortcut; Escape and the two buttons are the
     keyboard ways out -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="tsp-overlay" role="presentation" onclick={onclose}>
  <div
    class="tsp"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tsp-title"
    tabindex="-1"
    bind:this={dialogEl}
    onkeydown={keydown}
    onclick={(e) => e.stopPropagation()}
  >
    <button class="tsp-x" type="button" aria-label="close" onclick={onclose}>x</button>
    <p class="tsp-title" id="tsp-title">are you a teenager?</p>
    <p class="tsp-line" id="tsp-line">hack club is an online community of 100,000 teenagers who make cool projects! enter your email to get an invite:</p>
    <TeenSignup {ref} autofocus inputId="tsp-email" labelledby="tsp-line" />
    <button class="tsp-skip" type="button" onclick={onclose}>just looking</button>
  </div>
</div>

<style>
  /* the /prizes item modal's look (overlay tint, modal9 9-slice, the tilt and
     the entrance), restated here since that CSS is scoped to the page */
  .tsp-overlay {
    position: fixed;
    inset: 0;
    z-index: 60; /* over the grain (50) */
    background: rgba(43, 40, 38, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(16px * var(--scale));
  }
  .tsp {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    max-width: calc(660px * var(--scale));
    max-height: 88svh;
    overflow: auto;
    font-size: var(--t-card);
    color: var(--ink);
    border: calc(48px * var(--scale)) solid transparent;
    border-image: url('/assets/modal9@8x.png?v=9') 192 fill repeat;
    image-rendering: pixelated;
    padding: calc(20px * var(--scale)) calc(28px * var(--scale)) calc(14px * var(--scale));
    transform: rotate(-0.6deg);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: calc(22px * var(--scale));
  }
  .tsp:focus {
    outline: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .tsp-overlay {
      animation: tsp-fade 0.22s ease-out;
    }
    .tsp {
      animation: tsp-in 0.16s ease-out;
    }
  }
  @keyframes tsp-fade {
    from {
      background-color: rgba(43, 40, 38, 0);
    }
  }
  @keyframes tsp-in {
    from {
      opacity: 0;
      transform: rotate(-0.6deg) translateY(8px);
    }
  }
  .tsp-title {
    margin: 0;
    padding-inline: calc(36px * var(--scale)); /* clear of the x */
    font-size: var(--t-title);
  }
  .tsp-line {
    margin: 0;
    line-height: 1.3;
    max-width: 34ch;
    text-wrap: balance;
  }
  .tsp-x {
    position: absolute;
    top: 0;
    right: 0;
    font-family: inherit;
    font-size: var(--t-card);
    color: var(--ink);
    background: none;
    border: none;
    padding: calc(14px * var(--scale)) calc(20px * var(--scale));
    opacity: 0.45;
    cursor: pointer;
  }
  .tsp-x:hover {
    opacity: 0.8;
  }
  /* the way out, in the page's faded ink (.fine / .suggest-note) */
  .tsp-skip {
    font-family: inherit;
    font-size: var(--t-card);
    color: rgba(80, 75, 73, 0.55);
    background: none;
    border: none;
    padding: calc(4px * var(--scale)) calc(8px * var(--scale));
    text-decoration: underline;
    cursor: pointer;
  }
  .tsp-skip:hover {
    color: var(--ink);
  }
  .tsp-x:focus-visible,
  .tsp-skip:focus-visible {
    outline: 2px solid #91a4db;
    outline-offset: 2px;
  }
</style>
