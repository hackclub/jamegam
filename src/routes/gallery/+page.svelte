<script>
  // The gallery: every approved game from every jame gam, on one wall. Pure
  // showcase - each card is just a link to the game's itch page. The visual
  // vocabulary is the prize shop's (tiles + lumpy hover skins + edge doodles),
  // with the picked-card tilt on the cover art so the wall hangs a bit crooked.
  import { onMount } from 'svelte';
  import { jiggle } from '$lib/actions/jiggle.js';
  import Dust from '$lib/components/Dust.svelte';

  let { data } = $props();

  // same recipe as the shop's edge doodles: ink-recolored, faint, pinned near
  // the viewport edges, distributed down the whole document by --top %.
  // The shop's list is a hand-written five, which is fine for a page of known
  // length - the gallery grows a row per ~3 games, so the count comes from the
  // page instead: one doodle per SPACING px of document, alternating sides.
  const ART = ['dino', 'star', 'duck', 'fish', 'dog', 'cat', 'bird', 'present', 'fries', 'jester'];
  const SPACING = 900; // css px of document per doodle

  // deterministic per-index so SSR and hydration agree (no Math.random here)
  function doodleAt(i) {
    let h = Math.imul(i + 1, 2654435761) >>> 0;
    const pick = (n) => {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      return h % n;
    };
    return {
      i,
      src: ART[(i + pick(ART.length)) % ART.length],
      side: i % 2 ? 'right' : 'left',
      edge: -(40 + pick(50)),
      w: 220 + pick(5) * 25
    };
  }

  // count follows the document height, remeasured on resize (the grid reflows
  // from 3-up to 1-up, which changes the page length a lot)
  let doodleCount = $state(5);
  function recount() {
    const h = document.documentElement.scrollHeight;
    doodleCount = Math.max(4, Math.min(60, Math.round(h / SPACING)));
  }
  const DOODLES = $derived(
    Array.from({ length: doodleCount }, (_, i) => {
      const d = doodleAt(i);
      // spread evenly down the document, nudged off the exact edges
      return { ...d, top: `${(((i + 0.5) / doodleCount) * 96 + 2).toFixed(2)}%` };
    })
  );

  // a stable "random" tilt per game (hash of its key, so the wall doesn't
  // reshuffle its crookedness on hydration or reload)
  function rotOf(s) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
    return ((((h % 5) + 5) % 5) - 2) * 0.9; // -1.8..1.8 deg
  }

  // games with no thumbnail at all get a faint doodle in the frame instead
  const PLACEHOLDERS = ['dino', 'duck', 'fish', 'star', 'present', 'cat'];
  function placeholderOf(s) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
    return PLACEHOLDERS[((h % PLACEHOLDERS.length) + PLACEHOLDERS.length) % PLACEHOLDERS.length];
  }

  // each card gets one of the 3 lumpy hover skins, re-rolled every page load.
  // Assigned client-side only (random would mismatch SSR); pre-JS they all
  // fall back to variant a.
  let hoverVar = $state({});
  onMount(() => {
    const v = {};
    for (const g of data.games ?? []) v[g.key] = 'abc'[Math.floor(Math.random() * 3)];
    hoverVar = v;

    // the covers are lazy and mostly unsized, so the page keeps growing as they
    // land - recount on load and on resize rather than just once
    recount();
    const ro = new ResizeObserver(recount);
    ro.observe(document.body);
    addEventListener('resize', recount);
    return () => {
      ro.disconnect();
      removeEventListener('resize', recount);
    };
  });

  // the loader splits the wall by jam; fall back to one unlabelled section so
  // an older cached payload (or a hand-built one) still renders
  const sections = $derived(
    data.sections ?? (data.games?.length ? [{ key: 'all', title: '', games: data.games }] : [])
  );
</script>

<svelte:head>
  <title>gallery - jame gam</title>
  <meta name="description" content="every game made for a jame gam so far - go play them!" />
</svelte:head>

