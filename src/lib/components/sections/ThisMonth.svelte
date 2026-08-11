<script>
  import { onMount } from 'svelte';
  import { JAM } from '$lib/jam.js';

  let countdownEl;
  let monthEl;
  let durEl;
  let nextEl;

  onMount(() => {
    // dates come from $lib/jam.js (shared with the Event JSON-LD). times are UTC.
    // the three branches below switch automatically off those dates, so next
    // month just update JAM and this cycles through before/during/after again.
    const START = Date.parse(JAM.startDate);
    const END   = Date.parse(JAM.endDate);
    const z2 = (n) => String(n).padStart(2, '0');
    // clamp so longer copy can't slide right under the video
    const clamp = () => { durEl.style.whiteSpace = 'normal'; durEl.style.maxWidth = '400px'; };
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000);
      return `in ${Math.floor(s / 86400)}:${z2(Math.floor((s % 86400) / 3600))}:${z2(Math.floor((s % 3600) / 60))}:${z2(s % 60)}`;
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
        monthEl.textContent = sameMonth ? "this month we crashed" : "last month we crashed";
        durEl.innerHTML = `this jam ran for <span style="color:${JAM.color};">7 days</span>!`;
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
     Centre column flows normally: headline -> title row -> countdown ->
     duration -> disclaimer. The title row holds the bordered jam title box and
     the video as two side-by-side columns on wide screens (>=960px); below
     that they stack (box, then video) in the centred flow. -->
<section id="this-month" class="sec sec-month">
  <div class="col month-inner">
    <h2 bind:this={monthEl} id="jam-month" class="txt month-head">this month we&rsquo;re crashing</h2>

    <div class="titlerow">
      <!-- jam title: two stacked transparent layers (same construction as the
           june comp, figma node 1:45): the gray hand-drawn border as one whole
           image (always connects its corners) with this month's title art
           layered inside. Brackeys' official lockup, contain-fit since it's a
           taller lockup than a wide text card. -->
      <div class="jamcol">
        <a class="jamtitle" href={JAM.itchUrl} target="_blank" rel="noopener" aria-label="{JAM.name} on itch.io">
          <img class="jamtitle-card" src="/assets/brackeys_text.png" alt={JAM.name} />
          <span class="jamtitle-border" aria-hidden="true"></span>
        </a>
        <!-- which jam the box above is, in the headline's voice and style
             (JAM.displayName, so this rolls over with the rest of jam.js). -->
        <p class="txt jamtitle-cap">{JAM.displayName}</p>
      </div>

      <!-- video player: rotated photo + separately-rotated play icon on top
           (figma node 1:53). Right column of the title row on wide screens; in
           the stacked flow below 960px. Points at this month's jam video
           (GMTK's 2026 announcement). The "watch the video" doodle is pinned
           to the player's bottom-right corner (wide only). -->
      <div class="vidcol">
        <a class="video-link" href="https://www.youtube.com/watch?v=d_NA_yTXOOQ" target="_blank" rel="noopener" aria-label="watch the video">
          <span class="el el-vidphoto"><img src="/assets/video_photo_brackeys.png" alt="how to game jam" /></span>
          <span class="el el-vidplay"><img src="/assets/video_play.png" alt="play" /></span>
        </a>
        <span class="deco month-watch"><img src="/assets/dec556.png" alt="watch the video" /></span>
      </div>
    </div>

    <!-- countdown -->
    <p bind:this={countdownEl} id="countdown" class="txt month-count">in 7:18:40:53</p>
    <p bind:this={durEl} id="jam-duration" class="txt month-dur">this jam will run for <span style="color:{JAM.color};">7 days</span>!</p>
    <!-- post-jam only: revealed by tick() once the jam has ended (hidden until then) -->
    <div bind:this={nextEl} id="jam-next" style="display:none;">
      <p class="txt month-next">made a game? <a href={JAM.submitUrl}>submit it here</a>!</p>
      <p class="txt month-next">and join us next month for another jam!</p>
    </div>
    <p class="txt month-disclaimer">(not affiliated with brackeys)</p>
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
  }
  /* on wide, the title row is a touch wider than the column, so widen the
     headline to match and keep its left edge near the border's. */
  @media (min-width: 800px) {
    .month-head { max-width: calc(var(--col) + 2 * var(--col-pad)); }
  }

  /* ===== title row (box + video) =====
     Stacked and centred by default; from 960px up it becomes two side-by-side
     columns (the bordered box, then the video), vertically centred on each
     other and centred as a group. */
  .titlerow {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    margin-top: calc(-18px * var(--scale));
  }
  @media (min-width: 960px) {
    .titlerow {
      flex-direction: row;
      justify-content: center;
      align-items: center;
    }
    /* neither column may squeeze when the row overflows the centre column a
       little; the overflow spreads symmetrically into the gutters instead. */
    .titlerow > * { flex-shrink: 0; }
  }

  /* ===== jam title block =====
     Two stacked layers in a 2:1 box (taller and narrower than the june
     comp's 742x216, sized for a squarer lockup):
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
    container-type: inline-size;   /* gives the children cqw units */
    width: min(100%, calc(545px * var(--scale)));
    /* nudged off the column's left edge; the caption below stays put, so the
       box sits a touch right of the headline above it. */
    margin-left: calc(14px * var(--scale));
    /* explicit height rather than an aspect ratio: narrowing the box should not
       shorten it (the lockup is squarer than the old 2:1 GMTK one). */
    height: calc(290px * var(--scale));
  }
  .jamtitle-border {
    position: absolute; inset: 0;
    z-index: 2;              /* border draws OVER the card layer */
    pointer-events: none;
    border-style: solid;
    border-color: transparent;
    border-width: 7.4cqw 2.9cqw 6.2cqw 3.4cqw;   /* = slice px * (43/95)ish, per side */
    border-image: url('/assets/title_border.png') 95 38 81 45 stretch;
    image-rendering: pixelated;
  }
  .jamtitle-card {
    position: absolute;
    left: 2%;
    top: 13%;               /* the drawn line's inner area at the box's centre
                               runs ~14% to ~85% (it tilts), so 13% + 74% keeps
                               the lockup inside it with a little breathing room */
    width: 96%;
    height: 74%;
    z-index: 1;
    object-fit: contain;
    object-position: 50% 50%;
    /* colour-quantized and downsampled to 260px so it upscales into chunky
       blocks like the prize art, just a gentler grid (source ~= display size). */
    image-rendering: pixelated;
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

  /* ===== video (right column of the title row) =====
     Default (stacked): in-flow centred figure below the box, capped to natural
     size. The wrapper (.vidcol) exists so the "watch the video" doodle can pin
     to the player's corner without inheriting the hover tilt. */
  .vidcol {
    position: relative;
    width: 100%;      /* the player inside sizes itself with width:100% +
                         max-width, so this wrapper must not shrink-to-fit
                         (its only child is out of flow and it would collapse) */
  }
  .video-link {
    position: relative;
    display: block;
    width: 100%;
    max-width: calc(276px * var(--scale));
    margin: calc(32px * var(--scale)) auto 0;
    aspect-ratio: 276 / 155;
    text-decoration: none;
  }
  .video-link .el { position: absolute; }
  .el-vidphoto {
    left: 0; top: 0; width: 100%; height: auto;
    transform: rotate(-3deg); z-index: 2;
  }
  .el-vidphoto img { width: 100%; height: auto; display: block; }
  /* mobile: shrink the player and pull it up so its top tucks against the bottom
     of the title block instead of floating below it. */
  @media (max-width: 800px) {
    .video-link {
      max-width: calc(210px * var(--scale));
      margin-top: calc(-12px * var(--scale));
    }
  }
  /* play icon centred over the photo (≈ comp offset) */
  .el-vidplay {
    left: 50%; top: 50%; width: 16.5%; height: auto;
    transform: translate(-50%, -50%) rotate(-3deg); z-index: 3;
  }
  .el-vidplay img { width: 100%; height: auto; display: block; }
  /* hover: tilt the whole player 8deg further left as one rigid unit (photo +
     play together), instantly (no anim) */
  .video-link:hover { transform: rotate(-8deg); transform-origin: center center; }

  /* two-column mode: the video takes its fixed size beside the box, tucks
     over the box's right border a little, vertically centred on the box, and
     keeps the comp's deeper tilt. */
  @media (min-width: 960px) {
    .vidcol {
      width: calc(276px * var(--scale));
      margin-left: calc(-36px * var(--scale));
      /* the row centres on .jamcol, which is box + caption, so the player rides
         low against the box itself; lift it by about half the caption. */
      margin-top: calc(-40px * var(--scale));
      z-index: 3;            /* above the box's border layer (z-index 2) */
    }
    .video-link { width: 100%; margin: 0; }
    .el-vidphoto { transform: rotate(-6.24deg); }
    .el-vidplay  { transform: translate(-50%, -50%) rotate(-6.24deg); }
  }

  /* "watch the video" doodle, pinned to the player's bottom-right corner (its
     arrow points back at the player). Wide-only: in the stacked layout there's
     no corner for it to hang off, so it hides below the two-column breakpoint. */
  .month-watch {
    position: absolute;
    left: calc(205px * var(--scale));
    top: calc(106px * var(--scale));
    width: calc(126px * var(--scale)); height: calc(100px * var(--scale)); opacity: .43;
  }
  @media (max-width: 959px) {
    .month-watch { display: none !important; }
  }

</style>
