<script>
  // Error page: 404 (or whatever blew up), centered and wiggly like the logo,
  // over the ambient dust + the pinned bottom rainbow (no scroll behaviour).
  import { page } from '$app/state';
  import { jiggle } from '$lib/actions/jiggle.js';
  import Dust from '$lib/components/Dust.svelte';
  import BottomGlow from '$lib/components/BottomGlow.svelte';

  const is404 = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{page.status} - jame gam</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<BottomGlow pinned />

<main class="err">
  <div class="err-dust" aria-hidden="true"><Dust /></div>
  <div class="err-inner">
    <h1 class="txt err-code" use:jiggle={{ rainbow: true, jig: 1.4 }}>{page.status}</h1>
    <p class="txt err-sub" use:jiggle={{ rainbow: true, jig: 1.4 }}>
      {is404 ? 'page not found' : 'something went wrong'}
    </p>
    <p class="err-home"><a href="/">back home</a></p>
  </div>
</main>

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  .err {
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
  .err-dust {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .err-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--scale));
    /* the glow rises from the bottom; lift the text a touch above centre */
    margin-bottom: calc(64px * var(--scale));
  }
  .err-code {
    margin: 0;
    font-size: calc(128px * var(--scale));
    font-weight: normal;
    line-height: 1;
  }
  .err-sub {
    margin: 0;
    font-size: var(--t-title);
  }
  .err-home {
    margin: calc(22px * var(--scale)) 0 0;
  }
</style>