<main class="page" class:slim={!data.games || !data.games.length}>
  <div class="gallery-doodles" aria-hidden="true">
    {#each DOODLES as d (d.i)}
      <span class="ed {d.side}" style="--top:{d.top}; --edge:{d.edge}px; --w:{d.w}px;">
        <img src="/assets/doodle_{d.src}.png" alt="" />
      </span>
    {/each}
  </div>
  <div class="gallery-dust" aria-hidden="true"><Dust /></div>

  {#if !data.games}
    <section class="panel">
      <p class="lede">something broke on our end! refresh to try again, or ask in #jame-gam.</p>
    </section>
  {:else if !data.games.length}
    <header class="head">
      <h1 class="txt title big" use:jiggle={{ underlineBrush: 6.4 }}>gallery</h1>
    </header>
    <section class="panel">
      <p class="lede">
        nothing on the wall yet! the first games show up right after the next jam :)
      </p>
    </section>
  {:else}
    <header class="head sunk">
      <h1 class="txt title big" use:jiggle={{ underlineBrush: 6.4 }}>gallery</h1>
      <p class="lede center intro2">here are some of the games made for jame gam!</p>
      <p class="lede center intro2 sub">click one to go play it (in no particular order)</p>
    </header>

    <!-- newest jam first, then everything before it. Each section gets the same
         wall; only the heading above it changes. -->
    {#each sections as s (s.key)}
      <!-- the wrapper owns the gap above the heading so the link itself can
           shrink-wrap the words - otherwise hovering the empty space above a
           jam name would light up its underline. The link wraps the heading
           rather than sitting inside it: jiggle rewrites the h2's contents into
           letter spans, so an anchor in there would be thrown away. -->
      <div class="sect-wrap">
        {#if s.href}
          <a class="sect-link" href={s.href} target="_blank" rel="noopener">
            <h2 class="sect" use:jiggle>{s.title}</h2>
          </a>
        {:else}
          <h2 class="sect" use:jiggle>{s.title}</h2>
        {/if}
      </div>
      <ul class="grid">
        {#each s.games as g (g.key)}
          <!-- the cover link stretches over the whole card (its ::after); the
               author links sit above the stretch so they stay clickable -->
          <li
            class="tile"
            style="--h9:url('/assets/hover9_{hoverVar[g.key] ?? 'a'}@8x.png'); --rot:{rotOf(g.key)}deg"
          >
            <a class="card-link" href={g.url} target="_blank" rel="noopener">
              <span class="thumb">
                {#if g.thumb}
                  <img src={g.thumb} alt="" loading="lazy" />
                {:else}
                  <img class="ph" src="/assets/doodle_{placeholderOf(g.key)}.png" alt="" loading="lazy" />
                {/if}
              </span>
              <span class="name">{g.title}</span>
            </a>
            {#if g.authors.length}
              <p class="by">
                by
                {#each g.authors as a, i (a.name)}
                  {#if i}{' + '}{/if}
                  {#if a.slackId}
                    <a
                      class="who"
                      href="https://hackclub.slack.com/team/{a.slackId}"
                      target="_blank"
                      rel="noopener">{a.name}</a
                    >
                  {:else}
                    <span>{a.name}</span>
                  {/if}
                {/each}
              </p>
            {/if}
          </li>
        {/each}
      </ul>
    {/each}

    <p class="join-note">
      wanna see your game up here? <a href="/">join the next jam!</a>
    </p>
  {/if}
</main>

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  /* ===== edge doodles + dust: full-bleed breakout layers, straight from the
     prize shop ===== */
  .gallery-doodles,
  .gallery-dust {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 100vw;
    transform: translateX(-50%);
    z-index: -1;
    pointer-events: none;
  }
  .ed {
    position: absolute;
    top: var(--top);
    width: calc(var(--w) * var(--scale));
    opacity: 0.05;
  }
  .ed.left {
    left: calc(var(--edge) * var(--scale));
  }
  .ed.right {
    right: calc(var(--edge) * var(--scale));
  }
  .ed img {
    display: block;
    width: 100%;
    height: auto;
  }
  @media (max-width: 1359px) {
    .ed {
      opacity: 0.022;
    }
  }

  .page {
    /* wider than the shop's column: the covers are the point here */
    max-width: calc(1120px * var(--scale));
    margin: 0 auto;
    position: relative;
    z-index: 1;
    padding: calc(48px * var(--scale)) var(--col-pad) calc(64px * var(--scale));
    box-sizing: border-box;
    color: var(--ink);
    font-size: var(--t-card);
    display: flex;
    flex-direction: column;
    min-height: 100svh;
  }
  .page.slim .panel {
    margin-block: auto;
  }

  .head {
    text-align: center;
    margin-bottom: calc(36px * var(--scale));
  }
  .head.sunk {
    margin-top: calc(12.5svh - 48px * var(--scale));
  }
  .title {
    font-size: var(--t-title);
    font-weight: normal;
  }
  .title.big {
    font-size: calc(64px * var(--scale));
  }
  .lede {
    margin: 0;
    line-height: 1.35;
    max-width: 65ch;
  }
  .lede.center {
    text-align: center;
    margin: 0 auto;
    display: block;
  }
  .lede.center.intro2 {
    margin: calc(64px * var(--scale)) auto 0;
    max-width: var(--col);
    line-height: 1.05;
  }
  /* the second intro line hangs right under the first, quieter */
  .lede.center.intro2.sub {
    margin-top: calc(12px * var(--scale));
    color: rgba(80, 75, 73, 0.55);
  }

  .panel {
    max-width: calc(560px * var(--scale));
    margin: 0 auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(18px * var(--scale));
  }

  /* ===== section headings ===== */
  /* one per jam, and they have to survive being read after scrolling past ~35
     rows of cards - hence the size and the big air above the break. */
  /* the gap above a heading lives on the wrapper, never on the link, so the
     hover target is only the words */
  .sect-wrap {
    margin-top: calc(160px * var(--scale));
    text-align: center;
  }
  .sect {
    /* fit-content so the hover rule is exactly as wide as the words - the
       screen-reader copy is absolutely positioned and adds nothing here */
    width: fit-content;
    margin: 0 auto calc(40px * var(--scale));
    padding-bottom: calc(1px * var(--scale));
    /* reserved at rest so hovering doesn't shift the wall down */
    border-bottom: calc(5px * var(--scale)) solid transparent;
    font-size: calc(44px * var(--scale));
    font-weight: normal;
    line-height: 1.05;
    text-align: center;
  }
  .sect:empty {
    display: none;
  }
  /* each heading links to that jam's itch page - inline-block so it hugs the
     text rather than spanning the column */
  .sect-link {
    display: inline-block;
    color: inherit;
    text-decoration: none;
  }
  /* a border, not text-decoration: jiggle splits the heading into inline-block
     letter spans, and an ancestor's text-decoration skips atomic boxes like
     those - it only drew in the gaps between words */
  .sect-link:hover .sect,
  .sect-link:focus-visible .sect {
    border-bottom-color: rgba(80, 75, 73, 0.55);
  }

  /* ===== the wall ===== */
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    /* 3-up at full width - big covers, room for the words underneath */
    grid-template-columns: repeat(auto-fill, minmax(calc(300px * var(--scale)), 1fr));
    gap: calc(26px * var(--scale)) calc(16px * var(--scale));
  }
  /* the prize-tile anatomy as a link, but a proper card: the lumpy 9-slice
     skin (one of 3 via --h9, rolled per load) is always on, the cover fills
     the top, the words hang left-aligned below */
  .tile {
    position: relative;
    z-index: 0;
    box-sizing: border-box;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(14px * var(--scale));
    font-size: var(--t-card);
    color: var(--ink);
    text-align: left;
    padding: calc(22px * var(--scale)) calc(20px * var(--scale)) calc(20px * var(--scale));
  }
  .tile::before {
    content: '';
    position: absolute;
    inset: calc(4px * var(--scale));
    z-index: -1;
    pointer-events: none;
    border: calc(20px * var(--scale)) solid transparent;
    border-image: var(--h9, url('/assets/hover9_a@8x.png')) 80 fill stretch;
    image-rendering: pixelated;
  }
  /* hover: the slab darkens (the shop's selected-tile treatment) and the
     whole card leans into its cover's tilt - an instant snap, no easing */
  .tile:hover,
  .tile:has(:focus-visible) {
    transform: rotate(calc(var(--rot, 0deg) * 0.4));
  }
  .tile:hover::before,
  .tile:has(:focus-visible)::before {
    filter: brightness(0.93);
  }

  /* cover + title are the game link; its ::after stretches the click target
     over the whole card, and the .who links ride above it */
  .card-link {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(14px * var(--scale));
    width: 100%;
    color: inherit;
    text-decoration: none;
  }
  .card-link::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  /* the cover art hangs at a stable per-game tilt (--rot from the game's url) */
  .thumb {
    width: 100%;
    aspect-ratio: 63 / 50; /* itch cover art is 630x500 */
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(var(--rot, 0deg));
  }
  /* shrink-wrap instead of object-fit so the element hugs the picture and the
     lumpy mask below always sits on the picture's actual edges; covers keep
     their own aspect ratio, nothing crops */
  .thumb img {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    /* the card skin's silhouette as a 9-slice mask: hover9_a cut into cells
       (static/assets/mask9_*, from `magick hover9_a.png -crop 10x10+X+Y`),
       corners pinned, edge lumps stretched, solid centre - so the cover's
       edges wobble exactly like the slab it sits on. mask-border would be the
       one-liner but Firefox doesn't have it; layered masks work everywhere.
       --mb matches the slab: 10 art px at 2 css px per art px. */
    --mb: calc(20px * var(--scale));
    /* layers overlap half a cell into their neighbours (the inner half of
       every cell is solid) - exact abutment leaves hairline seams where the
       layer edges antialias */
    mask:
      url('/assets/mask9_tl@8x.png') 0 0 / var(--mb) var(--mb) no-repeat,
      url('/assets/mask9_tr@8x.png') 100% 0 / var(--mb) var(--mb) no-repeat,
      url('/assets/mask9_bl@8x.png') 0 100% / var(--mb) var(--mb) no-repeat,
      url('/assets/mask9_br@8x.png') 100% 100% / var(--mb) var(--mb) no-repeat,
      url('/assets/mask9_t@8x.png') calc(var(--mb) / 2) 0 / calc(100% - var(--mb)) var(--mb) no-repeat,
      url('/assets/mask9_b@8x.png') calc(var(--mb) / 2) 100% / calc(100% - var(--mb)) var(--mb) no-repeat,
      url('/assets/mask9_l@8x.png') 0 calc(var(--mb) / 2) / var(--mb) calc(100% - var(--mb)) no-repeat,
      url('/assets/mask9_r@8x.png') 100% calc(var(--mb) / 2) / var(--mb) calc(100% - var(--mb)) no-repeat,
      linear-gradient(#fff 0 0) calc(var(--mb) / 2) calc(var(--mb) / 2) / calc(100% - var(--mb))
        calc(100% - var(--mb)) no-repeat;
  }
  /* no cover anywhere: a faint doodle holds the frame (no mask - it's already
     hand-drawn line art) */
  .thumb img.ph {
    width: 55%;
    opacity: 0.14;
    mask: none;
  }

  .name {
    line-height: 1.05;
    overflow-wrap: anywhere; /* one-word titles longer than the card */
  }
  /* deemphasis via opacity, never size; tight under the name (one pair) */
  .by {
    margin: calc(-8px * var(--scale)) 0 0;
    line-height: 1.15;
    opacity: 0.5;
    overflow-wrap: anywhere;
  }
  /* each name links to the maker's slack profile: quiet at rest, underline on
     hover; raised above the cover link's stretch overlay so they win the click */
  .who {
    position: relative;
    z-index: 1;
    color: inherit;
    text-decoration: none;
  }
  a.who:hover,
  a.who:focus-visible {
    text-decoration: underline;
  }

  .join-note {
    margin: calc(44px * var(--scale)) 0 0;
    text-align: center;
    color: rgba(80, 75, 73, 0.55);
  }
</style>
