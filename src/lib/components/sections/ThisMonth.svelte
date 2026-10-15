<script>
  import { onMount } from 'svelte';
  import { JAM } from '$lib/jam.js';

  let countdownEl;
  let monthEl;
  let whenEl;
  let whatEl;
  let durEl;
  let nextEl;

  // whole days from the dates, so the duration line can't drift from jam.js
  const DAYS = Math.round((Date.parse(JAM.endDate) - Date.parse(JAM.startDate)) / 86400000);
  const daysText = `${DAYS} day${DAYS === 1 ? '' : 's'}`;
  // our own jam is "the jam"; someone else's is "this jam"
  const theJam = JAM.hosted ? 'the jam' : 'this jam';

  // caption: JAM.captionRainbow (a suffix of displayName) gets one site
  // palette colour per letter, red first, cycling; spaces don't use a colour.
  const RAINBOW = ['#db9591', '#dbaf91', '#dbd991', '#97db91', '#91a4db', '#b991db'];
  const rainbowPart =
    JAM.captionRainbow && JAM.displayName.endsWith(JAM.captionRainbow) ? JAM.captionRainbow : '';
  const capHead = JAM.displayName.slice(0, JAM.displayName.length - rainbowPart.length);
  let k = 0;
  const capRainbow = [...rainbowPart].map((ch) => ({
    ch,
    color: ch === ' ' ? null : RAINBOW[k++ % RAINBOW.length]
  }));

  onMount(() => {
    // dates come from $lib/jam.js (shared with the Event JSON-LD). times are UTC.
    // the three branches below switch automatically off those dates, so next
    // month just update JAM and this cycles through before/during/after again.
    const START = Date.parse(JAM.startDate);
    const END   = Date.parse(JAM.endDate);
    const z2 = (n) => String(n).padStart(2, '0');
    // clamp so longer copy wraps instead of running wide
    const clamp = () => { durEl.style.whiteSpace = 'normal'; durEl.style.maxWidth = '400px'; };
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000);
      return `${JAM.hosted ? 'it starts ' : ''}in ${Math.floor(s / 86400)}:${z2(Math.floor((s % 86400) / 3600))}:${z2(Math.floor((s % 3600) / 60))}:${z2(s % 60)}`;
    };
    function tick() {
      const now = Date.now();
      if (now < START) {
        countdownEl.textContent = fmt(START - now);            // before it starts: count down to start
      } else if (now < END) {
        countdownEl.textContent = "it's started!";
        durEl.innerHTML = "it&rsquo;s never too late to join!!";
        clamp();
      } else {
        // jam's over: past-tense the copy + invite them back next month
        countdownEl.textContent = "it's over!";
        // if the calendar has rolled past the jam's month (JAM not updated yet),
        // "this month" would be wrong - say "last month" instead. UTC, like the dates.
        const end = new Date(END), today = new Date(now);
        const sameMonth = end.getUTCFullYear() === today.getUTCFullYear() && end.getUTCMonth() === today.getUTCMonth();
        const when = sameMonth ? "this month" : "last month";
        if (JAM.hosted) {
          whenEl.textContent = `${when}...`;
          whatEl.textContent = 'we ran our own!';
        } else {
          monthEl.textContent = `${when} we crashed`;
        }
        durEl.innerHTML = `${theJam} ran for <span style="color:${JAM.color};">${daysText}</span>!`;
        nextEl.style.display = "";   // reveal the "join us next month" line
        clamp();
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });
</script>

<!-- ===== THIS MONTH =====
     Centre column flows normally: headline -> title box -> countdown ->
     duration -> disclaimer. The title row used to pair the box with a jam
     video (see git history for the video column); this month it is just the
     box, centred. -->
