<script>
  // The prize shop: post-jam, post-approval prize picking. All the real rules
  // live server-side (+page.server.js decides the state, /api/shop/order
  // re-validates everything); this page is just the picker.
  //
  // Pick flow: clicking any card opens a modal with a bit more info + the
  // order button (plus size for the tshirt; every order shows its shipping
  // address, since stickers + the patch ship physically with every prize).
  // Indie games accumulate instead: add up to GAME_PICK_COUNT in their modals,
  // and the modal flips to an order-confirm step when the last one is added.
  // An existing (unlocked) order shows as a "your pick" block at the top with
  // the full grid below it for switching.
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { jiggle } from '$lib/actions/jiggle.js';
  import { rainbowBorder } from '$lib/actions/rainbowBorder.js';
  import { PRIZE_GAMES, PRIZE_STUFF, PRIZE_HD, GAME_PICK_COUNT } from '$lib/prizes.js';
  import { TSHIRT_SIZES } from '$lib/shop.js';
  import Dust from '$lib/components/Dust.svelte';

  let { data } = $props();

  // ---- selection state (games accumulate; prizes order straight from the modal) ----
  let gamePicks = $state([]); // srcs, up to GAME_PICK_COUNT
  let shirtSize = $state('');
  let addressId = $state(null);
  let noPhysical = $state(false); // "don't ship me anything physical!"
  let modal = $state(null); // null | {kind:'item'|'game', p} | {kind:'games-confirm'|'address'}
  let modalEl = $state(null);
  let submitting = $state(false);
  let errorMsg = $state('');
  let now = $state(Date.now()); // ticks every second for the deadline countdown
  // with an order in place the grids collapse behind a "change my pick" link
  let browsing = $state(false);

  if (data.order?.type === 'games') {
    gamePicks = data.order.games
      .map((name) => PRIZE_GAMES.find((g) => g.name === name)?.src)
      .filter(Boolean);
  }
  if (data.order?.shirtSize) shirtSize = data.order.shirtSize;
  if (data.addresses?.length) {
    addressId = (data.addresses.find((a) => a.primary) || data.addresses[0]).id;
  }
  // fresh shopper: open on the shipping question, so every later modal can
  // skip the address picker entirely
  if (data.state === 'shop' && !data.locked && !data.order && data.addresses?.length) {
    modal = { kind: 'address' };
  }

  const address = $derived(data.addresses?.find((a) => String(a.id) === String(addressId)) ?? null);
  const currentPrizeSrc = $derived(
    data.order?.type === 'prize' ? (PRIZE_STUFF.find((p) => p.name === data.order.prize)?.src ?? null) : null
  );
  const pickNames = $derived(gamePicks.map((s) => PRIZE_GAMES.find((g) => g.src === s)?.name).filter(Boolean));
  // do the accumulated game picks differ from what's already ordered?
  const gamesDirty = $derived(
    data.order?.type !== 'games' ||
      JSON.stringify([...pickNames].sort()) !== JSON.stringify([...data.order.games].sort())
  );
  const orderedSrcs = $derived(
    data.order?.type === 'games'
      ? data.order.games.map((n) => PRIZE_GAMES.find((g) => g.name === n)?.src).filter(Boolean)
      : currentPrizeSrc
        ? [currentPrizeSrc]
        : []
  );

  function openModal(p) {
    errorMsg = '';
    modal = { kind: p.game ? 'game' : 'item', p };
  }
  function closeModal() {
    if (!submitting) modal = null;
  }
  function addGame(p) {
    if (gamePicks.length >= GAME_PICK_COUNT || gamePicks.includes(p.src)) return;
    gamePicks = [...gamePicks, p.src];
    // the last slot filled: flip straight into the confirm step
    modal = gamePicks.length === GAME_PICK_COUNT ? { kind: 'games-confirm' } : null;
  }
  function removeGame(p) {
    gamePicks = gamePicks.filter((s) => s !== p.src);
    modal = null;
  }
  // "nevermind": drop the in-progress game picks back to whatever's ordered
  function nevermindGames() {
    gamePicks =
      data.order?.type === 'games'
        ? data.order.games.map((n) => PRIZE_GAMES.find((g) => g.name === n)?.src).filter(Boolean)
        : [];
  }

  // the 2x-pixel-grid art where it exists (big spots only - the grid stays 1x)
  const hdSrc = (src) => `/assets/${PRIZE_HD.has(src) ? 'prizehd_' : 'prize_'}${src}.png`;

  // a stable "random" tilt per prize for the your-pick card (hash of the src,
  // so it doesn't reshuffle on hydration or reload)
  function rotOf(s) {
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
    return (((h % 9) + 9) % 9) - 4; // -4..4 deg
  }

  // "you have [3 days, 2 hours, 5 minutes, and 12 seconds] to pick your prize!"
  const countdown = $derived.by(() => {
    const s = Math.max(0, Math.floor((Date.parse(data.closesAt) - now) / 1000));
    const unit = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const parts = [];
    if (s >= 86400) parts.push(unit(Math.floor(s / 86400), 'day'));
    if (s >= 3600) parts.push(unit(Math.floor((s % 86400) / 3600), 'hour'));
    parts.push(unit(Math.floor((s % 3600) / 60), 'minute'));
    parts.push(unit(s % 60, 'second'));
    return parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
      : parts[0];
  });

  // "steampowered.com" from a store href, for the check-it-out line
  function domainOf(href) {
    try {
      return new URL(href).hostname.replace(/^www\./, '').replace(/^store\./, '');
    } catch {
      return href;
    }
  }

  async function placeOrder(body) {
    if (submitting) return;
    submitting = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/shop/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || 'something went wrong. try again?');
      // committing to a prize drops any in-progress game picks (and vice versa
      // the games order simply becomes the pick)
      if (body.type === 'prize') gamePicks = [];
      modal = null;
      browsing = false; // collapse the grids back behind "change my pick"
      await invalidateAll(); // re-pull the order so the "your pick" block reflects it
      scrollTo({ top: 0, behavior: 'smooth' }); // the result lands at the top
    } catch (e) {
      errorMsg = e.message;
    }
    submitting = false;
  }
  const orderPrize = (p) =>
    placeOrder({ type: 'prize', prize: p.src, shirtSize: shirtSize || undefined, addressId, noPhysical });
  const orderGames = () => placeOrder({ type: 'games', games: gamePicks, addressId, noPhysical });

  // closing the shipping modal: with an order already placed, re-save it so
  // the new address/no-physical choice actually lands on the order
  async function confirmAddress() {
    if (!data.order) {
      modal = null;
      return;
    }
    await placeOrder(
      data.order.type === 'games'
        ? { type: 'games', games: orderedSrcs, addressId, noPhysical }
        : {
            type: 'prize',
            prize: currentPrizeSrc,
            shirtSize: data.order.shirtSize || undefined,
            addressId,
            noPhysical
          }
    );
  }

  // panel-only states hold a paragraph or two; centre those vertically. The
  // pick UI is a normal top-to-bottom document scroll.
  const slim = $derived(data.state !== 'shop' || !!data.locked);

  // "june", from the shop's jam label ('2026-06') - for copy, instead of the raw label
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const jamMonth = $derived(MONTHS[(parseInt(data.jam?.split('-')[1], 10) || 0) - 1] ?? data.jam);

  // edge doodles, a different scatter per page state (same recipe as the
  // landing EdgeDoodles: ink-recolored, faint, pinned near the viewport edges).
  // top is % of the viewport, edge/w are px (scaled by --scale in the CSS).
  const DOODLES = {
    signedout: [
      { src: 'dino', side: 'left', top: '14%', edge: -70, w: 300 },
      { src: 'duck', side: 'right', top: '64%', edge: -60, w: 240 }
    ],
    nosubmission: [
      { src: 'fish', side: 'right', top: '24%', edge: -40, w: 220 },
      { src: 'cat', side: 'left', top: '68%', edge: -90, w: 360 }
    ],
    pending: [
      { src: 'duck', side: 'left', top: '18%', edge: -60, w: 240 },
      { src: 'fries', side: 'right', top: '70%', edge: -50, w: 200 }
    ],
    rejected: [
      { src: 'jester', side: 'right', top: '30%', edge: -70, w: 260 },
      { src: 'fish', side: 'left', top: '58%', edge: -40, w: 220 }
    ],
    noaddress: [
      { src: 'antenna', side: 'left', top: '10%', edge: -100, w: 340 },
      { src: 'duck', side: 'right', top: '70%', edge: -60, w: 240 }
    ],
    closed: [
      { src: 'bird', side: 'right', top: '14%', edge: -60, w: 240 },
      { src: 'stove', side: 'left', top: '66%', edge: -110, w: 340 }
    ],
    error: [
      { src: 'face', side: 'right', top: '30%', edge: -180, w: 420 },
      { src: 'antenna', side: 'left', top: '72%', edge: -90, w: 300 }
    ],
    shop: [
      { src: 'present', side: 'left', top: '20%', edge: -70, w: 300 },
      { src: 'hackclub', side: 'right', top: '44%', edge: -10, w: 300 },
      { src: 'star', side: 'left', top: '66%', edge: -60, w: 260 },
      { src: 'dog', side: 'right', top: '86%', edge: -80, w: 320 }
    ],
    summary: [
      { src: 'present', side: 'left', top: '22%', edge: -75, w: 280 },
      { src: 'dino', side: 'right', top: '68%', edge: -85, w: 300 }
    ]
  };
  const doodles = $derived(
    DOODLES[data.state === 'shop' ? (data.locked ? 'summary' : 'shop') : data.state] ?? []
  );

  // each card gets one of the 3 lumpy hover skins, re-rolled every page load.
  // Assigned client-side only (random would mismatch SSR); pre-JS they all
  // fall back to variant a.
  let hoverVar = $state({});
  onMount(() => {
    const v = {};
    for (const p of [...PRIZE_STUFF, ...PRIZE_GAMES]) v[p.src] = 'abc'[Math.floor(Math.random() * 3)];
    hoverVar = v;

    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(tick);
  });

  // focus the dialog when it opens (so esc + tabbing start inside it)
  $effect(() => {
    if (modal && modalEl) modalEl.focus();
  });
