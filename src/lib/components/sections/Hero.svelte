<script>
  import { jiggle } from '$lib/actions/jiggle.js';
</script>

<!-- ===== HERO =====
     Above-the-fold: this section owns (nearly) the first screen; its content is
     vertically centred and nudged up, so the next section (email) peeks below
     the fold. Centre column = crowd photo, the animated logo (which tracks the
     #logo-slot placeholder), tagline, and CTA. Left-column doodles are wide-only
     decorations.

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px — used for the wide-only decorations below. -->
<section class="sec sec-hero">
  <div class="col hero-inner">
    <img class="crowd" src="/assets/crowd.png" alt="hack clubbers" />

    <!-- transparent placeholder the logo engine glues the animated logo onto -->
    <div id="logo-slot" aria-hidden="true"></div>
    <h1 class="sr-logo">jame gam — by hack club</h1>

    <p class="txt tagline" use:jiggle>we&rsquo;re a community of teenagers who pick a game jam every month to all enter together.</p>

    <!-- CTA with the little scribble rainbow underline under the word "prizes".
         jiggle tags the "prizes" word span with .jw-prizes and the underline is
         a background of that word box (see app.css), so the line tracks the word
         even when the CTA wraps to a second line. (It used to be an absolutely
         positioned element against the wrap, which drifted away on wrap.) -->
    <p class="txt cta" use:jiggle>build a game with us, get prizes</p>

    <!-- ===== left-gutter cluster: label + arrow + two polaroids =====
         These four ride inward together as ONE rigid unit. Instead of each using
         .gut-l (which clamps per-element off its own --dx, so the further-out ones
         pinned first and the cluster "bunched up" as the page narrowed), they all
         read a single shared `--cluster-left` (the .gut-l clamp computed once on
         .sec-hero) and add a fixed per-element x-offset. One clamp ⇒ they all start
         sliding inward at the same width and keep their relative spacing. -->
    <!-- handwritten-style annotation (augiepixel, dusty pink @43%, tilted up ~10.7deg,
         figma node 32:55) + a little hand-drawn arrow (figma node 32:56) pointing down
         at the polaroids just below. -->
    <p class="deco hero-label">previous hack club game jams</p>
    <img class="deco hero-arrow" src="/assets/arrow601.png" alt="" aria-hidden="true" />
    <!-- tilted pixel-art polaroid (figma node 25:15): the crowd photo, rotated
         13.62deg and centred in the frame's window, sits BEHIND the frame so it
         shows through the transparent cutout. The whole polaroid is a link to the
         event; on hover it kicks a little further into its lean and the event name
         pops out alongside the frame's right edge, set at the frame's drawn tilt
         (measured +16.7deg) so it rides parallel — and since the label is a child
         of the rotating container, the hover rotation carries it along in sync. -->
    <a class="deco hero-polaroid" href="https://www.youtube.com/watch?v=Gtjyyu82pw4&list=PLbNbddgD-XxH0TDS6qFynB6-YnWZU5Fhc&index=2"
       target="_blank" rel="noopener" aria-label="watch the Juice event trailer">
      <img class="pol-photo" src="/assets/polaroid_photo.png" alt="" />
      <!-- higher-res crop swapped in on hover (object-fit:cover = maximise height,
           crop width, like the figma crop). Sits above the low-res photo, below
           the frame so the window still mats it. -->
      <img class="pol-photo pol-photo-hi" src="/assets/juice_hd.jpg" alt="" />
      <img class="pol-frame" src="/assets/polaroid_frame.png" alt="hack clubbers at a past game jam" />
      <span class="pol-label">juice</span>
    </a>
    <!-- second tilted polaroid (figma node 29:40, -12.75deg) tucked to the
         bottom-left of the first; its photo is cropped (cover) inside the frame
         window, so the photo box has overflow:hidden. Label rides the LEFT edge at
         the frame's measured -14deg tilt. -->
    <a class="deco hero-polaroid2" href="https://daydream.hackclub.com"
       target="_blank" rel="noopener" aria-label="visit the Daydream event site">
      <span class="pol2-photo">
        <img src="/assets/polaroid2_photo.png" alt="" />
        <!-- higher-res crop swapped in on hover (cover within the same window). -->
        <img class="pol2-photo-hi" src="/assets/daydream_hi.jpg" alt="" />
      </span>
      <img class="pol2-frame" src="/assets/polaroid2_frame.png" alt="hack clubbers at a past game jam" />
      <span class="pol2-label">daydream</span>
    </a>
    <!-- "see more" annotation below the polaroids: same handwritten style as the
         hero-label, tilted DOWN to the right, with a little clipboard image to its
         right (un-rotated). Links to the gamedev site in a new tab; the text gets
         an underline on hover. -->
    <a class="deco hero-seemore" href="https://gamedev.hackclub.com" target="_blank" rel="noopener">
      <span class="seemore-txt"><span class="seemore-word">see more</span><img class="seemore-img" src="/assets/see_more.png" alt="" aria-hidden="true" /></span>
    </a>
  </div>
</section>

<style>
  /* Hero is the top of the first-screen block (#first-screen handles the
     above-the-fold framing — centring the hero + email signup together). */
  .sec-hero {
    padding-block: 0 calc(8px * var(--scale));
    /* paint above the email section (base .sec is z-index 1) so the email
       field's page-coloured backdrop blob can be large without its soft top
       edge ever creeping over the hero CTA just above it. */
    z-index: 2;
    /* shared left anchor for the whole left-gutter cluster (label + arrow + both
       polaroids). This is the .gut-l ride-inward clamp (app.css) computed ONCE:
       on wide screens it rests at the natural anchor (-345 → a little further out
       from centre than before); as the gutter shrinks it pins --deco-edge off the
       viewport edge. Every cluster member reads this same value + a fixed x-offset,
       so they slide inward together and never bunch up. */
    --cluster-left: max(calc(var(--deco-edge) - var(--gut)), calc(-345px * var(--scale)));
  }
  .hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .crowd { width: calc(553px * var(--scale)); max-width: 100%; height: auto; display: block; z-index: 3; }

  /* gap between crowd and logo, and logo and tagline, kept generous like the comp */
  #logo-slot { margin-top: calc(14px * var(--scale)); }

  .tagline {
    margin-top: calc(30px * var(--scale));
    max-width: calc(557px * var(--scale));
    font-size: var(--t-title);
    color: #524d4a;
    line-height: 1.05;
  }
  .cta {
    margin-top: calc(34px * var(--scale));
    font-size: var(--t-title);
    color: #514c49;
    line-height: 1.05;
  }
  /* the rainbow underline under "prizes" is styled globally on .jw-prizes
     (the word span jiggle builds at runtime) — see app.css. */

  /* screen-reader-only logo heading (the visible logo is image glyphs) */
  .sr-logo {
    position: absolute; width: 1px; height: 1px; overflow: hidden;
    clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; margin: -1px;
  }

  /* ===== left-gutter cluster (rides inward together) =====
     Each member reads the shared --cluster-left (see .sec-hero) and adds a fixed
     x-offset, so the cluster keeps its internal layout at every width. Offsets are
     measured from polaroid 2 (the leftmost, offset 0). DON'T use .gut-l here. */
  /* "previous hack club game jams" — wraps to two centred lines in its box, tilted
     up 10.7deg, dusty pink at 43% (figma 32:55). Sits just above polaroid 1 and
     leans left over it, so the arrow below connects the label to the photos. */
  .hero-label {
    left: calc(var(--cluster-left) + calc(55px * var(--scale))); top: calc(312px * var(--scale));
    width: calc(204px * var(--scale)); text-align: center;
    font-family: 'augiepixel', sans-serif; font-size: calc(25px * var(--scale));
    color: #d7928e; opacity: 0.43; line-height: 1.05;
    transform: rotate(10.7deg); transform-origin: center bottom;
  }
  /* the little hand-drawn arrow curving down into the top polaroid (figma 32:56);
     native 19x35, scaled to sit between the label and polaroid 1's top-left. */
  .hero-arrow {
    left: calc(var(--cluster-left) + calc(77px * var(--scale))); top: calc(374px * var(--scale));
    width: calc(24px * var(--scale)); height: calc(44px * var(--scale));
    opacity: 0.43; z-index: 4;
  }
  /* polaroid 1: a 146x170 unit scaled x1.25 (-> 182.5x212.5), frame + tilted
     photo showing through the window. Lower-left of the hero. */
  .hero-polaroid { left: calc(var(--cluster-left) + calc(75px * var(--scale))); top: calc(400px * var(--scale)); width: calc(182.5px * var(--scale)); height: calc(212.5px * var(--scale)); z-index: 3; }
  .hero-polaroid img { position: absolute; display: block; }
  /* photo centred on the frame's transparent window so it reads as INSIDE the
     polaroid (base 96x124 @ 28.2,9.3 in a 146x170 unit, all x1.25). */
  .pol-photo { left: calc(35.25px * var(--scale)); top: calc(11.63px * var(--scale)); width: calc(120px * var(--scale)); height: calc(155px * var(--scale)); transform: rotate(13.62deg); }
  .pol-frame { left: 0; top: 0; width: calc(182.5px * var(--scale)); height: calc(212.5px * var(--scale)); }

  /* polaroid 2 (figma 29:40): a 144x177 unit scaled x1.1 (-> 158.4x194.7),
     tucked further down + left of polaroid 1 (behind it, z-index 2). It's the
     cluster's leftmost member, so its x-offset is 0 (sits right at --cluster-left). */
  .hero-polaroid2 { left: var(--cluster-left); top: calc(535px * var(--scale)); width: calc(158.4px * var(--scale)); height: calc(194.7px * var(--scale)); z-index: 2; }
  .hero-polaroid2 > * { position: absolute; display: block; }
  /* cropped photo box (cover): rotated -12.75 and centred on the window; the img
     is oversized + shifted left to crop, so the box clips it. */
  .pol2-photo {
    left: calc(18.24px * var(--scale)); top: calc(18.19px * var(--scale));
    width: calc(110.93px * var(--scale)); height: calc(127.3px * var(--scale));
    overflow: hidden; transform: rotate(-12.75deg);
  }
  .pol2-photo img { position: absolute; left: -26.5%; top: 0; width: 153.01%; height: 100%; display: block; }
  .pol2-frame { left: 0; top: 0; width: calc(158.4px * var(--scale)); height: calc(194.7px * var(--scale)); }

  /* ----- both polaroids are event links: reset the anchor, and on hover tip +
     pop the polaroid (instant — no transition — pivoting/scaling about its centre):
     TOP one tips LEFT, BOTTOM one tips RIGHT, both scale up a touch. The event name
     + a higher-res photo appear too. -- */
  .hero-polaroid, .hero-polaroid2 { text-decoration: none; cursor: pointer; }
  .hero-polaroid:hover  { transform: rotate(12deg)  scale(1.07); z-index: 5; }  /* juice tips right */
  /* daydream tips left but keeps its base z-index (2) so it stays BEHIND the juice
     polaroid (z 3) where they overlap, even while hovered. */
  .hero-polaroid2:hover { transform: rotate(-12deg) scale(1.07); }  /* daydream tips left */

  /* higher-res photo: stacked on the low-res one, object-fit:cover so it fills the
     same window maximising height (crops the wider sides). Cross-fades in over 0.1s
     on hover, and gets a saturation/contrast pop so its colours read richer than the
     muted low-res backing. pointer-events:none so it never blocks the link. */
  .pol-photo-hi, .pol2-photo img.pol2-photo-hi {
    opacity: 0; pointer-events: none;
    transition: opacity 0.1s ease;
    filter: saturate(1.55) contrast(1.08) brightness(1.03);
  }
  /* juice_hd.jpg is pre-cropped in figma (node 61:8) to the exact same window as the
     low-res photo, so it just needs to fill the frame — no positioning fudge, and no
     sideways slide during the cross-fade. */
  .pol-photo-hi { object-fit: cover; object-position: 50% 50%; }
  .pol2-photo img.pol2-photo-hi {
    left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 50%;
  }
  .hero-polaroid:hover  .pol-photo-hi,
  .hero-polaroid2:hover .pol2-photo-hi { opacity: 1; }

  /* event-name labels: hidden (and un-hittable) until hover, then they appear ALONG
     the polaroid's near-vertical side edge — rotated close to sideways, picking the
     edge-parallel direction that leans more horizontal (so it reads up/down the edge
     without going past vertical). They're children of the polaroid, so the hover
     tip above is added on top — label + frame stay locked at the same angle. */
  .pol-label, .pol2-label {
    position: absolute; top: 50%;
    font-family: 'augiepixel', sans-serif; font-size: calc(31px * var(--scale));
    white-space: nowrap; line-height: 1;
    opacity: 0; visibility: hidden;
  }
  /* "juice" runs up polaroid 1's RIGHT edge (accent green), last letter at the top. */
  .pol-label {
    left: 100%; margin-left: calc(2px * var(--scale)); text-align: left;
    color: #97db91;
    transform-origin: left center; transform: translateY(-50%) rotate(-73.3deg);
  }
  /* "daydream" runs down polaroid 2's LEFT edge (accent purple), the "d" landing at
     the top of the frame. Nudged down off-centre so the long word's top end sits at
     the frame top rather than floating above it. */
  .pol2-label {
    top: 83%; right: 100%; margin-right: calc(2px * var(--scale)); text-align: right;
    color: #b991db;
    /* the trailing translateY is applied in the text's OWN (rotated) frame — it
       slides the label "up" relative to its rotation, i.e. perpendicular toward the
       polaroid, closing the gap without disturbing the along-edge (d-at-top) position. */
    transform-origin: right center; transform: translateY(-50%) rotate(76deg) translateY(calc(-14px * var(--scale)));
  }
  .hero-polaroid:hover  .pol-label  { opacity: 0.65; visibility: visible; }
  .hero-polaroid2:hover .pol2-label { opacity: 0.43; visibility: visible; }

  /* "see more" annotation, tucked below the polaroid cluster. Matches the
     hero-label's handwritten look (augiepixel, 25px, dusty pink @43%) but tilts the
     text DOWN to the right; the clipboard image rides to its right, un-rotated. */
  .hero-seemore {
    left: calc(var(--cluster-left) + calc(8px * var(--scale))); top: calc(745px * var(--scale));
    text-decoration: none; z-index: 4;
  }
  .seemore-txt {
    font-family: 'augiepixel', sans-serif; font-size: calc(25px * var(--scale));
    color: #d7928e; opacity: 0.43; line-height: 1.05; white-space: nowrap;
    transform: rotate(8deg); transform-origin: left center;
  }
  .hero-seemore:hover .seemore-word { text-decoration: underline; }
  /* the icon flows inline right after the text (where the next letters would sit),
     riding the same tilted baseline — but counter-rotated so it reads upright.
     Sized to ~one letter tall (1x native, crisp); inherits the 43% group opacity. */
  .seemore-img {
    display: inline-block; vertical-align: middle;
    margin-left: calc(4px * var(--scale));
    width: calc(18px * var(--scale)); height: calc(17px * var(--scale));
    transform: rotate(-8deg);
  }

  /* hide the left cluster once it has slid in far enough to reach the centred
     content (the crowd photo / tagline). Tunable: raise to drop them sooner. */
  @media (max-width: 879px) {
    .hero-label, .hero-arrow, .hero-polaroid, .hero-polaroid2, .hero-seemore { display: none !important; }
  }
</style>