<section id="this-month" class="sec sec-month">
  <div class="col month-inner">
    {#if !JAM.hosted}
      <h2 bind:this={monthEl} id="jam-month" class="txt month-head">this month we&rsquo;re crashing</h2>
    {/if}

    <div class="titlerow">
      <!-- jam title: two stacked transparent layers (same construction as the
           june comp, figma node 1:45): the gray hand-drawn border as one whole
           image (always connects its corners) with this month's title art
           layered inside, over a fill. art + fill come from JAM.titleArt /
           JAM.titleFill. -->
      <div class="jamcol">
        {#if JAM.hosted}
          <!-- our own jam: a small "this month..." kicker pinned to the box's
               top-left stroke, then the punchline at headline size centred
               over the box, both tilted to match the hand-drawn border. inside
               .jamcol so both can measure off the box itself. -->
          <h2 id="jam-month" class="month-head hosted">
            <span bind:this={whenEl} class="txt month-when">this month...</span>
            <span bind:this={whatEl} class="txt month-what">we&rsquo;re running our own!</span>
          </h2>
        {/if}
        <a class="jamtitle" href={JAM.itchUrl} target="_blank" rel="noopener" aria-label="{JAM.name} on itch.io">
          <!-- big "open in new tab" icon tucked under the box's right edge; the
               whole box is the link, and hovering anywhere darkens the icon -->
          <span class="jamtitle-newtab" aria-hidden="true"><img src="/assets/newtab.png" alt="" /></span>
          <span class="jamtitle-bg" style="background-image: url('{JAM.titleFill}');" aria-hidden="true"></span>
          {#if JAM.titleArt}<img class="jamtitle-card" src={JAM.titleArt} alt={JAM.name} />{/if}
          <span class="jamtitle-border" aria-hidden="true"></span>
        </a>
        <!-- which jam the box above is, in the headline's voice and style
             (JAM.displayName, so this rolls over with the rest of jam.js). -->
        <p class="txt jamtitle-cap">{capHead}{#each capRainbow as { ch, color }}<span style:color={color}>{ch}</span>{/each}</p>
      </div>
    </div>

    <!-- countdown -->
    <p bind:this={countdownEl} id="countdown" class="txt month-count">{JAM.hosted ? 'it starts ' : ''}in 7:18:40:53</p>
    <p bind:this={durEl} id="jam-duration" class="txt month-dur">{theJam} will run for <span style="color:{JAM.color};">{daysText}</span>!</p>
    <!-- post-jam only: revealed by tick() once the jam has ended (hidden until then) -->
    <div bind:this={nextEl} id="jam-next" style="display:none;">
      <p class="txt month-next">made a game? <a href={JAM.submitUrl}>submit it here</a>!</p>
      <p class="txt month-next">and join us next month for another jam!</p>
    </div>
    {#if JAM.disclaimer}<p class="txt month-disclaimer">{JAM.disclaimer}</p>{/if}
  </div>
</section>

<style>
  .sec-month {
    padding-top: calc(32px * var(--scale));
    padding-bottom: calc(60px * var(--scale));
    /* sit BELOW the bottom rainbow glow (z-index 1) so the glow washes over the
       top of this section, while hero + the email blob stay above it. */
    z-index: 0;
  }
  .month-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .month-head {
    align-self: center;
    width: 100%;
    max-width: var(--col);   /* roughly match the title row's width so it lines up */
    text-align: left;
    font-weight: normal;     /* it's an <h2>; keep the single-weight pixel look (no faux-bold) */
    font-size: var(--t-title);
    color: #504b49;
    line-height: 1.05;
    text-wrap: balance;      /* when it wraps on phones, no lone last word */
  }
  .month-head.hosted {
    display: flex;
    flex-direction: column;
    /* same net gap to the box as the plain headline gets (its 10px less the
       .titlerow's -18px pull-up, which sits above this one instead) */
    margin-bottom: calc(-8px * var(--scale));
  }
  /* both lines tilt with the border (same angle as the caption under the box) */
  .month-when {
    align-self: flex-start;
    /* left edge on the border's top-left stroke: the box's 14px nudge, plus
       where title_border.png's stroke starts (x=24 of its 45px left slice,
       which border-image draws at 3.4% of the box width = ~1.8%). pivoting on
       the bottom-left keeps that corner put while the text tilts. */
    margin-left: calc(14px * var(--scale) + 1.8%);
    font-size: calc(30px * var(--scale));
    transform: rotate(1.3deg);
    transform-origin: left bottom;
  }
  .month-what {
    align-self: center;
    text-align: center;
    /* .jamcol is the box plus its 14px left nudge, so the box's centre sits
       7px right of the column's */
    position: relative;
    left: calc(7px * var(--scale));
    transform: rotate(1.3deg);
  }
  /* on wide, the title row is a touch wider than the column, so widen the
     headline to match and keep its left edge near the border's. */
  @media (min-width: 800px) {
    .month-head { max-width: calc(var(--col) + 2 * var(--col-pad)); }
  }

  /* ===== title row ===== the bordered box, centred in the column. */
  .titlerow {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-top: calc(-18px * var(--scale));
  }

  /* ===== jam title block =====
     Three stacked layers in a wide box:
       • .jamtitle-bg:     the jam's doodle pattern filling the border's inner
         area (pre-rendered at the box's aspect, see below).
       • .jamtitle-card:   this month's title art, contain-fit and centred.
       • .jamtitle-border: the gray hand-drawn border, 9-sliced with
         border-image so the stroke thickness is NEVER squished or stretched
         non-uniformly (pixel art rule). Slice bands are in source px of
         title_border.png (1483x431); border widths are in cqw so the whole
         drawing scales proportionally with the box, like an image would. */
  /* explicit width (box + its left nudge): otherwise the column sizes to the
     caption's text, and .jamtitle's min(100%, ...) collapses onto that. */
  .jamcol {
    display: flex;
    flex-direction: column;
    width: min(100%, calc(559px * var(--scale)));
  }
  /* the new-tab icon hangs off the box's right edge, so nudge the column left
     by about half of what sticks out and the box + icon read as one centred
     object (wide only: on narrow screens the box is full width). */
  @media (min-width: 800px) {
    .jamcol { margin-left: calc(-60px * var(--scale)); }
  }
  /* same face as the .month-head line above the box, smaller and set flush with
     the box's right edge. */
  .jamtitle-cap {
    margin-top: calc(-8px * var(--scale));
    margin-bottom: calc(26px * var(--scale));   /* air before the countdown */
    font-size: calc(30px * var(--scale));
    color: #504b49;
    line-height: 1.05;
    /* flush with the box's right edge (.jamcol is the box + its left nudge, so
       the column's right edge IS the box's right edge). */
    text-align: right;
    /* the drawn border isn't square on the page, so tilt to match it and read as
       part of the same hand-drawn object. */
    transform: rotate(1.3deg);
    transform-origin: right center;
  }
  .jamtitle {
    display: block;
    position: relative;
    isolation: isolate;            /* own stacking context, so the icon's z-index
                                      stays behind the box but above the page */
    container-type: inline-size;   /* gives the children cqw units */
    width: min(100%, calc(545px * var(--scale)));
    /* nudged off the column's left edge; the caption below stays put, so the
       box sits a touch right of the headline above it. */
    margin-left: calc(14px * var(--scale));
    /* sized for cozy fall's wide (3.2:1) lockup: a shallow box that scales
       with its width, so narrow screens don't leave air above and below it.
       the fill images are cut at this aspect, so change them together. */
    aspect-ratio: 545 / 225;
  }
  .jamtitle-border {
    position: absolute; inset: 0;
    z-index: 3;              /* border draws OVER the card layer */
    pointer-events: none;
    border-style: solid;
    border-color: transparent;
    border-width: 7.4cqw 2.9cqw 6.2cqw 3.4cqw;   /* = slice px * (43/95)ish, per side */
    border-image: url('/assets/title_border.png') 95 38 81 45 stretch;
    image-rendering: pixelated;
  }
  /* the box has a fixed aspect, so the fill is one pre-rendered image at that
     aspect, cut to the border's inner area with a mask rendered from the real
     9-sliced border, so it stops exactly at the stroke's inner pixels. cozy
     fall's (cozy_pattern.png) is augie's crop of its itch doodle pattern mixed
     50/50 with the page background; rebuild: claude-workspace/make-cozy-fill.sh
     (needs the dev server up). the jame gam game jam's (jggj_title_fill.png)
     is augie's title art scaled to 1115px wide and cut with that same mask. */
  .jamtitle-bg {
    position: absolute; inset: 0;
    z-index: 1;
    /* image comes from JAM.titleFill (inline style) */
    background-position: center;
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .jamtitle-card {
    position: absolute;
    left: 9%;
    top: 16%;               /* the border's stroke bands are ~18% (top) and
                               ~15% (bottom) of the box height; this tucks the
                               art just inside them so it fills the box without
                               crowding the stroke */
    width: 82%;
    height: 68%;
    z-index: 2;
    object-fit: contain;
    object-position: 50% 50%;
    /* colour-quantized and downsampled to 260px so it upscales into chunky
       blocks like the prize art, just a gentler grid (source ~= display size). */
    image-rendering: pixelated;
  }

  /* "open in new tab" icon: sits under the box (z-index 0, below the fill),
     poking out past the right edge, vertically centred. pixel art, so integer-
     ish scale via --scale and pixelated upscaling. */
  .jamtitle-newtab {
    position: absolute;
    z-index: 0;
    right: calc(-104px * var(--scale));
    top: 53%;
    width: calc(134px * var(--scale));   /* 2x the 67px source */
    transform: translateY(-50%) rotate(-2deg);
  }
  .jamtitle-newtab img {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }
  /* the hand-drawn border darkens with the icon (filter applies to the
     element's border-image too), same amount, instant. kept subtle. */
  .jamtitle:hover .jamtitle-newtab img,
  .jamtitle:hover .jamtitle-border { filter: brightness(.93); }
  /* narrow: the box is already full width, so there is no room for the icon
     to hang off it without spilling past the viewport. */
  @media (max-width: 799px) {
    .jamtitle-newtab { display: none; }
  }

  /* ===== countdown / duration / disclaimer (centred flow) ===== */
  .month-count {
    margin-top: calc(11px * var(--scale));
    font-size: var(--t-count);
    color: #504b49;
    line-height: 1;
  }
  .month-dur {
    margin-top: calc(2px * var(--scale));
    font-size: var(--t-dur);
    color: #4f4a48;
    line-height: 1.2;
    max-width: calc(520px * var(--scale));   /* allow wrap on mobile; clamp() may tighten it at runtime */
  }
  /* post-jam "join us next month" line (shown only in the ended state) */
  .month-next {
    margin-top: calc(2px * var(--scale));
    font-size: var(--t-dur);
    color: #4f4a48;
    line-height: 1.2;
    max-width: calc(520px * var(--scale));
  }
  .month-disclaimer {
    margin-top: calc(2px * var(--scale));
    font-size: var(--t-small);
    color: #d9d4d8;
    line-height: 1.2;
  }

</style>