</script>

<svelte:head>
  <title>prizes - jame gam</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<svelte:window onkeydown={(e) => e.key === 'Escape' && closeModal()} />

<main class="page" class:slim>
  <!-- faint edge doodles, same recipe as the landing page's EdgeDoodles layer:
       recolored to ink, pinned near the viewport edges, faint - and fainter
       once the screen is narrow enough that they'd crowd the centre column
       (media query here instead of EdgeDoodles' JS geometry test). The layer
       lives inside .page and spans its full height, so the doodles' --top %
       distributes them down the whole document, exactly like the landing. -->
  <div class="shop-doodles" aria-hidden="true">
    {#each doodles as d (d.src)}
      <span class="ed {d.side}" style="--top:{d.top}; --edge:{d.edge}px; --w:{d.w}px;">
        <img src="/assets/doodle_{d.src}.png" alt="" />
      </span>
    {/each}
  </div>

  <!-- ambient dust motes, same full-bleed breakout as the doodle layer -->
  <div class="shop-dust" aria-hidden="true"><Dust /></div>

  {#if data.state === 'signedout'}
    <!-- signed out: just the title + the sign-in button, centered together -->
    <section class="panel">
      <!-- underlineBrush: the landing line is 4 art-px under 40px type; keep the
           thickness proportional to this 64px title (4 * 64/40) -->
      <h1 class="txt title big" use:jiggle={{ underlineBrush: 6.4 }}>prizes</h1>
      {#if data.authError}
        <p class="err">that sign-in didn't go through, give it another try!</p>
      {/if}
      <a class="signin" href="/api/auth/login?flow=shop">
        <img src="/assets/signin.png" alt="sign in with hack club" />
      </a>
      {#if data.closed}
        <p class="fine">heads up: the shop for the {jamMonth} jam has closed!</p>
      {/if}
    </section>
  {:else if data.state === 'nosubmission'}
    <section class="panel">
      <p class="lede">
        hm, no {jamMonth} jam submission under {data.me.email}. if you submitted with a different
        email, <a href="/api/auth/logout">sign out</a> and use that one. otherwise, dm @augie on
        slack and i'll sort it out.
      </p>
    </section>
  {:else if data.state === 'pending'}
    <section class="panel">
      <p class="lede">
        your submission for {jamMonth} was received, but hasn't been reviewed yet! you'll get a DM
        once it's approved :)
      </p>
    </section>
  {:else if data.state === 'rejected'}
    <section class="panel">
      <p class="lede">
        i couldn't approve your submission this time, so there's no prize pick here. if that seems
        wrong, dm @augie on slack and i'll take another look!
      </p>
    </section>
  {:else if data.state === 'noaddress'}
    <section class="panel addr-need">
      <p class="lede">
        your game{data.gameTitles.length ? ` "${data.gameTitles[0]}"` : ''} is approved! before you
        can pick a prize, you need to set your mailing address on
        <a href="https://auth.hackclub.com/addresses" target="_blank" rel="noopener">auth.hackclub.com/addresses</a>
      </p>
      <p class="lede">once it's set, come back and sign in again so i can grab it fresh.</p>
      <a class="go" href="/api/auth/login?flow=shop">i added it, check again</a>
    </section>
  {:else if data.state === 'closed'}
    <section class="panel">
      <p class="lede">
        the shop for the {jamMonth} jam closed {data.closesText}! dm @augie on slack if you forgot
        to pick a prize or if you have questions
      </p>
    </section>
  {:else if data.state === 'error'}
    <section class="panel">
      <p class="lede">something broke on our end! refresh to try again, or ask in #jame-gam.</p>
    </section>
  {:else if data.state === 'shop'}
    {#if data.locked}
      <!-- locked order: the rainbow your-pick card, read-only (no address
           link, no change-my-pick). a canceled order collapses to one line. -->
      {#if data.order.status === 'canceled'}
        <section class="panel">
          <p class="lede">
            your order for {jamMonth} was cancelled, dm @augie if that sounds wrong!
          </p>
        </section>
      {:else}
        <section class="picked">
          <div class="picked-card" class:stack={orderedSrcs.length > 1}>
            <div
              class="picked-border rainbow-box"
              use:rainbowBorder={{ bleed: 8, notch: false }}
              aria-hidden="true"
            ></div>
            <div class="picked-fig" class:multi={orderedSrcs.length > 1}>
              {#each orderedSrcs as src (src)}
                <span class="pk-sq" style="--rot:{rotOf(src)}deg">
                  <img src={hdSrc(src)} alt="" />
                </span>
              {/each}
            </div>
            <div class="picked-info">
              <p class="picked-label">your pick:</p>
              <p class="picked-name">
                {data.order.type === 'games'
                  ? data.order.games.join(', ')
                  : data.order.prize + (data.order.shirtSize ? ` (${data.order.shirtSize})` : '')}
              </p>
              <p class="fine">
                ships to: {data.order.address.line1}{data.order.address.line2
                  ? `, ${data.order.address.line2}`
                  : ''}, {data.order.address.city}{data.order.address.region
                  ? `, ${data.order.address.region}`
                  : ''}
                {data.order.address.postal}, {data.order.address.country}
              </p>
              <p class="fine">
                {data.order.status === 'fulfilled'
                  ? `your prize for ${jamMonth} has been marked as fulfilled!`
                  : data.order.status === 'processing'
                    ? `your prize for ${jamMonth} is being fulfilled!`
                    : `the shop for ${jamMonth} has closed!`}
              </p>
            </div>
          </div>
        </section>
      {/if}
    {:else}
      <!-- ===== the pick UI (whole page scrolls; nothing sticky) ===== -->

      <!-- the title always leads, ~1/8 down the first screen -->
      <header class="head sunk">
        <h1 class="txt title big" use:jiggle={{ underlineBrush: 6.4 }}>prizes</h1>
        <p class="lede center intro2">
          along with every prize, you'll be shipped stickers and a custom patch.
        </p>
        <p class="lede center intro2 countdown">
          you have <span class="cd-time">{countdown}</span> to pick your prize!
        </p>
        <!-- shipping note lives in the your-pick card once an order exists -->
        {#if address && !data.order}
          <p class="ship-note">
            {#if !noPhysical}shipping to{/if}
            <button class="addr-edit" type="button" onclick={() => (modal = { kind: 'address' })}>
              {noPhysical
                ? 'not shipping you anything physical'
                : `${address.line1}, ${address.city}`}<img class="pencil" src="/assets/pencil.png" alt="" />
            </button>
          </p>
        {/if}
      </header>

      {#if data.order}
        <!-- existing order: a rainbow-bordered card between the header and the
             grid (the landing prizes box, minus the title notch) -->
        <section class="picked">
          <div class="picked-card" class:stack={orderedSrcs.length > 1}>
            <div
              class="picked-border rainbow-box"
              use:rainbowBorder={{ bleed: 8, notch: false }}
              aria-hidden="true"
            ></div>
            <div class="picked-fig" class:multi={orderedSrcs.length > 1}>
              {#each orderedSrcs as src (src)}
                <span class="pk-sq" style="--rot:{rotOf(src)}deg">
                  <img src={hdSrc(src)} alt="" />
                </span>
              {/each}
            </div>
            <div class="picked-info">
              <p class="picked-label">your pick:</p>
              <p class="picked-name">
                {data.order.type === 'games'
                  ? data.order.games.join(', ')
                  : data.order.prize + (data.order.shirtSize ? ` (${data.order.shirtSize})` : '')}
              </p>
              <p class="fine">
                {#if !noPhysical}ships to:{/if}
                <button class="addr-edit" type="button" onclick={() => (modal = { kind: 'address' })}>
                  {noPhysical
                    ? 'not shipping you anything physical'
                    : `${data.order.address.line1}, ${data.order.address.city}, ${data.order.address.country}`}<img class="pencil" src="/assets/pencil.png" alt="" />
                </button>
              </p>
              {#if browsing}
                <p class="fine">you can switch your pick below before i get around to fulfilling it ;)</p>
              {/if}
            </div>
          </div>
          {#if !browsing}
            <button class="go picked-change" type="button" onclick={() => (browsing = true)}>
              change my pick<img class="chev" src="/assets/chevron.png" alt="" />
            </button>
          {/if}
        </section>
      {/if}

      {#if !data.order || browsing}

      <section class="group">
        <!-- "how it works"-style header: tag at the left, line trailing right -->
        <div class="gh">
          <span class="gh-tag"><h2 class="txt gh-title">the stuff</h2></span>
          <span class="gh-line" aria-hidden="true"></span>
        </div>
        <p class="gh-sub"><span class="gh-sub-t">pick any one</span></p>
        <ul class="grid">
          {#each PRIZE_STUFF as p (p.src)}
            <li>
              <button
                class="tile"
                class:sel={currentPrizeSrc === p.src}
                type="button"
                style="--h9:url('/assets/hover9_{hoverVar[p.src] ?? 'a'}@8x.png')"
                onclick={() => openModal(p)}
              >
                <span class="thumb"><img src="/assets/prize_{p.src}.png" alt={p.alt} loading="lazy" /></span>
                <span class="name">{p.name}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <p class="or">or, instead of one thing:</p>

      <section class="group">
        <!-- "questions?"-style header: line filling left, tag at the right -->
        <div class="gh">
          <span class="gh-line" aria-hidden="true"></span>
          <span class="gh-tag"><h2 class="txt gh-title">indie games</h2></span>
        </div>
        <p class="gh-sub">
          <span class="gh-sub-t">
            pick any {GAME_PICK_COUNT}{gamePicks.length ? ` (${gamePicks.length}/${GAME_PICK_COUNT})` : ''}
          </span>
        </p>
        <ul class="grid">
          {#each PRIZE_GAMES as p (p.src)}
            <li>
              <button
                class="tile"
                class:sel={gamePicks.includes(p.src)}
                class:dim={gamePicks.length >= GAME_PICK_COUNT && !gamePicks.includes(p.src)}
                type="button"
                style="--h9:url('/assets/hover9_{hoverVar[p.src] ?? 'a'}@8x.png')"
                onclick={() => openModal(p)}
              >
                <span class="thumb"><img src="/assets/prize_{p.src}.png" alt={p.alt} loading="lazy" /></span>
                <span class="name">{p.name}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <p class="suggest-note">
        don't see anything you like?
        <a href="https://forms.hackclub.com/jame-gam-prize-suggestion" target="_blank" rel="noopener">suggest a prize!</a>
      </p>
      {/if}
    {/if}
  {/if}

  {#if !data.closed && (data.state === 'signedout' || data.state === 'noaddress')}
    <p class="deadline">
      if you participated in <span class="jam-name">{data.jamName}</span>, you have until
      {data.closesText} to purchase your prize!
    </p>
  {/if}
  {#if data.me}
    <p class="who-bottom">
      signed in as {data.me.email}
      <a href="/api/auth/logout">sign out</a>
    </p>
  {/if}
</main>

<!-- ===== the item modal (info + order/add) ===== -->
{#if modal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="overlay" onclick={closeModal}>
    <div
      class="modal"
      class:duo={modal.kind === 'item' || modal.kind === 'game'}
      class:addr={modal.kind === 'address'}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      bind:this={modalEl}
      onclick={(e) => e.stopPropagation()}
    >
      <button class="modal-x" type="button" aria-label="close" onclick={closeModal}>x</button>

      {#if modal.kind === 'address'}
        <!-- shipping question, asked once up front (mimics the fillout signin
             card: identity header row, the address rows as the main block,
             then a footer with the fix-it note left and the action right) -->
        <div class="m-body addr-body">
          <div class="addr-head">
            <p class="m-name">shipping</p>
            <p class="addr-who">
              signed in as {data.me.email} -
              <a href="/api/auth/logout">not you?</a>
            </p>
          </div>
          <div class="addr-list" role="radiogroup" aria-label="shipping address">
            {#each data.addresses as a (a.id)}
              <button
                class="addr-row"
                class:on={String(a.id) === String(addressId) && !noPhysical}
                type="button"
                role="radio"
                aria-checked={String(a.id) === String(addressId) && !noPhysical}
                onclick={() => {
                  addressId = a.id;
                  noPhysical = false;
                }}
              >
                <span class="mark" aria-hidden="true">[{String(a.id) === String(addressId) && !noPhysical ? 'x' : ' '}]</span>
                {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}{a.region ? `, ${a.region}` : ''}, {a.country}{#if !a.phone}
                  <span class="no-phone">(needs a phone number!)</span>{/if}
              </button>
            {/each}
            <button
              class="addr-row"
              class:on={noPhysical}
              type="button"
              role="radio"
              aria-checked={noPhysical}
              onclick={() => (noPhysical = !noPhysical)}
            >
              <span class="mark" aria-hidden="true">[{noPhysical ? 'x' : ' '}]</span>
              don't ship me anything physical!
            </button>
          </div>
          {#if errorMsg}<p class="err">{errorMsg}</p>{/if}
          <div class="addr-foot">
            <p class="m-note">
              wrong address? edit it on
              <a href="https://auth.hackclub.com/addresses" target="_blank" rel="noopener">auth.hackclub.com</a>
            </p>
            <button class="cta" type="button" disabled={submitting} onclick={confirmAddress}>
              {submitting ? 'saving...' : data.order ? 'update my order!' : 'sounds good!'}
            </button>
          </div>
        </div>
      {:else if modal.kind === 'games-confirm'}
        <!-- confirm step: one centered column -->
        <div class="m-body center">
          <p class="m-name">your {GAME_PICK_COUNT} games</p>
          <div class="m-games">
            {#each gamePicks as src (src)}
              <img src="/assets/prize_{src}.png" alt={PRIZE_GAMES.find((g) => g.src === src)?.name} />
            {/each}
          </div>
          <p class="m-info">{pickNames.join(', ')}</p>
          {#if errorMsg}<p class="err">{errorMsg}</p>{/if}
          <div class="m-actions">
            <button class="cta" type="button" disabled={submitting} onclick={orderGames}>
              {submitting ? 'ordering...' : `order these ${GAME_PICK_COUNT}!`}
            </button>
            <button class="go quiet" type="button" disabled={submitting} onclick={closeModal}>
              let me keep thinking
            </button>
          </div>
        </div>
      {:else}
        <!-- item step: big product shot on the left, info stack on the right -->
        <span class="m-fig"><img src={hdSrc(modal.p.src)} alt={modal.p.alt} /></span>
        <div class="m-body">
          <p class="m-name">{modal.p.name}</p>
          {#if modal.p.href}
            <!-- the icon lives inside the nowrap domain span, so wherever the
                 line wraps it stays glued to the right of the last letter -->
            <a class="m-link" href={modal.p.href} target="_blank" rel="noopener">
              <span class="m-link-pre">check it out on</span>
              <span class="m-link-dom"
                >{domainOf(modal.p.href)}<img
                  class="m-ext"
                  src="/assets/extlink.png"
                  alt="(opens in a new tab)"
                /></span
              >
            </a>
          {/if}
          {#if modal.p.blurb}
            <p class="m-info">{modal.p.blurb}</p>
          {/if}
          {#if modal.kind === 'game'}
            <p class="m-note">instead of one prize, you can grab {GAME_PICK_COUNT} indie games.</p>
          {/if}

          {#if modal.kind === 'item' && modal.p.src === 'tshirt'}
            <div class="sizes">
              {#each TSHIRT_SIZES as s, i (s)}
                <button
                  class="size"
                  class:sel={shirtSize === s}
                  type="button"
                  aria-pressed={shirtSize === s}
                  style="--h9:url('/assets/hover9_{'abc'[i % 3]}@8x.png')"
                  onclick={() => (shirtSize = s)}>{s}</button
                >
              {/each}
            </div>
            <p class="m-note">this is a placeholder, <span class="u">this is not the shirt design</span>. us sizing!</p>
          {/if}

          {#if errorMsg}<p class="err">{errorMsg}</p>{/if}

          {#if modal.kind === 'game'}
            {#if gamePicks.includes(modal.p.src)}
              <!-- with all 3 picked, this modal is also the way back to ordering
                   (the section header has no order button) -->
              <div class="m-actions">
                {#if gamePicks.length === GAME_PICK_COUNT && gamesDirty}
                  <button class="cta" type="button" onclick={() => (modal = { kind: 'games-confirm' })}>
                    order these {GAME_PICK_COUNT}!
                  </button>
                {/if}
                <button class="go quiet" type="button" onclick={() => removeGame(modal.p)}>
                  remove from my picks
                </button>
              </div>
            {:else if gamePicks.length < GAME_PICK_COUNT}
              <button class="cta" type="button" onclick={() => addGame(modal.p)}>
                add to my picks ({gamePicks.length + 1}/{GAME_PICK_COUNT})
              </button>
            {:else}
              <p class="fine">you've already picked {GAME_PICK_COUNT}, remove one first</p>
            {/if}
          {:else if currentPrizeSrc === modal.p.src && (modal.p.src !== 'tshirt' || shirtSize === data.order?.shirtSize)}
            <p class="fine">this is your current pick!</p>
          {:else}
            <button
              class="cta"
              type="button"
              disabled={submitting || (modal.p.src === 'tshirt' && !shirtSize)}
              onclick={() => orderPrize(modal.p)}
            >
              {submitting
                ? 'ordering...'
                : currentPrizeSrc === modal.p.src
                  ? 'update the size!'
                  : data.order
                    ? 'switch my pick to this!'
                    : 'get this one!'}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  /* two font sizes total: --t-title (page title) and --t-card (everything
     else) - no fine print smaller than the body */
  /* ===== edge doodles ===== */
  /* spans the full page height, breaks out of the centre column to the
     viewport edges; body's overflow-x:clip contains the poking doodles */
  .shop-doodles {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 100vw;
    transform: translateX(-50%);
    z-index: -1; /* behind the page content (.page makes the stacking context) */
    pointer-events: none;
  }
  .ed {
    position: absolute;
    top: var(--top);
    width: calc(var(--w) * var(--scale));
    opacity: 0.05;
  }

  /* dust layer: same full-bleed breakout as .shop-doodles, behind the content */
  .shop-dust {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 100vw;
    transform: translateX(-50%);
    z-index: -1;
    pointer-events: none;
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
  /* once the gutters get tight enough that a doodle would sit under the column,
     drop to EdgeDoodles' "crowded" faintness */
  @media (max-width: 1359px) {
    .ed {
      opacity: 0.022;
    }
  }

  .page {
    max-width: calc(900px * var(--scale));
    margin: 0 auto;
    position: relative;
    z-index: 1; /* above the fixed doodle layer */
    padding: calc(48px * var(--scale)) var(--col-pad) calc(64px * var(--scale));
    box-sizing: border-box;
    color: var(--ink);
    font-size: var(--t-card);
    /* flex column so the slim (panel-only) states can centre vertically: the
       panel's auto block margins split the leftover viewport space, and the
       deadline note lands at the bottom */
    display: flex;
    flex-direction: column;
    min-height: 100svh;
  }
  .page.slim {
    padding-bottom: calc(40px * var(--scale));
  }
  .page.slim .panel {
    margin-block: auto;
  }
  /* the locked-order card centres like the slim panels do */
  .page.slim .picked {
    margin-block: auto;
  }

  .head {
    text-align: center;
    margin-bottom: calc(28px * var(--scale));
  }
  /* fresh pick (nothing ordered yet): the title starts ~1/8 down the first
     screen and everything scrolls up from under it */
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
  /* triple selector: has to out-rank .lede (max-width) and .lede.center
     (margin), which both come later in this sheet */
  .lede.center.intro2 {
    margin: calc(64px * var(--scale)) auto 0; /* well clear of the big title */
    max-width: calc(var(--col) * 0.75); /* 3/4 of the landing centre column */
    line-height: 1.05;
  }
  /* the live deadline countdown, right under the intro: the framing words
     recede, the ticking part stays full ink */
  .lede.center.countdown {
    margin-top: calc(12px * var(--scale));
    color: rgba(80, 75, 73, 0.55);
  }
  .cd-time {
    color: var(--ink);
  }
  /* where things ship, small and quiet under the intro; reopens the modal */
  /* faded via color (not opacity) so the accent links inside stay full red */
  .ship-note {
    margin: calc(18px * var(--scale)) 0 0;
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
  .steps {
    margin: 0;
    padding-left: 1.4em;
    text-align: left;
    line-height: 1.5;
  }

  /* the noaddress state: the one slim state with real steps to follow, so it
     breaks the centered-column mold - left-aligned, wider, steps spaced out */
  .panel.addr-need {
    max-width: calc(620px * var(--scale));
    align-items: flex-start;
    text-align: left;
  }
  .panel.addr-need .steps {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--scale));
    line-height: 1.35;
  }

  /* actions are plain links (or link-shaped buttons) */
  .go {
    font-family: inherit;
    font-size: var(--t-card);
    color: var(--accent);
    background: none;
    border: none;
    padding: 0;
    text-decoration: underline;
  }
  .go:disabled {
    opacity: 0.4;
  }

  /* the shipping address IS the edit control: a red link with augie's pencil
     doodle hanging off the end (opens the address modal) */
  .addr-edit {
    font-family: inherit;
    font-size: inherit;
    color: var(--accent);
    background: none;
    border: none;
    padding: 0;
    text-align: inherit;
    text-decoration: underline;
  }
  .pencil {
    height: calc(19px * var(--scale));
    width: auto;
    image-rendering: pixelated;
    display: inline-block;
    vertical-align: baseline;
    margin-left: calc(7px * var(--scale));
  }

  /* "change my pick" - sits well clear of the rainbow card, dropdown chevron
     hinting at the grids it reveals */
  .picked-change {
    margin-top: calc(38px * var(--scale));
    color: var(--ink);
    text-decoration-color: rgba(80, 75, 73, 0.3);
  }
  .chev {
    height: calc(10px * var(--scale));
    width: auto;
    image-rendering: pixelated;
    display: inline-block;
    vertical-align: calc(1px * var(--scale));
    margin-left: calc(8px * var(--scale));
  }

  /* "sign in with hack club" - image button, same treatment as the landing
     page's "i'm in" (bare art, opacity lift on hover) */
  .signin {
    display: block;
    margin-top: calc(24px * var(--scale)); /* extra air under the big title */
    opacity: 0.8;
  }
  .signin:hover {
    opacity: 0.9;
  }
  /* sized by height (like .email-im's 40px) so the art's width just follows
     its own aspect ratio */
  .signin img {
    display: block;
    height: calc(40px * var(--scale));
    width: auto;
    max-width: 100%;
  }

  /* the order deadline, pinned to the bottom of the slim states */
  .deadline {
    margin: calc(48px * var(--scale)) auto 0;
    max-width: var(--col); /* match the landing centre column */
    text-align: center;
    line-height: 1.15;
    color: rgba(80, 75, 73, 0.85);
  }
  .deadline .jam-name {
    color: #af5550; /* the red from juniper_text.png ("the" / "game jam") */
  }

  /* "signed in as ..." - pinned to the very bottom, same size as everything else */
  .who-bottom {
    margin: calc(56px * var(--scale)) auto 0;
    text-align: center;
    color: rgba(80, 75, 73, 0.85);
  }
  /* short shop pages (grids collapsed): the free space goes above this line so
     it always hugs the page bottom. Slim states keep their own auto-margin
     centering, so only the full shop view gets the pin. */
  .page:not(.slim) .who-bottom {
    margin-top: auto;
    padding-top: calc(56px * var(--scale));
  }

  .fine {
    margin: 0;
    color: rgba(80, 75, 73, 0.55);
  }
  /* the suggestion-form nudge under the games grid, for anyone who scrolled
     the whole pool without clicking */
  .suggest-note {
    margin: calc(44px * var(--scale)) 0 0;
    text-align: center;
    color: rgba(80, 75, 73, 0.55);
  }
  .err {
    margin: 0;
    color: var(--accent);
  }

  /* ===== "your pick" card (existing order, still changeable) =====
     the landing prizes box treatment: sketchy rainbow border drawn live by
     use:rainbowBorder (notch:false - no title indent), prize art on the left,
     the details stacked on the right. */
  .picked {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(10px * var(--scale));
    margin-top: calc(44px * var(--scale)); /* clear of the intro above */
    margin-bottom: calc(4px * var(--scale)); /* .group's own top margin follows */
  }
  .picked-card {
    position: relative;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: calc(40px * var(--scale));
    padding: calc(38px * var(--scale)) calc(46px * var(--scale));
  }
  /* 3 games: the covers make a row up top, the details sit centered below */
  .picked-card.stack {
    flex-direction: column;
    gap: calc(24px * var(--scale));
  }
  .picked-card.stack .picked-info {
    align-items: center;
    text-align: center;
  }
  /* border layer: fills the card (+8px bleed so nudged edges aren't cropped) */
  .picked-border {
    position: absolute;
    inset: -8px;
    pointer-events: none;
    z-index: 0;
  }
  .picked-fig {
    position: relative;
    z-index: 1;
    flex: none;
    display: flex;
    align-items: center;
    gap: calc(24px * var(--scale));
  }
  /* each prize sits in a square, tilted a stable hair (--rot from its name) */
  .pk-sq {
    width: calc(210px * var(--scale));
    height: calc(210px * var(--scale));
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(var(--rot, 0deg));
  }
  .picked-fig.multi .pk-sq {
    width: calc(132px * var(--scale));
    height: calc(132px * var(--scale));
  }
  /* fill the square (the art is tiny natively, so max-* would never upscale) */
  .pk-sq img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .picked-info {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(6px * var(--scale));
    text-align: left;
    min-width: 0;
  }
  .picked-label {
    margin: 0;
    opacity: 0.55;
  }
  .picked-name {
    margin: 0;
    font-size: var(--t-title);
    font-family: 'augiepixel', sans-serif;
    line-height: 1.1;
  }
  @media (max-width: 679px) {
    .picked-card {
      flex-direction: column;
      gap: calc(18px * var(--scale));
      text-align: center;
    }
    .picked-info {
      align-items: center;
      text-align: center;
    }
  }

  /* the sketchy rainbow border fill (copied from Prizes.svelte, where it's
     component-scoped): a tiling rainbow texture clipped by the mask that
     use:rainbowBorder builds at runtime */
  .rainbow-box {
    pointer-events: none;
    background-image: url('/assets/rainbow_texture.png');
    background-repeat: repeat;
    background-size: calc(465px * var(--scale)) calc(302px * var(--scale));
    background-position: 0 0;
    image-rendering: pixelated;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-position: 0 0;
    mask-position: 0 0;
  }

  /* ===== groups + tile grid ===== */
  .group {
    margin-top: calc(36px * var(--scale));
  }
  /* section headers, straight from the landing vocabulary: a q_box sketch tag
     holding the title + the hand-drawn underline550 line filling the rest of
     the row (cropped, not stretched), with the pick-note at the far end.
     "the stuff" puts the tag left (how-it-works style); "indie games" puts it
     right (questions? style) - the markup order decides, the CSS is shared. */
  .gh {
    display: flex;
    align-items: center;
    gap: calc(14px * var(--scale));
    width: 100%;
    margin-bottom: calc(18px * var(--scale));
  }
  .gh-tag {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* taller than the landing q-tag: "indie games" has a descender (g) that
       needs room under the baseline */
    padding: calc(8px * var(--scale)) calc(24px * var(--scale)) calc(10px * var(--scale));
    background: url('/assets/q_box.png') center / 100% 100% no-repeat;
    image-rendering: pixelated;
  }
  .gh-title {
    margin: 0;
    font-weight: normal;
    font-size: var(--t-title);
    line-height: 1;
    white-space: nowrap;
  }
  /* the wiggle tiles at its natural scale (never stretched to the row width,
     which upscaled it enough to crop the peaks top/bottom) */
  .gh-line {
    flex: 1 1 auto;
    height: calc(14px * var(--scale));
    min-width: calc(40px * var(--scale));
    background: url('/assets/underline550.png') left center repeat-x;
    background-size: auto 100%;
    image-rendering: pixelated;
  }
  .gh-line img {
    display: none; /* kept in the DOM for the landing-parity markup */
  }
  /* the pick-note, centered on its own line under the header row */
  .gh-sub {
    margin: calc(2px * var(--scale)) 0 calc(16px * var(--scale));
    text-align: center;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: calc(16px * var(--scale));
    flex-wrap: wrap;
  }
  .gh-sub-t {
    opacity: 0.5;
  }
  .go.quiet {
    color: var(--ink);
    opacity: 0.45;
    text-decoration: none;
  }
  .go.quiet:hover {
    text-decoration: underline;
  }
  .or {
    margin: calc(30px * var(--scale)) 0 0;
    text-align: center;
    opacity: 0.55;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(calc(180px * var(--scale)), 1fr));
    gap: calc(12px * var(--scale));
  }
  /* every card the same size, no borders; hover paints the lumpy 9-slice bg
     (one of 3 skins via --h9, rolled per item per page load) */
  .tile {
    position: relative;
    z-index: 0;
    width: 100%;
    height: calc(240px * var(--scale)); /* room for 3-line names */
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(8px * var(--scale));
    font-family: inherit;
    font-size: var(--t-card);
    color: var(--ink);
    text-align: center;
    background: transparent;
    border: none;
    border-radius: calc(10px * var(--scale));
    padding: calc(20px * var(--scale)) calc(12px * var(--scale));
    cursor: pointer;
  }
  /* the hover bg lives on an inset pseudo so two adjacent hovers never touch -
     there's always a gap between two gray patches (inset + grid gap) */
  .tile::before {
    content: '';
    position: absolute;
    inset: calc(4px * var(--scale));
    z-index: -1;
    pointer-events: none;
    border: calc(20px * var(--scale)) solid transparent;
    /* stretch (not tile) the side cells - the lumps just get gently pulled.
       The @8x asset is the 30x30 source pre-scaled nearest-neighbour (slice 80
       = 10 art px), because browsers ignore image-rendering on border-image
       and would bilinear-blur the 1x art. Edit the 30x30 source in aseprite,
       then: magick hover9_X.png -scale 800% hover9_X@8x.png */
    border-image: var(--h9, url('/assets/hover9_a@8x.png')) 80 fill stretch;
    image-rendering: pixelated;
    opacity: 0;
  }
  .tile:hover::before,
  .tile:focus-visible::before {
    opacity: 1;
  }
  /* selection = the lumpy bg stays on; hovering a selected tile darkens it */
  .tile.sel::before {
    opacity: 1;
  }
  .tile.sel:hover::before,
  .tile.sel:focus-visible::before {
    filter: brightness(0.93);
  }
  .tile.dim {
    opacity: 0.4;
  }
  .thumb {
    flex: none;
    height: calc(108px * var(--scale));
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb img {
    max-height: 100%;
    max-width: 100%; /* right up to the card's padding, just not the text */
  }
  .name {
    flex: 1;
    display: flex;
    align-items: center;
    line-height: 1.05;
  }

  .sizes {
    display: flex;
    justify-content: center;
    gap: calc(8px * var(--scale));
  }
  /* square size buttons with the same lumpy hover/selected skins as the cards */
  .size {
    position: relative;
    z-index: 0;
    width: calc(56px * var(--scale));
    height: calc(56px * var(--scale));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    font-size: var(--t-card);
    color: var(--ink);
    background: none;
    border: none;
    padding: 0;
    opacity: 0.6;
    cursor: pointer;
  }
  .size::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    border: calc(20px * var(--scale)) solid transparent;
    border-image: var(--h9, url('/assets/hover9_a@8x.png')) 80 fill stretch;
    image-rendering: pixelated;
    opacity: 0;
  }
  .size:hover::before,
  .size:focus-visible::before,
  .size.sel::before {
    opacity: 1;
  }
  .size.sel {
    opacity: 1;
  }
  .size.sel:hover::before {
    filter: brightness(0.93);
  }
  .u {
    text-decoration: underline;
  }

  /* ===== the item modal: page-offwhite lumpy panel over a darkened page ===== */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 60; /* over the grain (50) */
    background: rgba(43, 40, 38, 0.55); /* ink-tinted dark, not black */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(16px * var(--scale));
  }
  /* the page fades to dark rather than snapping */
  @media (prefers-reduced-motion: no-preference) {
    .overlay {
      animation: overlay-in 0.22s ease-out;
    }
  }
  @keyframes overlay-in {
    from {
      background-color: rgba(43, 40, 38, 0);
    }
  }
  /* the panel IS the 9-slice: page-coloured fill, lumpy silhouette.
     modal9.png is 160x160 with 24 art-px corner cells (so the side tiles are
     a long 112 art px each); the 48px*scale border puts corners AND sides at
     exactly 2 css px per art px, and `repeat` never rescales the side tiles
     the way `round` did. */
  .modal {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    /* wider than the centre column - the product shot is the point */
    max-width: min(calc(1060px * var(--scale)), 94vw);
    max-height: 88svh;
    overflow: auto;
    /* the overlay lives OUTSIDE .page, so set the floor size explicitly -
       otherwise everything silently inherits the browser's 16px default */
    font-size: var(--t-card);
    color: var(--ink);
    background: none;
    border: calc(48px * var(--scale)) solid transparent;
    /* @8x pre-scaled for crispness (1280px, slice 192 = 24 art px), same story
       as the hover skins. The ?v= query is a cache-buster - the browser clings
       to stylesheet border-images even through hard reloads, so bump the
       number after editing the art */
    border-image: url('/assets/modal9@8x.png?v=9') 192 fill repeat;
    image-rendering: pixelated;
    padding: calc(8px * var(--scale)) calc(12px * var(--scale)) calc(12px * var(--scale));
    transform: rotate(-0.6deg);
  }
  /* only the product-shot layout needs the full width */
  .modal:not(.duo) {
    max-width: calc(760px * var(--scale));
  }
  .m-actions {
    display: flex;
    align-items: center;
    gap: calc(24px * var(--scale));
  }
  /* item step: big fixed figure column, roomy gutter, info stack on the right */
  .modal.duo {
    display: grid;
    grid-template-columns: minmax(0, calc(360px * var(--scale))) 1fr;
    column-gap: calc(56px * var(--scale));
    align-items: center;
    text-align: left;
  }
  .modal:focus {
    outline: none;
  }
  @media (prefers-reduced-motion: no-preference) {
    .modal {
      animation: modal-in 0.14s ease-out;
    }
  }
  @keyframes modal-in {
    from {
      opacity: 0;
      transform: rotate(-0.6deg) translateY(8px);
    }
  }
  .modal-x {
    position: absolute;
    top: 0;
    right: 0;
    font-family: inherit;
    font-size: var(--t-card);
    color: var(--ink);
    background: none;
    border: none;
    /* generous hitbox - the visible x is small but the button isn't */
    padding: calc(14px * var(--scale)) calc(20px * var(--scale));
    opacity: 0.45;
    cursor: pointer;
  }
  .modal-x:hover {
    opacity: 0.8;
  }

  .m-fig {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* amazon-energy product shot: a central focus, but with air around it */
  .m-fig {
    padding: calc(24px * var(--scale));
  }
  .m-fig img {
    display: block;
    width: 100%;
    height: auto;
    max-height: calc(300px * var(--scale));
    object-fit: contain;
  }
  /* the info stack: name+info sit tight as a pair, then generous steps
     between the option/address/action groups */
  .m-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(22px * var(--scale));
    padding-block: calc(8px * var(--scale));
    min-width: 0;
  }
  .m-body.center {
    align-items: center;
    text-align: center;
  }
  .m-name {
    margin: 0;
    font-size: var(--t-title);
    line-height: 1.05;
  }
  /* "check it out on steampowered.com" - lead-in in lighter gray, only the
     domain underlined (ink text, light gray underline), doodled out-arrow */
  .m-link {
    margin-top: calc(-14px * var(--scale)); /* tight under the name */
    display: inline;
    color: var(--ink);
    text-decoration: none;
    line-height: 1.3;
  }
  .m-link-pre {
    color: rgba(80, 75, 73, 0.45);
  }
  .m-link-dom {
    white-space: nowrap; /* keeps the arrow on the domain's line */
    text-decoration: underline;
    text-decoration-color: rgba(80, 75, 73, 0.3);
    text-underline-offset: 0.14em;
  }
  .m-ext {
    display: inline-block;
    width: calc(18px * var(--scale));
    height: auto;
    margin-left: calc(8px * var(--scale));
    vertical-align: -0.05em;
    opacity: 0.75;
  }
  /* hover: the whole line perks up */
  .m-link:hover .m-link-pre {
    color: rgba(80, 75, 73, 0.7);
  }
  .m-link:hover .m-link-dom {
    text-decoration-color: rgba(80, 75, 73, 0.65);
  }
  .m-link:hover .m-ext {
    opacity: 1;
  }
  .m-info {
    margin: calc(-12px * var(--scale)) 0 0; /* tight against the name/link */
    line-height: 1.3;
    opacity: 0.75;
    max-width: 34ch;
  }
  /* the m-link pushes m-info down when both exist; keep the pair tight */
  .m-link + .m-info {
    margin-top: calc(-6px * var(--scale));
  }
  .m-note {
    margin: 0;
    line-height: 1.3;
    color: rgba(80, 75, 73, 0.55);
    max-width: 44ch;
  }

  /* ===== the shipping modal (fillout card, jam-gam-ified): identity header
     row, address rows as the main block, note + action footer ===== */
  .addr-body {
    width: 100%;
    max-width: calc(620px * var(--scale));
    margin-inline: auto;
    align-items: stretch;
    text-align: left;
  }
  .addr-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: calc(20px * var(--scale));
    flex-wrap: wrap;
  }
  .addr-who {
    margin: 0;
    color: rgba(80, 75, 73, 0.55);
    min-width: 0;
  }
  .addr-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(28px * var(--scale));
    margin-top: calc(6px * var(--scale));
  }
  .addr-foot .m-note {
    flex: 1 1 auto;
    max-width: 30ch;
  }
  .addr-foot .cta {
    flex: none;
  }
  .addr-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: calc(6px * var(--scale));
    width: 100%;
  }
  .addr-row {
    font-family: inherit;
    font-size: inherit;
    color: var(--ink);
    text-align: left;
    background: none;
    border: none;
    padding: calc(6px * var(--scale)) calc(10px * var(--scale));
    opacity: 0.55;
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: calc(10px * var(--scale));
    line-height: 1.25;
  }
  .addr-row:hover {
    opacity: 0.85;
  }
  .addr-row.on {
    opacity: 1;
  }
  .addr-row .mark {
    flex: none;
    white-space: pre; /* keep the [ ] box width stable when empty */
  }
  /* shipping needs a phone number on the label; flag addresses missing one */
  .addr-row .no-phone {
    color: var(--accent);
    white-space: nowrap;
  }
  .m-games {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(20px * var(--scale));
  }
  .m-games img {
    max-height: calc(90px * var(--scale));
    max-width: calc(120px * var(--scale));
  }

  /* the order button: the imin look, skinned with the button9 9-slice art
     (dark lumpy slab, aseprite-editable) so the label stays dynamic without
     resorting to plain CSS chrome */
  .cta {
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
    margin-top: calc(4px * var(--scale));
  }
  .cta:hover {
    opacity: 1;
  }
  .cta:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* narrow screens: the two columns stack, everything centers */
  @media (max-width: 599px) {
    .modal.duo {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      row-gap: calc(20px * var(--scale));
    }
    .modal.duo .m-body {
      align-items: center;
      text-align: center;
    }
    .modal.duo .m-addr {
      align-items: center;
      text-align: center;
    }
  }
</style>
