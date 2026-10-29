<script>
  import { formatGitHubCommand } from '$lib/guides/github.js';

  let { template, repository = null } = $props();
  const command = $derived(formatGitHubCommand(template, repository));
  const tokens = $derived(command.match(/"[^"\n]*"|'[^'\n]*'|\s+|[^\s]+/g) ?? []);

  function tokenClass(token, index) {
    if (/^\s+$/.test(token)) return '';
    if (index === 0 || /^(git|gh|winget|brew|sudo|cd)$/.test(token)) return 'executable';
    if (/^https?:\/\//.test(token)) return 'url';
    if (/^--?\w/.test(token)) return 'flag';
    if (/^["']/.test(token)) return 'string';
    if (/^\{\w+\}$/.test(token)) return 'variable';
    return '';
  }
</script>

<pre aria-label="Command"><code>{#each tokens as token, index}<span class={tokenClass(token, index)}>{token}</span>{/each}</code></pre>

<style>
  pre {
    max-width: 100%;
    overflow-x: auto;
    padding: 1.15rem 1.25rem;
    background: #f1eee8;
    color: var(--ink);
    border-radius: 4px;
    font-size: 1rem;
    line-height: 1.6;
    tab-size: 2;
    scrollbar-color: #a69a8c #f1eee8;
  }
  code { font-family: ui-monospace, monospace; }
  .executable { color: #7c3e58; font-weight: 600; }
  .url { color: #365c85; }
  .flag { color: #885522; }
  .string { color: #41653b; }
  .variable { color: #885522; }
  ::selection { background: #d9dff0; }
</style>
