<script>
  import { onMount } from 'svelte';
  import { initLogo } from '$lib/logo/engine.js';

  /** @type {{ setBooting?: (booting: boolean) => void }} */
  let { setBooting } = $props();

  let stage;
  let word;

  onMount(() => initLogo({ stage, word, setBooting }));
</script>

<!-- sibling of #content so it sits above the page during boot -->
<div id="logo-stage" bind:this={stage}>
  <div class="word" id="word" bind:this={word}></div>
</div>
