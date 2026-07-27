<script>
  // The ceiling trophy, cloned: when a signup succeeds, a giant "#1 email
  // giver" cup flies down over a dimmed page, holds centre stage, then fades.
  // Fires once per session off the shared `signup` store, so it plays no
  // matter which of the "i'm in" boxes they used.
  import { onMount } from 'svelte';
  import { signup } from '$lib/signup.js';

  let show = $state(false);

  onMount(() =>
    signup.subscribe((s) => {
      if (s.done && !show) {
        show = true;
        document.documentElement.classList.add('trophy-lock');
      }
    })
  );
</script>

{#if show}
  <!-- overlay outlives the trophy (5.5s vs 4.5s); its end tears both down -->
  <div class="trophy-overlay" onanimationend={() => (show = false)}></div>
  <img
    class="trophy"
    src="/assets/trophy.png"
    alt=""
    onanimationend={() => document.documentElement.classList.remove('trophy-lock')}
  />
{/if}

<style>
  .trophy-overlay {
    position: fixed;
    inset: 0;
    background: black;
    opacity: 0;
    pointer-events: none;
    z-index: 999;
    animation: trophy-dim 5.5s linear forwards;
  }
  .trophy {
    position: fixed;
    left: 50%;
    top: 50%;
    height: 80vh;
    transform: translate(-50%, -150vh);
    opacity: 0;
    pointer-events: none;
    z-index: 1000;
    animation: trophy-fly 4.5s linear forwards;
  }
  :global(html.trophy-lock),
  :global(html.trophy-lock body) {
    overflow: hidden;
  }

  @keyframes trophy-fly {
    0%    { transform: translate(-50%, -150vh); opacity: 1; }
    60%   { transform: translate(-50%, -50%); opacity: 1; }
    90.3% { transform: translate(-50%, -50%); opacity: 1; }
    100%  { transform: translate(-50%, -50%); opacity: 0; }
  }

  @keyframes trophy-dim {
    0%    { opacity: 0; }
    16.4% { opacity: 0.5; }
    81.8% { opacity: 0.5; }
    100%  { opacity: 0; }
  }
</style>
