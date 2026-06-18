<script>
  import SharkPrize from '$lib/components/SharkPrize.svelte';

  let email = $state('');
  let company = $state(''); // honeypot - real humans never see or fill this
  let status = $state('idle'); // idle | loading | done | error
  let message = $state('');

  async function submit(e) {
    e.preventDefault();
    const v = email.trim();
    if (!v || status === 'loading') return;
    status = 'loading';
    message = '';
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, company })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        status = 'error';
        message = data.error || 'hmm, that didn’t work - try again?';
        return;
      }
      status = 'done';
      message = "you’re in! check your email :]";
    } catch {
      status = 'error';
      message = 'network hiccup - try again?';
    }
  }
</script>

<!-- ===== EMAIL SIGNUP =====
     Centre-column unit (always visible, at every width): the input box, the
     "i'm in" button, and the little squiggle line — they live in the middle
     column so they show whenever the column shows. Only the far-right extras
     (the red "click here" squiggle + the pico-8 / fish doodles) are wide-only
     side decorations.

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px — used for the wide-only decorations below. -->
<section class="sec sec-email">
  <div class="col email-inner">
    <div class="email-field">
      {#if status === 'done'}
        <p class="email-done" aria-live="polite">{message}</p>
      {:else}
        <!-- the form: sketch box background + a real, functional email input -->
        <form id="email-form" class="email-box" method="post" action="/api/signup" onsubmit={submit}>
          <input id="email-input" type="email" placeholder="your email..." autocomplete="email" required bind:value={email} disabled={status === 'loading'} />
          <!-- honeypot: off-screen, not announced, not tabbable; only bots fill it -->
          <input class="hp" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={company} />
        </form>
        <!-- "i'm in" button (decoration art; the form submits on Enter) -->
        <button type="submit" form="email-form" class="email-im" aria-label="i'm in" disabled={status === 'loading'}>
          <img src="/assets/imin.png" alt="i&rsquo;m in" />
        </button>
      {/if}
    </div>
    {#if status === 'error'}
      <p class="email-error" aria-live="polite">{message}</p>
    {/if}

    <!-- ===== right-gutter side decorations (ride inward, see app.css .gut-r) =====
         The "click here" scribble + its arrow are ONE locked unit (.ch-arrow
         offset from .ch-text by the exact comp delta) so the arrow always comes
         out of the text and points back at the "i'm in" button to its left. -->
    <span class="deco gut-r email-clickhere">
      <img class="ch-text" src="/assets/email_sq532.png" alt="yeah click on this i know u wanna" />
      <img class="ch-arrow" src="/assets/email_sq533.png" alt="" />
    </span>
    <!-- pico-8 anchor (leftmost, by the field) then the interactive blahaj just
         to its right — both ride inward (.gut-r) so they stay put by the column.
         The shark is an instant poster image that lazily + seamlessly upgrades
         into a drag-to-rotate 3D model in place (see SharkPrize). -->
    <span class="deco gut-r email-pico8"><img src="/assets/prize_pico8.png" alt="PICO-8" /></span>
    <span class="deco gut-r email-dec588"><SharkPrize /></span>

    <!-- a trail of loot pulled from the Prizes section, climbing UP and to the
         right off the shark and fading out fast. Unlike the anchored pair these
         are plain .deco (NOT .gut-r): their `left` is anchored to the centre
         column's right edge (col right = 752), so as the page narrows they slide
         out into the clipped overflow rather than squeezing inward.
         pointer-events:none so they never steal the shark's drag. -->
    <span class="deco prize-trail pt-controller"><img src="/assets/prize_controller.png" alt="game controller" /></span>
    <span class="deco prize-trail pt-floppies"><img src="/assets/prize_floppies.png" alt="floppy disks" /></span>
    <span class="deco prize-trail pt-camera"><img src="/assets/prize_camera.png" alt="disposable camera" /></span>
    <span class="deco prize-trail pt-steam"><img src="/assets/prize_steam.png" alt="Steam gift card" /></span>
    <span class="deco prize-trail pt-duck"><img src="/assets/prize_duck.png" alt="rubber duck" /></span>
    <span class="deco prize-trail pt-thumby"><img src="/assets/prize_thumby.png" alt="Thumby handheld" /></span>
  </div>
</section>

<style>
  .sec-email {
    padding-block: calc(20px * var(--scale));
  }
  .email-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  /* the input field + "i'm in" button, side by side, centred, always visible */
  .email-field {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: calc(10px * var(--scale));
    max-width: 100%;
    /* lock to the input box height so swapping in the "you're in" message
       doesn't change the field height and shift the page */
    min-height: calc(46px * var(--scale));
  }
  /* soft page-coloured backdrop so the box + button never blend into the
     bottom rainbow glow — a blurred #fbfbfb oval sitting behind the field but
     in front of the glow (the section paints above the fixed glow). */
  .email-field::before {
    content: '';
    position: absolute;
    /* a large, soft page-coloured oval centred on the field. .sec-hero paints
       above this section, so any upward spread is safely hidden behind the hero
       CTA — no need to constrain the size. */
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 235%; height: 320%;
    background: radial-gradient(closest-side, #fbfbfb 55%, #fbfbfb00 100%);
    filter: blur(calc(22px * var(--scale)));
    z-index: -1;
    pointer-events: none;
  }
  .email-box {
    flex: 1 1 calc(282px * var(--scale));
    max-width: calc(282px * var(--scale));
    height: calc(46px * var(--scale));
    background: url('/assets/email_box542.png') no-repeat center / 100% 100%;
    z-index: 4;
  }
  #email-input {
    width: 100%; height: 100%; box-sizing: border-box;
    background: transparent; border: 0; outline: 0;
    font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif; font-size: calc(24px * var(--scale)); color: #7a7470;
    padding: 0 calc(18px * var(--scale));
  }
  #email-input::placeholder { color: #d9d4d8; opacity: 1; }
  #email-input:disabled { opacity: 0.6; }

  /* honeypot: pulled off-screen, invisible to humans + screen readers */
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

  /* signup feedback - matches the pixel field type */
  .email-done, .email-error {
    font-size: calc(24px * var(--scale));
    margin: 0;
  }
  .email-done {
    font-family: 'augiepixel', sans-serif;
    font-size: calc(31px * var(--scale));
    color: #7a7470;
  }
  .email-error { font-family: 'CS Marylin Pixel', 'augiepixel', sans-serif; }
  .email-error { color: #c2566e; margin-top: calc(8px * var(--scale)); }

  /* "i'm in" button — bare image button */
  .email-im {
    flex: none;
    width: calc(107.7px * var(--scale)); height: calc(40px * var(--scale));
    padding: 0; border: 0; background: none; cursor: pointer;
    opacity: 0.8; transition: none;
  }
  .email-im:hover { opacity: 0.9; }
  .email-im img { width: 100%; height: 100%; display: block; }

  /* ===== right-gutter decorations (ride inward; .gut-r drives `left` from
     --dx/--dw — see app.css) =====
     The input box + "i'm in" button are centred; these extras trail off to the
     right. The click-here group is anchored so its arrow tucks just right of the
     button and points back at it. */
  .email-clickhere { --dx: calc(662px * var(--scale)); --dw: calc(151px * var(--scale)); top: calc(-2px * var(--scale)); width: calc(151px * var(--scale)); height: calc(60px * var(--scale)); opacity: .43; }
  .email-clickhere img { position: absolute; }
  .email-clickhere .ch-text  { left: 0;     top: 0;   width: calc(151px * var(--scale)); height: calc(60px * var(--scale)); }
  .email-clickhere .ch-arrow { left: calc(-69px * var(--scale)); top: calc(17px * var(--scale)); width: calc(71px * var(--scale));  height: calc(23px * var(--scale)); } /* comp delta from text */
  /* raised clear of the CTA's trailing text above them (no longer clipping it) */
  /* Box is sized to the model's rotation sphere (it can spin to any angle without
     clipping) — bigger than the shark's resting silhouette, with the extra being
     transparent margin. Width/height and position are scaled ~1.305× from the old
     89.2×77.4 @ (718,-90) box and re-centred on the same point, so the shark keeps
     its apparent size and sits exactly where it did. */
  /* pico-8 anchor (leftmost) + the interactive shark to its right — both ride
     inward (.gut-r) so they stay by the field; the rest of the loot trails off. */
  .email-pico8  { --dx: calc(700px * var(--scale)); --dw: calc(74px * var(--scale)); top: calc(-72px * var(--scale)); width: calc(74px * var(--scale)); height: calc(31.5px * var(--scale)); opacity: .5; transform: rotate(-8deg); }
  .email-dec588 { --dx: calc(766px * var(--scale));  --dw: calc(116.4px * var(--scale)); top: calc(-118px * var(--scale)); width: calc(116.4px * var(--scale)); height: calc(101px * var(--scale)); opacity: .5; }

  /* ===== prize trail (plain .deco, anchored to the column right edge) =====
     `left` is measured from the column's left edge (col right edge = 752 = --col).
     The trail climbs UP and to the right off the shark and fades out fast; as the
     page narrows it slides offscreen (overflow-x:clip) instead of riding inward.
     Each box keeps its PNG's native aspect. */
  .prize-trail { z-index: 3; pointer-events: none; }
  .prize-trail img { width: 100%; height: 100%; display: block; }
  .pt-controller { left: calc(888px * var(--scale));   top: calc(-156px * var(--scale)); width: calc(66px * var(--scale)); height: calc(59px * var(--scale));   opacity: .30; transform: rotate(11deg); }
  .pt-floppies   { left: calc(904px * var(--scale));   top: calc(-98px * var(--scale));  width: calc(74px * var(--scale)); height: calc(39px * var(--scale));   opacity: .22; transform: rotate(-12deg); }
  .pt-camera     { left: calc(986px * var(--scale));   top: calc(-206px * var(--scale)); width: calc(68px * var(--scale)); height: calc(42.7px * var(--scale)); opacity: .15; transform: rotate(8deg); }
  .pt-steam      { left: calc(1004px * var(--scale));  top: calc(-130px * var(--scale)); width: calc(60px * var(--scale)); height: calc(60px * var(--scale));   opacity: .10; transform: rotate(-10deg); }
  .pt-duck       { left: calc(1086px * var(--scale));  top: calc(-250px * var(--scale)); width: calc(53px * var(--scale)); height: calc(59.7px * var(--scale)); opacity: .06; transform: rotate(-6deg); }
  .pt-thumby     { left: calc(1100px * var(--scale));  top: calc(-170px * var(--scale)); width: calc(37px * var(--scale)); height: calc(62px * var(--scale));   opacity: .04; transform: rotate(9deg); }

  /* hide once the gutter is essentially gone (column ≈ viewport): below this the
     pinned doodles would pile onto the centred field. (The prize trail flows off
     on its own before this, then drops at the .deco mobile floor.) */
  @media (max-width: 759px) {
    .email-clickhere, .email-dec588, .email-pico8 { display: none !important; }
  }
</style>
