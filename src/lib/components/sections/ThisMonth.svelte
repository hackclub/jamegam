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
        durEl.innerHTML = "this <span style=\"color:#ac534e;\">very serious</span> jam ran for a week!";
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
     Centre column flows normally: headline -> juniper title block -> video (on
     mid/mobile it sits in flow here, centred) -> countdown -> duration -> disclaimer.
     On WIDE the video is pulled out of flow and anchored to the right of the column
     (comp x843 -> left:(843-264)=579px inside .col), keeping its rotation.

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px. -->
<section class="sec sec-month">
  <div class="col month-inner">
    <h2 bind:this={monthEl} id="jam-month" class="txt month-head">this month we&rsquo;re crashing</h2>

    <!-- juniper title: two stacked transparent layers (figma node 1:45) —
         the gray border as one whole image (always connects its corners) with
         the high-res coloured text card layered on top, so the lettering stays
         crisp at any size. Both reflow as percentages of the box. -->
    <a class="juniper" href="https://itch.io/jam/theveryseriousjuniperdevgamejam" target="_blank" rel="noopener" aria-label="the very serious juniper dev game jam on itch.io">
      <img class="juniper-card" src="/assets/juniper_text.png" alt="the very serious juniper dev game jam" />
      <img class="juniper-border" src="/assets/juniper_border.png" alt="" aria-hidden="true" />
    </a>

    <!-- video player: rotated photo + separately-rotated play icon on top (figma node 1:53).
         In flow + centred on mid/mobile; absolutely anchored right on wide. -->
    <a class="video-link" href="https://www.youtube.com/watch?v=UuSCzaqoZmM" target="_blank" rel="noopener" aria-label="watch the video">
      <span class="el el-vidphoto"><img src="/assets/video_photo.png" alt="game jam :)" /></span>
      <span class="el el-vidplay"><img src="/assets/video_play.png" alt="play" /></span>
    </a>

    <!-- countdown -->
    <p bind:this={countdownEl} id="countdown" class="txt month-count">in 7:18:40:53</p>
    <p bind:this={durEl} id="jam-duration" class="txt month-dur">this <span style="color:#ac534e;">very serious</span> jam will run for a week!</p>
    <!-- post-jam only: revealed by tick() once the jam has ended (hidden until then) -->
    <p bind:this={nextEl} id="jam-next" class="txt month-next" style="display:none;">join us next month for another jam!</p>
    <p class="txt month-disclaimer">(not affiliated with juniper dev)</p>

    <!-- wide-only "watch the video" doodle, pointing at the video -->
    <span class="deco month-watch"><img src="/assets/dec556.png" alt="watch the video" /></span>
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
    max-width: var(--col);   /* match the juniper border box so it lines up */
    text-align: left;
    font-weight: normal;     /* it's an <h2>; keep the single-weight pixel look (no faux-bold) */
    font-size: var(--t-title);
    color: #504b49;
    line-height: 1.05;
  }
  /* on wide, the juniper box reclaims the gutter — widen the headline to match
     so its left edge stays flush with the border. */
  @media (min-width: 800px) {
    .month-head { max-width: calc(var(--col) + 2 * var(--col-pad)); }
  }

  /* ===== juniper title block =====
     Two stacked transparent layers in a box that keeps the 742×216 ratio:
       • .juniper-border — the whole gray hand-drawn border as one image (so it
         always meets its corners), stretched to fill.
       • .juniper-card   — the high-res coloured text, placed at the comp's card
         rect (percentages of the box) so it stays crisp when scaled.
     Both inherit the global pixelated image-rendering (no per-image override). */
  .juniper {
    display: block;
    position: relative;
    width: 100%;
    max-width: var(--col);     /* grow up to the column max-width (the magenta guide), no wider */
    margin-top: calc(-18px * var(--scale));
    aspect-ratio: 742 / 216;
  }
  /* on wider screens, reclaim the column's gutter so the (slightly tilted) box
     reaches the full max-width for a bit more visual weight. Centred via the
     flex parent, so the overflow spreads symmetrically into the gutter. */
  @media (min-width: 800px) {
    .juniper { width: calc(100% + 2 * var(--col-pad)); }
  }
  /* smaller screens: full-bleed the title block like the how-it-works video.
     align-items:center on .month-inner centres the over-wide box on the viewport
     (it overflows the column symmetrically), so no left/translate offset is
     needed. Pushed slightly past 100vw on purpose: the box reads as tilted, so
     letting the angled corner tips run off the edges keeps the lettering itself
     filling the full width. #page clips overflow-x, so no scrollbar. */
  @media (max-width: 800px) {
    .juniper { width: 104vw; max-width: 104vw; }
  }
  .juniper-border {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    z-index: 2;              /* border draws OVER the text layer */
  }
  .juniper-card {
    position: absolute;
    left: 1.759%;            /* 13.05 / 742 */
    top: 14.98%;             /* 32.35 / 216 */
    width: 96.36%;           /* 715 / 742 */
    height: 72.08%;          /* 155.693 / 216 */
    z-index: 1;
    object-fit: cover;
    object-position: 50% 100%;
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

  /* "watch the video" doodle — its position is locked to the video's bottom-right
     (see the side-video media query, where both share --vid-x/--vid-y) so its
     arrow always points back at the player. It reaches further into the gutter
     than the video, so it drops out a bit before the video does (rule below). */
  .month-watch {
    width: calc(126px * var(--scale)); height: calc(100px * var(--scale)); opacity: .43;
  }
  /* the doodle's right edge would clip the viewport before the video's does, so
     hide it once there isn't room for it (video stays in side-mode below this). */
  @media (max-width: 1039px) {
    .month-watch { display: none !important; }
  }

  /* ===== video — DUAL MODE =====
     Default (mobile + mid): in-flow centred figure, capped to natural size. */
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
     of the (now full-bleed) juniper title block instead of floating below it. */
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

  /* Side-video mode: pull the video out of flow, anchor it to the right of the
     column (overlapping the juniper's corner, like the comp). Below this the
     video drops back into the centred flow (default rules above). Threshold is
     where the video's right edge still clears the viewport with margin to spare;
     the "watch" doodle reaches further and is hidden earlier (rule up top).
     Absolute element reserves no space, so the centre column closes the gap. */
  @media (min-width: 960px) {
    /* shared anchor for the video + its "watch the video" doodle so they move
       together and the doodle's arrow always points back at the player. */
    .month-inner { --vid-x: calc(618px * var(--scale)); --vid-y: calc(186px * var(--scale)); }
    .video-link {
      position: absolute;
      left: var(--vid-x);     /* into the right margin, overlapping the juniper's
                                 bottom-right corner; nudged left from the comp */
      top: var(--vid-y);
      width: calc(276px * var(--scale));
      height: calc(155px * var(--scale));   /* absolute children don't size the box;
                                               give it the photo's height so hover's
                                               center-center pivot is the real centre */
      max-width: none;
      margin: 0;
      aspect-ratio: auto;
      z-index: 4;
    }
    /* doodle pinned to the video's lower-right by the exact comp delta */
    .month-watch {
      left: calc(var(--vid-x) + 205px * var(--scale));
      top: calc(var(--vid-y) + 106px * var(--scale));
    }
    .el-vidphoto {
      width: calc(276px * var(--scale)); height: calc(155px * var(--scale));
      transform: rotate(-6.24deg);
    }
    .el-vidphoto img { width: calc(276px * var(--scale)); height: calc(155px * var(--scale)); }
    /* restore comp play-icon placement/size over the rotated photo */
    .el-vidplay {
      left: calc(120.75px * var(--scale));         /* 964.35 - 843.6 */
      top: calc(57.9px * var(--scale));            /* 954.45 - 896.55 */
      width: calc(45.633px * var(--scale)); height: calc(48.893px * var(--scale));
      transform: rotate(-6.24deg);
    }
    .el-vidplay img { width: calc(45.633px * var(--scale)); height: calc(48.893px * var(--scale)); }
  }

</style>
