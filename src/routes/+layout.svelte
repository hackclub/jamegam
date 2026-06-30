<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { loadPrefill } from '$lib/prefill.js';

  let { children } = $props();

  // If they're already signed in to Hack Club, pull their email so the signup
  // boxes come pre-filled (silent, no redirect). No-ops otherwise.
  onMount(loadPrefill);
</script>

{@render children()}
