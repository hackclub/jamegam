<script>
  // The teen signup row on /prizes (the box at the top + the popup): the
  // homepage's email box + "i'm in" art, doing exactly what the homepage boxes
  // do: POST /api/signup (Airtable row, Loops list, welcome email) and show the
  // same "check your email" line. page + ref tag the row's signup_origin (see
  // $lib/signupref.js).
  import { onMount } from 'svelte';
  import { prefillEmail } from '$lib/prefill.js';
  import { signup, submitSignup } from '$lib/signup.js';

  /** @type {{ ref?: string, autofocus?: boolean, inputId?: string, labelledby?: string }} */
  let { ref = '', autofocus = false, inputId = 'teen-email', labelledby = '' } = $props();

  let email = $state('');
  let company = $state(''); // honeypot - real humans never see or fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');
  /** @type {HTMLInputElement | null} */
  let inputEl = $state(null);

  onMount(() => {
    if (autofocus) inputEl?.focus();
    // the box and the popup are one signup, like the homepage boxes: once
    // either succeeds, both show "you're in"
    const offSignup = signup.subscribe((st) => {
      if (st.done) {
        status = 'done';
        message = st.message;
      }
    });
    const offPrefill = prefillEmail.subscribe((v) => {
      if (v && !email) email = v;
    });
    return () => {
      offSignup();
      offPrefill();
    };
  });

  /** @param {SubmitEvent} e */
  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading' || status === 'done') return;
    status = 'loading';
    message = '';
    try {
      const r = await submitSignup({ email: v, company, page: 'prizes', ref });
      if (!r.ok) {
        status = 'error';
        message = r.error || 'hmm, that didn’t work. try again?';
        return;
      }
      status = 'done';
      message = r.message || 'you’re in! check your email :]';
    } catch {
      status = 'error';
      message = 'network hiccup, try again?';
    }
  }
</script>

<div class="ts">
  {#if status === 'done'}
    <p class="ts-done" aria-live="polite">{message}</p>
  {:else}
    <form class="ts-row" onsubmit={submit}>
      <span class="ts-box">
        <input
          id={inputId}
          bind:this={inputEl}
          type="email"
          placeholder="your email..."
          autocomplete="email"
          aria-label={labelledby ? undefined : 'your email'}
          aria-labelledby={labelledby || undefined}
          required
          bind:value={email}
          disabled={status === 'loading'}
        />
      </span>
      <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
      <button class="ts-im" type="submit" disabled={status === 'loading'}>
        <img src="/assets/imin.png" alt="i’m in" />
      </button>
    </form>
    {#if status === 'error'}
      <p class="ts-err" aria-live="polite">{message}</p>
    {/if}
  {/if}
</div>

<style>
  /* same art + type as the homepage box (EmailSignup.svelte) */
  .ts {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: calc(46px * var(--scale));
    justify-content: center;
  }
  .ts-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(10px * var(--scale));
    margin: 0;
    max-width: 100%;
  }
  .ts-box {
    display: block;
    flex: 0 1 calc(282px * var(--scale));
    min-width: 0;
    height: calc(46px * var(--scale));
    background: url('/assets/email_box542.png') no-repeat center / 100% 100%;
  }
  .ts-box input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background: transparent;
    border: 0;
    outline: 0;
    font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif;
    font-size: calc(24px * var(--scale));
    color: #7a7470;
    padding: 0 calc(18px * var(--scale));
  }
  .ts-box input::placeholder {
    color: #d9d4d8;
    opacity: 1;
  }
  .ts-box input:disabled {
    opacity: 0.6;
  }
  /* the box art has no focus state of its own; dim it a touch (the caret
     does the rest, as on the homepage box) */
  .ts-box:focus-within {
    filter: brightness(0.96);
  }

  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .ts-im {
    flex: none;
    width: calc(107.7px * var(--scale));
    height: calc(40px * var(--scale));
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    opacity: 0.8;
  }
  .ts-im:hover {
    opacity: 0.9;
  }
  .ts-im:focus-visible {
    outline: 2px solid #91a4db;
    outline-offset: 2px;
  }
  .ts-im:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ts-im img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .ts-done,
  .ts-err {
    margin: 0;
    font-family: 'augiepixel', sans-serif;
  }
  /* phones: the type steps down a quarter at this width (app.css mobile
     tier), so the box + button step down with it instead of towering over it */
  @media (max-width: 639px) {
    .ts {
      min-height: calc(37px * var(--scale));
    }
    .ts-box {
      flex-basis: calc(240px * var(--scale));
      height: calc(37px * var(--scale));
    }
    .ts-box input {
      font-size: calc(20px * var(--scale));
      padding: 0 calc(14px * var(--scale));
    }
    .ts-im {
      width: calc(86px * var(--scale));
      height: calc(32px * var(--scale));
    }
  }

  /* the page's own colours: ink for the confirmation, accent for errors
     (as /prizes .err) */
  .ts-done {
    font-size: var(--t-card);
    color: var(--ink);
  }
  .ts-err {
    font-size: var(--t-card);
    color: var(--accent);
    margin-top: calc(8px * var(--scale));
  }
</style>
