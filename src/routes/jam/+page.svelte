<script>
  // /jam - the jam's front door. Signs the visitor up (Slack channels, Airtable,
  // welcome email) and forwards them to this month's itch page:
  //   - signed in to Hack Club already: whoami hands us their email, POST it to
  //     /api/signup (source=join, so existing signups still get re-invited),
  //     then forward
  //   - otherwise: "Sign in with Hack Club" (flow=join); the callback does the
  //     signup and sends them back here with ?done=1, and we forward
  // The forward is a client-side navigation from this origin on purpose, so
  // itch sees jamegam.hackclub.com as the referrer (a 302 chain from HCA would
  // carry auth.hackclub.com or nothing). utm_source rides along as well.
  import { onMount } from 'svelte';
  import { JAM } from '$lib/jam.js';
  import { loadPrefill } from '$lib/prefill.js';
  import Dust from '$lib/components/Dust.svelte';
  import BottomGlow from '$lib/components/BottomGlow.svelte';

  const target = new URL(JAM.itchUrl);
  target.searchParams.set('utm_source', 'jamegam');
  target.searchParams.set('utm_medium', 'jam');
  const jamUrl = target.toString();

  // resolves to fallback after ms, so a hung request can't strand them here
  const within = (promise, ms, fallback) =>
    Promise.race([promise, new Promise((r) => setTimeout(() => r(fallback), ms))]);

  onMount(async () => {
    if (new URLSearchParams(location.search).has('done')) {
      location.replace(jamUrl);
      return;
    }

    const email = await within(loadPrefill(), 4000, '');
    if (!email) {
      location.replace('/api/auth/login?flow=join');
      return;
    }

    await within(
      fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'join' }),
        keepalive: true
      }).catch(() => null),
      8000,
      null
    );
    location.replace(jamUrl);
  });
</script>

<svelte:head>
  <title>joining {JAM.displayName} - jame gam</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<BottomGlow pinned />

<main class="join">
  <div class="join-dust" aria-hidden="true"><Dust /></div>
  <div class="join-inner">
    <p class="txt join-msg">taking you to the jam...</p>
    <p class="join-link"><a href={jamUrl}>not moving? click here</a></p>
  </div>
</main>

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  .join {
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
  .join-dust {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .join-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--scale));
    margin-bottom: calc(64px * var(--scale));
  }
  .join-msg {
    margin: 0;
    font-size: var(--t-title);
  }
  .join-link {
    margin: calc(22px * var(--scale)) 0 0;
  }
</style>
