<script>
  import { onMount } from 'svelte';
  import { jiggle } from '$lib/actions/jiggle.js';
  import { prefillEmail } from '$lib/prefill.js';
  import { signup, submitSignup } from '$lib/signup.js';

  let email = $state('');
  let company = $state(''); // honeypot - real humans never fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');

  onMount(() => {
    // prefill from a logged-in Hack Club session, but never clobber what they typed
    prefillEmail.subscribe((v) => { if (v && !email) email = v; });
    // if any box on the page already signed up, show "you're in" here too
    signup.subscribe((s) => { if (s.done) { status = 'done'; message = s.message; } });
  });

  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading' || status === 'done') return;
    status = 'loading';
    message = '';
    try {
      const r = await submitSignup({ email: v, company });
      // success flips the shared `signup` store, which our subscription above
      // turns into status = 'done'. We only handle the error case here.
      if (!r.ok) {
        status = 'error';
        message = r.error || 'hmm, that didn’t work - try again?';
      }
    } catch {
      status = 'error';
      message = 'network hiccup - try again?';
    }
  }
</script>

<!-- ===== READY? =====
     A short closing call-to-action between "who's behind this" and the FAQ: the
     "ready?" heading (carrying the same live rainbow scribble underline as the
     word "prizes" in the hero — opted in via use:jiggle={{ prizeWord: 'ready' }}),
     then another copy of the email box + "i'm in" button. The field is duplicated
     with `ready-`-prefixed ids (like the HowItWorks step-1 copy) so the form/button
     association and the centred field markup stay self-contained. -->
<section class="sec sec-ready">
  <div class="col ready-inner">
    <h2 class="txt ready-title" use:jiggle={{ prizeWord: 'ready', underlineNoHook: true, underlineExtendLeft: 9 }}>ready?</h2>

    <div class="ready-email-field">
      {#if status === 'done'}
        <p class="ready-email-msg" aria-live="polite">{message}</p>
      {:else}
        <form id="ready-email-form" class="ready-email-box" method="post" action="/api/signup" onsubmit={submit}>
          <input id="ready-email-input" type="email" placeholder="your email..." autocomplete="email" required bind:value={email} disabled={status === 'loading'} />
          <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
        </form>
        <button type="submit" form="ready-email-form" class="ready-email-im" aria-label="i'm in" disabled={status === 'loading'}>
          <img src="/assets/imin.png" alt="i&rsquo;m in" />
        </button>
      {/if}
    </div>
    {#if status === 'error'}
      <p class="ready-email-msg ready-email-err" aria-live="polite">{message}</p>
    {/if}
  </div>
</section>

<style>
  .sec-ready { padding-block: calc(140px * var(--scale)); }
  .ready-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .ready-title {
    font-weight: normal;     /* single-weight pixel font: drop the <h2> faux-bold to match the other section titles */
    font-size: var(--t-title);
    color: #514c49;
    line-height: 1.05;
    margin-bottom: calc(40px * var(--scale));
  }

  /* email field: another copy of the signup CTA (input box + "i'm in" button) */
  .ready-email-field {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: calc(10px * var(--scale));
    max-width: 100%;
    /* lock to the box height so swapping in the "you're in" message doesn't
       shift the page vertically (matches the hero + how-it-works fields) */
    min-height: calc(46px * var(--scale));
  }
  .ready-email-box {
    flex: 1 1 calc(282px * var(--scale));
    max-width: calc(282px * var(--scale));
    height: calc(46px * var(--scale));
    background: url('/assets/email_box542.png') no-repeat center / 100% 100%;
  }
  #ready-email-input {
    width: 100%; height: 100%; box-sizing: border-box;
    background: transparent; border: 0; outline: 0;
    font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif; font-size: calc(24px * var(--scale)); color: #7a7470;
    padding: 0 calc(18px * var(--scale));
  }
  #ready-email-input::placeholder { color: #d9d4d8; opacity: 1; }
  .ready-email-im {
    flex: none;
    width: calc(107.7px * var(--scale)); height: calc(40px * var(--scale));
    padding: 0; border: 0; background: none; cursor: pointer;
    opacity: 0.8;
  }
  .ready-email-im:hover { opacity: 0.9; }
  .ready-email-im img { width: 100%; height: 100%; display: block; }

  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .ready-email-msg {
    font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif;
    font-size: calc(24px * var(--scale));
    color: #7a7470;
    margin: 0;
  }
  .ready-email-err { color: #c2566e; margin-top: calc(8px * var(--scale)); }
</style>
