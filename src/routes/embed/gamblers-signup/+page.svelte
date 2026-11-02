<script>
  // /embed/gamblers-signup - the teen signup box framed into the MFG Gambler's
  // Jam itch page (retrocrow x hack club). Same flow as /embed/signup (POST
  // /api/signup with source=itch, so signup_origin reads itch.io, plus
  // ?ref=retrocrow to tell it apart from other itch pages), dressed in that
  // page's casino look instead of jame gam's sketchbook: Lexend body text in
  // the description's white, the cream Tilt Warp sign the "see the full prize list"
  // button uses, and the page's custom cursor (the slot machine embed's files).
  // The frame can't see a Hack Club session (third-party cookies), so there's
  // no prefill; a successful signup is remembered in this frame's storage, and
  // a returning visitor gets the quiet "you're in" line instead.
  //   ?state=done|error previews those states without submitting anything.
  //
  // On the itch page: <iframe src="https://jamegam.hackclub.com/embed/gamblers-signup"
  //   width="100%" height="116" style="border:0" title="..."></iframe>
  // in a <div class="custom-signup" style="margin-top:-22px">, which pulls it
  // up into the prize list button's bottom margin (itch keeps inline border
  // and margin, so no theme CSS is needed for any of it).
  import { onMount } from 'svelte';
  import { submitSignup } from '$lib/signup.js';

  const KEY = 'jg-signed-up';
  const REF = 'retrocrow';
  // the API's messages are in jame gam's lowercase voice; this page writes in
  // sentence case
  /** @param {string} s */
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  let email = $state('');
  let company = $state(''); // honeypot - real humans never see or fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');

  onMount(() => {
    const preview = new URLSearchParams(location.search).get('state');
    if (preview === 'done') { status = 'done'; message = 'You’re in! Check your email :)'; return; }
    if (preview === 'error') { status = 'error'; message = 'Enter a valid email'; return; }
    try { if (localStorage.getItem(KEY)) { status = 'done'; message = 'You’re signed up for Hack Club :)'; } } catch {}
  });

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading' || status === 'done') return;
    status = 'loading';
    message = '';
    try {
      const r = await submitSignup({ email: v, company, source: 'itch', ref: REF });
      if (r.ok) {
        status = 'done';
        message = r.message?.includes('already') ? 'You’re already in :)' : 'You’re in! Check your email :)';
        try { localStorage.setItem(KEY, '1'); } catch {}
      } else {
        status = 'error';
        message = cap(r.error || 'hmm, that didn’t work. Try again?');
      }
    } catch {
      status = 'error';
      message = 'Network hiccup, try again?';
    }
  }
</script>

<svelte:head>
  <title>Sign up for Hack Club</title>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;700&display=swap" />
  <style>
    @font-face {
      font-family: 'Tilt Warp';
      font-display: swap;
      src: url('https://fonts.gstatic.com/s/tiltwarp/v18/AlZc_zVDs5XpmO7yn3w7flUoytXJp3z29uEwmEMLEJljLXvT8UJSZQB2C1Y.woff2') format('woff2');
    }
  </style>
</svelte:head>

<main class="gs" class:done={status === 'done'}>
  {#if status === 'done'}
    <p class="msg" aria-live="polite">{message}</p>
  {:else}
    <!-- an error takes the pitch line's place, so the frame needs no spare row -->
    <p class="pitch" class:err={status === 'error'} aria-live="polite">{status === 'error' ? message : 'Teenager? Join Hack Club to find other teen game devs!'}</p>
    <form class="row" onsubmit={submit}>
      <input type="email" placeholder="your email" autocomplete="email" aria-label="Your email" required bind:value={email} disabled={status === 'loading'} />
      <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
      <button type="submit" disabled={status === 'loading'}>I'm in</button>
    </form>
  {/if}
</main>

<style>
  /* the live page's hand cursor (the slot machine embed serves the files) */
  :global(html) {
    --cur: url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor.png') 7 4;
    --cur2: image-set(url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor.png') 1x, url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor-full.png') 2x) 7 4;
    --hov: url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor-hover.png') 7 4;
    --hov2: image-set(url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor-hover.png') 1x, url('https://retrocrow-jam-embeds-retrocrow-4d83a3.k.hackclub.dev/slots/cursor-hover-full.png') 2x) 7 4;
    cursor: var(--cur), auto;
    cursor: var(--cur2), auto;
  }

  /* top-aligned, so the box sits right under the prize list sign above the
     frame (the frame is sized to fit, see the itch snippet in the header) */
  .gs {
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    padding: 2px 2px 4px;
    text-align: center;
    font-family: 'Lexend', sans-serif;
    /* the description's body text, as itch renders it on this page */
    font-size: 17px;
    line-height: 1.5;
    color: #fff;
  }
  .pitch,
  .msg {
    margin: 0;
    text-wrap: balance;
  }
  /* the in-between line is a caption to the box, not body copy: a size down
     and in the column's soft blue-grey ink (custom.css --mf-ink) */
  .pitch {
    font-size: 15px;
    line-height: 1.4;
    color: oklch(0.825 0.025 249);
  }
  .pitch.err {
    color: #ff8fb1; /* the page's link pink */
  }
  .msg {
    font: 400 20px/1.2 'Tilt Warp', sans-serif;
    color: #ffe6ac;
  }

  .row {
    display: flex;
    width: 100%;
    max-width: 440px;
    margin: 0;
  }
  input[type='email'] {
    flex: 1 1 auto;
    min-width: 0;
    box-sizing: border-box;
    height: 42px;
    margin: 0;
    padding: 0 14px;
    font: 400 16px 'Lexend', sans-serif;
    /* a darker step of the column, the sign's navy, with a cream edge */
    color: #ffe6ac;
    background: #26324c;
    border: 2px solid #ffe6ac;
    border-right: 0;
    border-radius: 0;
    outline: 0;
    cursor: text;
  }
  input[type='email']::placeholder {
    color: oklch(0.65 0.03 249);
    opacity: 1;
  }
  input[type='email']:focus-visible {
    background: #1e2840;
  }
  input:disabled {
    opacity: 0.6;
  }

  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

  /* the "see the full prize list" sign: cream, navy text, no border */
  button {
    flex: none;
    height: 42px;
    margin: 0;
    padding: 0 1.1em;
    font: 400 20px/1 'Tilt Warp', sans-serif;
    color: #26324c;
    background: #ffe6ac;
    border: 0;
    border-radius: 0;
    white-space: nowrap;
    cursor: var(--hov), pointer;
    cursor: var(--hov2), pointer;
  }
  button:hover {
    background: #fff6dd;
  }
  button:focus-visible {
    outline: 2px solid #ffe6ac;
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: var(--cur), default;
    cursor: var(--cur2), default;
  }
</style>
