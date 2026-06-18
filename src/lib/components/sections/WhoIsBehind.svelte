<!-- ===== WHO'S BEHIND THIS =====
     Normal flowing centre column: a centred heading, then two cards. Each card
     is a flex ROW pairing a paragraph with a tilted polaroid photo — card 1 has
     text left / image right, card 2 is reversed (image left / text right). The
     paragraph grows to fill the column so the pair spans its full width without a
     gaping middle gap; the photo is a fixed-width flow item at the row's end.

     Each polaroid is a single pre-composited pixel-art PNG (336×405) tilted ~8°
     (augie right, hack club left).

     Mapping reminder: inside .col, an element at original comp x sits at
     left:(x-264)px — used for the wide-only qmark decorations below.

     Mobile (<640px): each card stacks vertically (image above text), centred. -->
<section class="sec sec-who">
  <div class="col who-inner">
    <h2 class="txt who-title">who&rsquo;s behind this?</h2>

    <div class="cards">
      <!-- card 1: text left, image right -->
      <div class="card">
        <p class="txt card-copy">hi, i'm augie!<br>i'm 19. i live in vermont, and i work for the nonprofit <a href="https://hackclub.com" target="_blank" rel="noopener">hack club</a> getting more teenagers into building projects. i love making games & running game jams, and i'm building this because it's what i wish existed when i was younger. if you join, i'm sure we'll talk :)</p>
        <span class="photo me" aria-hidden="true">
          <img src="/assets/who-augie.png" alt="" />
        </span>
      </div>

      <!-- card 2: image left, text right (reversed) -->
      <div class="card reversed">
        <p class="txt card-copy"><a href="https://hackclub.com" target="_blank" rel="noopener">hack club</a> is the 501(c)(3) nonprofit running jame gam, and an existing community of 50k teenagers internationally who are making technical projects of all kinds. there are events running all the time, and it's organized by teens, for teens!</p>
        <span class="photo hc" aria-hidden="true">
          <img src="/assets/who-hackclub.png" alt="" />
        </span>
      </div>
    </div>

    <!-- ===== wide-only decorations: nine question marks scattered AROUND the
         heading (above / below / to the sides) so they don't sit on the text ===== -->
    <span class="deco qmark" style="left:calc(120px * var(--scale)); top:calc(-46px * var(--scale)); transform:rotate(-10deg);">?</span>
    <span class="deco qmark" style="left:calc(250px * var(--scale)); top:calc(-52px * var(--scale)); transform:rotate(6.2deg);">?</span>
    <span class="deco qmark" style="left:calc(430px * var(--scale)); top:calc(-48px * var(--scale)); transform:rotate(33.22deg);">?</span>
    <span class="deco qmark" style="left:calc(560px * var(--scale)); top:calc(-40px * var(--scale)); transform:rotate(-27.64deg);">?</span>
    <span class="deco qmark" style="left:calc(84px * var(--scale));  top:calc(-4px * var(--scale));  transform:rotate(-27.8deg);">?</span>
    <span class="deco qmark" style="left:calc(612px * var(--scale)); top:calc(-10px * var(--scale)); transform:rotate(17.27deg);">?</span>
    <span class="deco qmark" style="left:calc(210px * var(--scale)); top:calc(40px * var(--scale));  transform:rotate(33.22deg);">?</span>
    <span class="deco qmark" style="left:calc(372px * var(--scale)); top:calc(46px * var(--scale));  transform:rotate(-171.84deg);">?</span>
    <span class="deco qmark" style="left:calc(520px * var(--scale)); top:calc(38px * var(--scale));  transform:rotate(-27.32deg);">?</span>
  </div>
</section>

<style>
  .sec-who { padding-block: calc(90px * var(--scale)); }
  .who-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .who-title {
    font-weight: normal;     /* single-weight pixel font: drop the <h2> faux-bold so it matches the other section titles */
    font-size: var(--t-title);
    color: #4e4a48;
    line-height: 1.05;
    margin-bottom: calc(64px * var(--scale));
  }

  /* the pair of cards, stacked vertically, centred in the column */
  .cards {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(56px * var(--scale));
    width: 100%;
  }

  /* one card = paragraph + polaroid image stack, side by side */
  .card {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: calc(44px * var(--scale));
    width: 100%;
  }
  .card.reversed { flex-direction: row-reverse; }

  .card-copy {
    flex: 1 1 auto;
    max-width: calc(440px * var(--scale));
    font-size: var(--t-card);
    color: #4c4947;
    line-height: 1.14955;
    text-align: left;
  }

  .card-copy a {
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  /* ===== polaroid photo — single pre-composited pixel-art image (336×405) =====
     Fixed width box, height follows the image aspect ratio; tilted slightly. */
  .photo {
    flex: 0 0 auto;
    width: calc(225px * var(--scale));
  }
  .photo img {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }
  .photo.me { transform: rotate(8deg); }
  .photo.hc { transform: translateX(calc(-22px * var(--scale))) rotate(-8deg); }

  /* ===== wide-only question-mark decorations ===== */
  .qmark {
    font-family: 'augiepixel', sans-serif;
    font-size: var(--t-title);
    color: #d8938f;
    opacity: .43;
    line-height: 1;
  }

  /* ===== mobile: stack each card vertically (image above text), centred ===== */
  @media (max-width: 639px) {
    .card,
    .card.reversed {
      flex-direction: column-reverse;  /* image on top, text below */
      gap: calc(24px * var(--scale));
    }
    .card-copy {
      flex: 0 1 auto;
      max-width: calc(365px * var(--scale));
      text-align: center;
    }
    .who-title { margin-bottom: calc(44px * var(--scale)); }
    .cards { gap: calc(48px * var(--scale)); }
  }
</style>
