<script>
  // /embed/signup - the jame gam signup box, framed into the itch jam page.
  // Same flow as the homepage boxes (POST /api/signup), tagged source=itch so
  // the row's signup_origin reads itch.io. The frame can't see a Hack Club
  // session (third-party cookies), so there's no prefill; instead a successful
  // signup is remembered in this frame's storage, and a returning visitor gets
  // the quiet "you're in" line rather than the whole pitch again.
  //   ?state=done|error previews those states without submitting anything.
  import { onMount } from 'svelte';
  import { submitSignup } from '$lib/signup.js';

  const KEY = 'jg-signed-up';

  let email = $state('');
  let company = $state(''); // honeypot - real humans never see or fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');

  onMount(() => {
    const preview = new URLSearchParams(location.search).get('state');
    if (preview === 'done') { status = 'done'; message = 'you’re in! check your email :]'; return; }
    if (preview === 'error') { status = 'error'; message = 'enter a valid email'; return; }
    try { if (localStorage.getItem(KEY)) { status = 'done'; message = 'you’re in the jame gam community :]'; } } catch {}
  });

  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading' || status === 'done') return;
    status = 'loading';
    message = '';
    try {
      const r = await submitSignup({ email: v, company, source: 'itch' });
      if (r.ok) {
        status = 'done';
        message = r.message;
        try { localStorage.setItem(KEY, '1'); } catch {}
      } else {
        status = 'error';
        message = r.error || 'hmm, that didn’t work. try again?';
      }
    } catch {
      status = 'error';
      message = 'network hiccup, try again?';
    }
  }
</script>

<svelte:head>
  <title>join jame gam</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <style>
    @font-face {
      font-family: 'Jua';
      font-display: swap;
      src: url('https://fonts.gstatic.com/s/jua/v18/co3KmW9ljjATdOrY.woff2') format('woff2');
    }
  </style>
</svelte:head>

<main class="embed" class:done={status === 'done'}>
  {#if status === 'done'}
    <p class="done-msg" aria-live="polite">{message}</p>
  {:else}
    <!-- an error takes the pitch line's place, so the frame needs no spare
         row reserved under the box for it -->
    <p class="pitch" class:err={status === 'error'} aria-live="polite">{status === 'error' ? message : 'sign up to get an invite to the jame gam community, and get updates + find a team!'}</p>
    <form class="row" onsubmit={submit}>
      <span class="box">
        <input type="email" placeholder="your email..." autocomplete="email" aria-label="your email" required bind:value={email} disabled={status === 'loading'} />
      </span>
      <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
      <button class="cta" type="submit" disabled={status === 'loading'}>join the community</button>
    </form>
  {/if}
</main>

<style>
  /* everything is set in Jua, like the itch description around it (custom.css:
     Jua 19px, --jg-text); the box + button are the site's own sketch art */
  .embed {
    --scale: 0.9;
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 2px;
  }
  .pitch {
    margin: 0;
    font-family: 'Jua', sans-serif;
    font-size: 19px;
    line-height: 1.4;
    color: #746560;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 10px;
    margin: 0;
  }
  .box {
    display: block;
    width: 282px;
    max-width: 100%;
    height: 46px;
    background: url('/assets/email_box542.png') no-repeat center / 100% 100%;
  }
  .box input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    outline: 0;
    font-family: 'Jua', sans-serif;
    font-size: 19px;
    color: #534a46;
    padding: 0 16px;
  }
  .box input::placeholder { color: #cfc9cd; opacity: 1; }
  .box input:disabled { opacity: 0.6; }
  .box:focus-within { filter: brightness(0.96); }

  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

  /* the site's 9-slice pixel button (see /prizes .cta) */
  .cta {
    font-family: 'Jua', sans-serif;
    font-size: 20px;
    color: #fbfbfb;
    line-height: 1;
    background: none;
    border: 14px solid transparent;
    border-image: url('/assets/button9@8x.png?v=1') 80 fill stretch;
    image-rendering: pixelated;
    padding: 0 8px;
    cursor: pointer;
    opacity: 0.85;
    white-space: nowrap;
  }
  .cta:hover { opacity: 1; }
  .cta:focus-visible { outline: 2px solid #91a4db; outline-offset: 2px; }
  .cta:disabled { opacity: 0.4; cursor: default; }

  .pitch.err { color: #c2566e; }

  .done-msg {
    margin: 0;
    font-family: 'Jua', sans-serif;
    font-size: 19px;
    color: #746560;
    opacity: 0.7;
  }
</style>
