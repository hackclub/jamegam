<script>
  // /embed/* - bits of the site framed into this month's itch jam page. The
  // iframe sits on itch's own (translucent, dusty) page, so the document is
  // transparent, and every link opens a new tab instead of navigating the frame.
  let { children } = $props();
</script>

<svelte:head>
  <base target="_blank" />
  <meta name="robots" content="noindex" />
</svelte:head>

{@render children()}

<style>
  :global(html), :global(body) {
    background: transparent !important;
    overflow: hidden;
  }
  /* the boot vignette in app.html belongs to the homepage logo boot */
  :global(#boot-vignette) {
    display: none;
  }
</style>
