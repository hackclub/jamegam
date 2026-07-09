<script>
  // Site-styled dropdown (the native <select> looks like a different OS).
  // Trigger = an accent underlined text action, like every other link on the
  // site; the open list is a lumpy 9-slice panel (hover9 skin). Keyboard:
  // enter/space toggles, arrows move the highlight, esc closes.
  let { value = $bindable(), options = [], label = 'choose' } = $props();
  let open = $state(false);
  let hi = $state(-1); // keyboard highlight index
  let root = $state(null);

  const current = $derived(options.find((o) => String(o.value) === String(value)));

  function toggle() {
    open = !open;
    hi = open ? options.findIndex((o) => String(o.value) === String(value)) : -1;
  }
  function pick(o) {
    value = o.value;
    open = false;
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { open = false; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, options.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(options[hi]); }
  }
  function onDocClick(e) {
    if (root && !root.contains(e.target)) open = false;
  }
</script>

<svelte:document onclick={onDocClick} />

<span class="ps" bind:this={root} onkeydown={onKey}>
  <button
    type="button"
    class="ps-btn"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={label}
    onclick={toggle}
  >
    {current?.label ?? label}
  </button>
  {#if open}
    <ul class="ps-list" role="listbox" aria-label={label}>
      {#each options as o, i (o.value)}
        <li>
          <button
            type="button"
            role="option"
            class="ps-opt"
            class:on={String(o.value) === String(value)}
            class:hi={i === hi}
            aria-selected={String(o.value) === String(value)}
            onclick={() => pick(o)}
            onmouseenter={() => (hi = i)}
          >
            {o.label}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</span>

<style>
  .ps {
    position: relative;
    display: inline-block;
  }
  /* the trigger reads as a normal site link-action */
  .ps-btn {
    font-family: inherit;
    font-size: inherit;
    color: var(--accent);
    background: none;
    border: none;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
  }
  /* the open list: lumpy light-gray 9-slice panel (same skin family as the
     card hovers; @8x pre-scale keeps it pixel-crisp) */
  .ps-list {
    position: absolute;
    top: calc(100% + 4px * var(--scale));
    left: 50%;
    transform: translateX(-50%);
    z-index: 70;
    list-style: none;
    margin: 0;
    padding: 0;
    min-width: max-content;
    border: calc(16px * var(--scale)) solid transparent;
    border-image: url('/assets/hover9_a@8x.png') 80 fill stretch;
    image-rendering: pixelated;
  }
  .ps-opt {
    display: block;
    width: 100%;
    font-family: inherit;
    font-size: inherit;
    color: var(--ink);
    text-align: left;
    background: none;
    border: none;
    padding: calc(3px * var(--scale)) calc(6px * var(--scale));
    white-space: nowrap;
    opacity: 0.55;
    cursor: pointer;
  }
  .ps-opt.hi {
    opacity: 0.85;
  }
  .ps-opt.on {
    opacity: 1;
    text-decoration: underline;
  }
</style>
