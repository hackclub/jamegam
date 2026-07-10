<script>
  import { onMount } from 'svelte';
  import { initFit } from '$lib/viewport.js';

  import Logo from '$lib/components/Logo.svelte';
  import Dust from '$lib/components/Dust.svelte';
  import BottomGlow from '$lib/components/BottomGlow.svelte';
  import TopGlow from '$lib/components/TopGlow.svelte';
  import EdgeDoodles from '$lib/components/EdgeDoodles.svelte';
  import Hero from '$lib/components/sections/Hero.svelte';
  import EmailSignup from '$lib/components/sections/EmailSignup.svelte';
  import ThisMonth from '$lib/components/sections/ThisMonth.svelte';
  import HowItWorks from '$lib/components/sections/HowItWorks.svelte';
  import Prizes from '$lib/components/sections/Prizes.svelte';
  import WhoIsBehind from '$lib/components/sections/WhoIsBehind.svelte';
  import Ready from '$lib/components/sections/Ready.svelte';
  import Questions from '$lib/components/sections/Questions.svelte';
  import Footer from '$lib/components/sections/Footer.svelte';

  import { SITE_URL } from '$lib/site.js';
  import { JAM } from '$lib/jam.js';
  import { FAQS } from '$lib/faqs.js';

  // ===== SEO: head metadata + structured data =====
  const canonical = `${SITE_URL}/`;
  const ogImage = `${SITE_URL}/og-image.png`;
  const title = 'jame gam - a community of teenage game devs, by hack club';
  const description =
    'a community of teenagers who enter game jams together, run by hack club. build a game, get prizes. free, international, no experience needed.';

  // FAQ answers carry inline HTML; flatten to plain text for the schema.
  const stripHtml = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // JSON-LD. note the Event describes jame gam's monthly community participation
  // (organizer: Hack Club), NOT the external jam itself, which we don't run.
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://hackclub.com/#organization',
        name: 'Hack Club',
        url: 'https://hackclub.com',
        description:
          "hack club is the 501(c)(3) nonprofit running jame gam, and an existing community of 50k teenagers internationally who are making technical projects of all kinds. there are events running all the time, and it's organized by teens, for teens.",
        sameAs: ['https://github.com/hackclub']
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'Jame Gam',
        url: canonical,
        description,
        publisher: { '@id': 'https://hackclub.com/#organization' }
      },
      {
        '@type': 'Event',
        '@id': `${SITE_URL}/#current-jam`,
        name: 'Jame Gam - July 2026 game jam',
        description:
          "Jame Gam's monthly community jam. This July, teenage game devs build games together while taking part in the GMTK Game Jam 2026. Free and online, open to ages 13 to 18, run by Hack Club.",
        startDate: JAM.startDate,
        endDate: JAM.endDate,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        location: { '@type': 'VirtualLocation', url: canonical },
        organizer: { '@id': 'https://hackclub.com/#organization' },
        isAccessibleForFree: true,
        typicalAgeRange: '13-18',
        url: canonical,
        image: ogImage
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((f) => ({
          '@type': 'Question',
          name: stripHtml(f.q),
          acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.a) }
        }))
      }
    ]
  };

  // escape "<" so the serialized JSON can't break out of the <script> tag.
  const jsonld = `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}<\/script>`;

  // page starts hidden behind the booting logo; the logo flips this once it
  // has flown in and shrunk into the top slot.
  let booting = $state(true);

  // dev-only column guides: visit ?debug to overlay the middle-column bounds.
  let debug = $state(false);

  onMount(() => {
    initFit();
    debug = new URLSearchParams(location.search).has('debug');
  });
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="jame gam" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="640" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />

  {@html jsonld}
</svelte:head>

<div id="wrap">
  <!-- faint rainbow glow pinned to the bottom of the viewport, behind all
       content; visible only at the top of the page (fades out on scroll) -->
  <BottomGlow {booting} />
  <!-- subtler companion glow in the top corners; same fade-on-scroll behaviour -->
  <TopGlow {booting} />

  <div id="page" class:booting>

    <!-- animated logo (sibling of content so it sits above during boot) -->
    <Logo setBooting={(b) => (booting = b)} />

    <div id="content">
      <!-- faint hand-drawn doodles down the page edges, BELOW all content
           (first child so it paints under #dust + every section; lives inside
           #content so it fades in with the boot reveal instead of during it). -->
      <EdgeDoodles />
      <!-- live drifting dust particles behind everything (was a static baked PNG
           of the dust field; restored to the original animated canvas). Absolute
           full-document layer, z-index 0 — scrolls WITH the page and fades in
           with the boot reveal, like the baked version it replaces. -->
      <Dust />

      <!-- first screen / above the fold: hero + email signup are ONE block,
           centred & nudged up; the next section (ThisMonth) peeks below it. -->
      <div id="first-screen">
        <Hero />
        <EmailSignup />
      </div>
      <ThisMonth />
      <HowItWorks />
      <Prizes />
      <WhoIsBehind />
      <Ready />
      <Questions />
      <Footer />
    </div>

    <!-- grain over the whole page width+height (inside #page so height:100%
         resolves to the full document, not just the first viewport) -->
    <div id="noise"></div>
  </div>
</div>

<!-- dev-only column guides (?debug). Fixed + pointer-events:none, so they
     overlay the page without affecting layout: solid lines = column max-width
     (752px), dashed = content edges (inside the 24px gutter), center hairline. -->
{#if debug}
  <div class="dbg" aria-hidden="true">
    <div class="dbg-colmax"><div class="dbg-content"></div></div>
    <div class="dbg-center"></div>
  </div>
{/if}

<style>
  .dbg {
    position: fixed; inset: 0;
    z-index: 9999;
    pointer-events: none;
    display: flex;
    justify-content: center;
  }
  /* column max-width band (752px) — solid magenta edges */
  .dbg-colmax {
    width: 100%;
    max-width: var(--col);
    height: 100%;
    box-sizing: border-box;
    padding-inline: var(--col-pad);
    border-left: 1px solid rgba(255, 0, 200, 0.6);
    border-right: 1px solid rgba(255, 0, 200, 0.6);
    background: rgba(255, 0, 200, 0.04);
  }
  /* content edges (inside the gutter) — dashed cyan */
  .dbg-content {
    height: 100%;
    border-left: 1px dashed rgba(0, 160, 255, 0.7);
    border-right: 1px dashed rgba(0, 160, 255, 0.7);
  }
  /* viewport center hairline */
  .dbg-center {
    position: absolute;
    left: 50%; top: 0; bottom: 0;
    border-left: 1px dashed rgba(0, 0, 0, 0.35);
  }
</style>
