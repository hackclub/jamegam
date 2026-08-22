<script>
  // as nothing as possible: type an order number, see its status. logic is all
  // server-side in +page.server.js / $lib/server/apliiq.js. styled to match the
  // rest of the site - the error page's centered shell (dust + pinned bottom
  // glow), the landing email box for the input, and the prize-shop order button.
  import { jiggle } from '$lib/actions/jiggle.js';
  import Dust from '$lib/components/Dust.svelte';
  import BottomGlow from '$lib/components/BottomGlow.svelte';

  let { data } = $props();
  const r = $derived(data.result);
</script>

<svelte:head>
  <title>track your shirt - jame gam</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<BottomGlow pinned />

<main class="page">
  <div class="page-dust" aria-hidden="true"><Dust /></div>

  <div class="inner">
    <!-- "shirt" keeps the extra wiggle + rainbow graze-flash, minus the
         underline (the same opt-out the landing's prizes-section title uses) -->
    <h1 class="txt title" use:jiggle={{ prizeWord: 'shirt', underline: false }}>track your shirt</h1>

    <!-- the lookup: sketch input box + button9 slab, same vocabulary as the
         landing email signup and the prize-shop order button -->
    <form class="lookup" method="GET">
      <span class="field">
        <input name="order" inputmode="numeric" placeholder="order number" value={data.order} autocomplete="off" />
      </span>
      <button class="cta" type="submit">check</button>
    </form>

    {#if r}
      <div class="result">
        {#if r.configured === false}
          <p class="lede">tracking is unavailable right now</p>
        {:else if r.error}
          <p class="lede">couldn't check just now, try again in a sec</p>
        {:else if !r.found}
          <p class="lede">no order found with that number</p>
        {:else if r.tracking}
          <!-- has a tracking number, so it's shipped - never show apliiq's raw
               status text, just the friendly line + the number -->
          <p class="lede">order #{data.order} is on its way!</p>
          <p class="fine">
            tracking: {#if r.trackingUrl}<a href={r.trackingUrl} target="_blank" rel="noreferrer">{r.tracking}</a>{:else}{r.tracking}{/if}{#if r.carrier} ({r.carrier}){/if}
          </p>
        {:else}
          <p class="lede">order #{data.order} is being made!</p>
          <p class="fine">no tracking yet{#if r.expected}, estimated arrival by {r.expected}{/if}</p>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  /* the error page's centered shell: full-height, text above the pinned glow */
  .page {
    position: relative;
    z-index: 2; /* text above the fixed rainbow glow (z-index 1) */
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--col-pad);
    box-sizing: border-box;
    color: var(--ink);
    font-size: var(--t-card);
    text-align: center;
  }
  .page-dust {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(20px * var(--scale));
    max-width: calc(480px * var(--scale));
    /* the glow rises from the bottom; lift the block a touch above centre */
    margin-bottom: calc(64px * var(--scale));
  }
  .title {
    margin: 0;
    font-size: var(--t-title);
    font-weight: normal;
    line-height: 1.1;
  }

  /* input box + "check" button, side by side (mirrors .email-field) */
  .lookup {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: calc(10px * var(--scale));
    max-width: 100%;
  }
  /* the sketch box background with a real input laid transparently over it
     (the landing email box). Grown taller than the native 282x46 art so the
     full-size body type fits - the sketch box stretches a touch vertically. */
  .field {
    flex: none;
    width: calc(282px * var(--scale));
    max-width: 100%;
    height: calc(60px * var(--scale));
    background: url('/assets/box542.png') no-repeat center / 100% 100%;
  }
  .field input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    outline: 0;
    font-family: 'augiepixel', sans-serif;
    font-size: var(--t-card);
    color: #7a7470;
    text-align: center;
    padding: 0 calc(16px * var(--scale));
  }
  .field input::placeholder {
    color: #d9d4d8;
    opacity: 1;
  }

  /* "check" - the button9 9-slice slab from the prize-shop order button */
  .cta {
    flex: none;
    font-family: inherit;
    font-size: var(--t-card);
    color: #fbfbfb;
    line-height: 1;
    background: none;
    border: calc(16px * var(--scale)) solid transparent;
    border-image: url('/assets/button9@8x.png?v=1') 80 fill stretch;
    image-rendering: pixelated;
    padding: 0 calc(10px * var(--scale));
    cursor: pointer;
    opacity: 0.85;
  }
  .cta:hover {
    opacity: 1;
  }

  /* the answer: the status line full ink, the tracking/fine print faded (the
     shop's .lede / .fine pairing) */
  .result {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
  }
  .lede {
    margin: 0;
    line-height: 1.35;
  }
  .fine {
    margin: 0;
    color: rgba(80, 75, 73, 0.55);
    line-height: 1.35;
  }
  .result a {
    color: var(--accent);
  }

  /* narrow screens: the box + button stack, the box goes full width */
  @media (max-width: 479px) {
    .lookup {
      flex-direction: column;
      width: 100%;
    }
    .field {
      width: 100%;
    }
  }
</style>
