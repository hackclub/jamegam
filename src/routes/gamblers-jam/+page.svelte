<script>
  // /gamblers-jam - the prize rules for the mfg gambler's jam (retrocrow x hack
  // club), linked from the itch page's "requirements & more info". The copy is
  // augie's, in ./copy.md; this file only renders it, so copy edits never touch
  // the markup. Rendered at build time (the layout prerenders), so it's flat HTML.
  //
  // Markdown it handles: # title, ## sections, paragraphs, "-" / "1." lists
  // (nested by indent, tab or spaces; ordered lists renumber 1..n themselves),
  // **bold**, *italic*, [links](url) and <url> autolinks. A bare-domain href
  // gets https:// added. In the faq, a paragraph whose first line is all bold
  // is a question, the rest its answer. A list right after a paragraph that
  // ends in ":" is grouped with it (the eligibility checklist).
  //
  // Every section heading and faq question gets a "#" link to itself: clicking
  // it jumps there (so the url bar shows /gamblers-jam#slug) and copies that url.
  import Footer from '$lib/components/sections/Footer.svelte';
  import Dust from '$lib/components/Dust.svelte';
  import { deobfuscateEmail } from '$lib/actions/email.js';
  import { SITE_URL } from '$lib/site.js';
  import source from './copy.md?raw';

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rev = (s) => s.split('').reverse().join('');

  // "hackatime.hackclub.com" -> "https://hackatime.hackclub.com"; anything with a
  // scheme, or a relative / anchor link, is left alone
  const fixHref = (h) =>
    /^[a-z][a-z0-9+.-]*:/i.test(h) || /^[/#?]/.test(h) ? h : `https://${h}`;

  const emph = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');

  // mailto links use the site's obfuscated form (email.js rebuilds them after
  // hydration, so the prerendered HTML carries no "@")
  function link(text, href) {
    const mail = href.match(/^mailto:([^@]+)@(.+)$/);
    if (mail) {
      const [, u, d] = mail;
      return `<a class="email-obf" data-u="${esc(rev(u))}" data-d="${esc(rev(d))}">${esc(u)} on ${esc(d)}</a>`;
    }
    const url = fixHref(href);
    const ext = /^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${esc(url)}"${ext}>${emph(esc(text))}</a>`;
  }

  // links come out first (into placeholders) so emphasis never touches a url,
  // then everything else is escaped and emphasised, then the links go back in
  function inline(s) {
    const links = [];
    const hold = (html) => `\u0000${links.push(html) - 1}\u0000`;
    s = s
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => hold(link(text, href)))
      .replace(/<([^\s<>]+\.[^\s<>]+)>/g, (_, url) => hold(link(url, url)));
    return emph(esc(s)).replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
  }

  // readable, stable ids from the heading text: links keep their text, markdown
  // marks drop, apostrophes vanish ("i'm" -> "im"), the rest becomes dashes.
  // The section ids match the ones the page had before (no apostrophes or
  // links in those headings), so existing links keep working.
  const plain = (s) =>
    s
      .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
      .replace(/<([^\s<>]+)>/g, '$1')
      .replace(/[*_]/g, '');
  const slug = (s) =>
    plain(s)
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const indentOf = (l) => l.match(/^[\t ]*/)[0].replace(/\t/g, '    ').length;
  const ITEM = /^[\t ]*([-*+]|\d+[.)])\s+(.*)$/;

  // everything from the first "---" down is notes, never page copy
  const body = source.split(/^---\s*$/m)[0];

  function parse(md) {
    let title = '';
    const intro = [];
    const sections = [];
    let into = intro;
    let para = []; // lines of the paragraph being collected
    let stack = []; // open lists, outermost first: { indent, node }
    const used = new Set();
    const uniq = (s) => {
      let id = s || 'section';
      for (let n = 2; used.has(id); n++) id = `${s}-${n}`;
      used.add(id);
      return id;
    };

    const flushPara = () => {
      if (!para.length) return;
      const q = para[0].match(/^\*\*(.+)\*\*$/);
      if (q && para.length > 1)
        into.push({ type: 'qa', id: uniq(slug(q[1])), q: inline(q[1]), a: inline(para.slice(1).join(' ')) });
      else into.push({ type: 'p', html: inline(para.join(' ')), raw: para.join(' ') });
      para = [];
    };
    // a top-level list; if the block before it is a paragraph ending in ":",
    // the two become one group (lead line + list)
    const pushList = (node) => {
      const prev = into[into.length - 1];
      if (prev?.type === 'p' && /:\s*$/.test(prev.raw)) {
        into[into.length - 1] = { type: 'group', lead: prev.html, list: node };
      } else into.push(node);
    };
    const flushList = () => (stack = []);

    for (const raw of md.split('\n')) {
      const line = raw.trim();
      // blank or whitespace-only: ends whatever paragraph / list was open
      if (!line) {
        flushPara();
        flushList();
        continue;
      }
      const h = line.match(/^(#{1,2})\s+(.*)$/);
      if (h) {
        flushPara();
        flushList();
        if (h[1] === '#') title = h[2].replace(/\*+/g, '');
        else {
          const sec = { heading: inline(h[2]), id: uniq(slug(h[2])), blocks: [] };
          sections.push(sec);
          into = sec.blocks;
        }
        continue;
      }
      const item = raw.match(ITEM);
      if (item && !para.length) {
        const indent = indentOf(raw);
        const kind = /\d/.test(item[1]) ? 'ol' : 'ul';
        const entry = { html: inline(item[2]), children: [] };
        // close lists indented deeper than this item
        while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();
        const top = stack[stack.length - 1];
        if (!top) {
          const node = { type: kind, items: [entry] };
          pushList(node);
          stack.push({ indent, node });
        } else if (indent > top.indent) {
          // nested list, hung off the last item of the list above
          const parent = top.node.items[top.node.items.length - 1];
          const node = { type: kind, items: [entry] };
          parent.children.push(node);
          stack.push({ indent, node });
        } else {
          top.node.items.push(entry);
        }
        continue;
      }
      if (stack.length) {
        // a plain line inside a list continues the last item
        const items = stack[stack.length - 1].node.items;
        items[items.length - 1].html += ' ' + inline(line);
        continue;
      }
      para.push(line);
    }
    flushPara();
    return { title, intro, sections };
  }

  const doc = parse(body);

  // "#" links: let the browser follow the hash (that's the jump + url bar),
  // and also copy the full url. `copied` holds the id that was just copied.
  let copied = $state('');
  let copiedTimer;
  function copyLink(id) {
    const url = `${location.origin}${location.pathname}#${id}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        copied = id;
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => (copied = ''), 1600);
      },
      () => {}
    );
  }

  const canonical = `${SITE_URL}/gamblers-jam`;
  const ogImage = `${SITE_URL}/og-image.png`;
  const title = "prizes at the mfg gambler's jam - jame gam";
  const description =
    "teenagers (13 to 18) who make a game for the mfg gambler's jam can get a prize from hack club. who's eligible, what happens after the jam, and the faq.";
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />

  <!-- Jua for this page only; the rest of the site stays on the pixel fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&display=swap" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="jame gam" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImage} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>


{#snippet list(node)}
  <svelte:element this={node.type} class="mf-list">
    {#each node.items as item}
      <li>
        {@html item.html}
        {#each item.children as child}{@render list(child)}{/each}
      </li>
    {/each}
  </svelte:element>
{/snippet}

<!-- the "#" that links a heading to itself. It sits after the heading text,
     glued on with a word joiner so it never wraps onto a line alone; wide
     screens hang it out in the left margin instead. -->
{#snippet anchor(id)}&#8288;<a
    class="mf-anchor"
    href="#{id}"
    aria-label="link to this section"
    data-copied={copied === id ? '' : undefined}
    onclick={() => copyLink(id)}>#</a
  >{/snippet}

{#snippet blocks(items)}
  {#each items as b}
    {#if b.type === 'p'}
      <p class="mf-p">{@html b.html}</p>
    {:else if b.type === 'ol' || b.type === 'ul'}
      {@render list(b)}
    {:else if b.type === 'group'}
      <div class="mf-group">
        <p class="mf-lead">{@html b.lead}</p>
        {@render list(b.list)}
      </div>
    {:else if b.type === 'qa'}
      <div class="mf-qa">
        <h3 class="mf-q mf-anchored" id={b.id}>{@html b.q}{@render anchor(b.id)}</h3>
        <p class="mf-a">{@html b.a}</p>
      </div>
    {/if}
  {/each}
{/snippet}

<!-- #page picks up app.css's overscroll lift, which the footer's rainbow
     stretch relies on (same shell as the home page) -->
<div id="page">
  <!-- ambient dust motes, full-bleed behind the text and footer, like /prizes -->
  <div class="mf-dust" aria-hidden="true"><Dust /></div>

<main class="page" use:deobfuscateEmail>
  <h1 class="mf-title">{doc.title}</h1>

  {@render blocks(doc.intro)}

  {#each doc.sections as sec}
    <section id={sec.id} class="mf-sec">
      <h2 class="mf-h mf-anchored">{@html sec.heading}{@render anchor(sec.id)}</h2>
      {@render blocks(sec.blocks)}
    </section>
  {/each}

  <span class="mf-sr" aria-live="polite">{copied ? 'link copied' : ''}</span>
</main>

  <!-- the home page's footer: links, then the rainbow rising from the very bottom -->
  <Footer />
</div>

<style>
  /* the boot vignette in app.html is for the homepage's logo boot; nothing
     fades it out on subpages, so hide it here */
  :global(#boot-vignette) {
    display: none;
  }

  /* Type and colour follow jame gam's own itch page: Jua throughout, warm
     brown-gray body text with a darker ink for headings and bold, and the
     five palette colours (red, orange, green, blue, purple) cycling through
     the list markers. Links are the dark ink with a palette-red underline.
     Three type sizes: title, section heading, body. */
  .page {
    --mf-bg: #fbfbfb;
    --mf-ink: #534a46;
    --mf-text: #746560;
    --mf-red: #db9591;
    --mf-orange: #dbaf91;
    --mf-green: #97db91;
    --mf-blue: #91a4db;
    --mf-purple: #b991db;
    --mf-panel: color-mix(in oklch, var(--mf-orange) 13%, var(--mf-bg));

    --sp-2xs: 4px;
    --sp-xs: 8px;
    --sp-sm: 12px;
    --sp-md: 16px;
    --sp-lg: 24px;
    --sp-xl: 32px;
    --sp-2xl: 48px;
    --sp-3xl: 72px;

    /* above the dust layer */
    position: relative;
    z-index: 1;
    max-width: 34em;
    margin: 0 auto;
    padding: 80px var(--sp-lg) 0;
    box-sizing: content-box;
    font-family: 'Jua', system-ui, sans-serif;
    font-size: 19px;
    line-height: 1.6;
    color: var(--mf-text);
    -webkit-font-smoothing: antialiased;
    overflow-wrap: break-word;
  }

  /* covers the whole #page (column and footer), under the text */
  .mf-dust {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  .mf-title {
    margin: 0 0 var(--sp-lg);
    font-size: clamp(40px, 1.5vw + 28px, 52px);
    font-weight: normal;
    line-height: 1.1;
    color: var(--mf-ink);
    text-wrap: balance;
  }

  .mf-p {
    margin: 0 0 var(--sp-md);
  }

  .page :global(strong) {
    font-weight: bold;
    color: var(--mf-ink);
  }
  .page :global(em) {
    font-style: italic;
    color: var(--mf-ink);
  }
  .page :global(a) {
    color: var(--mf-ink);
    text-decoration: underline;
    text-decoration-color: var(--mf-red);
    text-decoration-thickness: 2px;
    text-underline-offset: 0.18em;
    transition: text-decoration-color 0.15s ease;
  }
  .page :global(a:hover) {
    text-decoration-color: currentColor;
  }
  .page :global(a:focus-visible) {
    outline: 2px solid var(--mf-ink);
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* ===== sections ===== */
  .mf-sec {
    margin-top: var(--sp-3xl);
  }
  .mf-sec,
  .mf-q {
    scroll-margin-top: var(--sp-xl);
  }
  .mf-h {
    margin: 0 0 var(--sp-md);
    font-size: 36px;
    font-weight: normal;
    line-height: 1.15;
    color: var(--mf-ink);
  }

  /* ===== heading links ===== */
  .mf-anchored {
    position: relative;
  }
  .mf-anchor {
    position: absolute;
    top: 0;
    right: 100%;
    padding: 0 0.3em;
    color: var(--mf-text);
    opacity: 0.3;
    text-decoration: none !important;
    transition:
      opacity 0.15s ease,
      color 0.15s ease;
  }
  .mf-anchored:hover .mf-anchor,
  .mf-anchor:focus-visible,
  .mf-sec:target > .mf-h .mf-anchor,
  .mf-q:target .mf-anchor {
    opacity: 1;
    color: var(--mf-ink);
  }
  /* "copied", a small label over the "#" for a moment after a click */
  .mf-anchor[data-copied]::after {
    content: 'copied';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translate(-50%, -2px);
    padding: 2px 8px;
    border-radius: 6px;
    background: var(--mf-ink);
    color: var(--mf-bg);
    font-size: 14px;
    line-height: 1.5;
    white-space: nowrap;
    pointer-events: none;
    animation: mf-pop 0.15s ease-out;
  }
  @keyframes mf-pop {
    from {
      opacity: 0;
    }
  }
  .mf-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* ===== lists ===== */
  .page :global(.mf-list) {
    margin: 0 0 var(--sp-lg);
    padding: 0;
  }
  .page :global(.mf-list > li + li) {
    margin-top: var(--sp-sm);
  }

  /* bullets: jame gam's chevron, in the palette colours */
  .page :global(ul.mf-list) {
    list-style: none;
  }
  .page :global(ul.mf-list > li) {
    position: relative;
    padding-left: 1.3em;
  }
  .page :global(ul.mf-list > li::before) {
    content: '';
    position: absolute;
    left: -2px;
    top: 0.62em;
    width: 16px;
    height: 9px;
    transform: rotate(-90deg);
    background: var(--mf-c, var(--mf-red));
    -webkit-mask: url('/assets/chevron.png') center / 100% 100% no-repeat;
    mask: url('/assets/chevron.png') center / 100% 100% no-repeat;
  }

  /* numbered steps: rainbow numerals, like the home page's "how it works" */
  .page :global(ol.mf-list) {
    padding-left: 1.6em;
  }
  .page :global(ol.mf-list > li) {
    padding-left: 0.35em;
  }
  .page :global(ol.mf-list > li::marker) {
    color: var(--mf-c, var(--mf-red));
  }

  .page :global(.mf-list > li:nth-child(5n + 2)) {
    --mf-c: var(--mf-orange);
  }
  .page :global(.mf-list > li:nth-child(5n + 3)) {
    --mf-c: var(--mf-green);
  }
  .page :global(.mf-list > li:nth-child(5n + 4)) {
    --mf-c: var(--mf-blue);
  }
  .page :global(.mf-list > li:nth-child(5n + 5)) {
    --mf-c: var(--mf-purple);
  }

  /* a nested list: same type as the body, just tucked under its item */
  .page :global(.mf-list .mf-list) {
    margin: var(--sp-xs) 0 0;
  }

  /* the eligibility checklist: its lead line plus the list, on a warm tint */
  .mf-group {
    margin: var(--sp-xl) 0;
    padding: var(--sp-lg) var(--sp-xl) var(--sp-xs);
    border-radius: 16px;
    background: var(--mf-panel);
  }
  .mf-lead {
    margin: 0 0 var(--sp-md);
  }

  /* ===== faq ===== */
  .mf-qa + .mf-qa {
    margin-top: var(--sp-xl);
  }
  /* questions: body size, in the ink and bold that strong text uses */
  .mf-q {
    margin: 0 0 var(--sp-2xs);
    font-size: 1em;
    font-weight: bold;
    line-height: inherit;
    color: var(--mf-ink);
  }
  .mf-a {
    margin: 0;
  }

  /* no room in the margin to hang the "#": put it after the heading text */
  @media (max-width: 760px) {
    .mf-anchor {
      position: relative;
      right: auto;
      padding: 0 0.2em;
      margin-left: 0.1em;
    }
    .mf-anchor[data-copied]::after {
      left: auto;
      right: 0;
      transform: translateY(-2px);
    }
  }

  @media (max-width: 639px) {
    .page {
      padding: 48px var(--sp-md) 0;
      font-size: 18px;
      line-height: 1.6;
    }
    .mf-sec {
      margin-top: 56px;
    }
    .mf-h {
      font-size: 30px;
    }
    .mf-group {
      margin-inline: calc(var(--sp-xs) * -1);
      padding: var(--sp-md) var(--sp-md) var(--sp-2xs);
      border-radius: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mf-anchor,
    .page :global(a) {
      transition: none;
    }
    .mf-anchor[data-copied]::after {
      animation: none;
    }
  }
</style>
