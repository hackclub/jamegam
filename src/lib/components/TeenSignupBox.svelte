<script>
  // /prizes, signed out: what goes in the prize box. The teen signup (email ->
  // /api/signup, same as the homepage boxes) is the main action, since most
  // signed-out visitors haven't made a game yet; signing in, for people who
  // already submitted one and are here to pick, is a quiet text link under it.
  // TeenSignupPopup asks the same thing, but only for visitors from an itch jam
  // page's prize links. The ask is Augie's copy, verbatim.
  import TeenSignup from './TeenSignup.svelte';
  import { signup } from '$lib/signup.js';

  let { ref = '' } = $props();
</script>

<!-- once signed up (here or in the popup) the ask is answered; only "you're in" stays -->
{#if !$signup.done}
  <p class="tsb-line" id="tsb-line">are you a teenager? sign up to join the community &amp; be eligible for prizes!</p>
{/if}
<TeenSignup {ref} inputId="tsb-email" labelledby="tsb-line" />
<p class="tsb-signin">submitted a game? <a href="/api/auth/login?flow=shop">sign in</a></p>

<style>
  /* the ask in ink at the page's --t-card; the sign-in in its faded ink
     (.fine / .suggest-note), underlined, never a second button */
  .tsb-line {
    position: relative;
    margin: 0 0 calc(4px * var(--scale));
    max-width: calc(560px * var(--scale)); /* the slim panels' measure */
    line-height: 1.15;
    text-wrap: balance;
    color: var(--ink);
  }
  .tsb-signin {
    position: relative;
    margin: calc(12px * var(--scale)) 0 0;
    color: rgba(80, 75, 73, 0.55);
  }
  .tsb-signin a {
    color: inherit;
    text-decoration: underline;
  }
  .tsb-signin a:hover {
    color: var(--ink);
  }
</style>
