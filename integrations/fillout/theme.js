// Jame Gam submission form - lightweight site FX (paste into Fillout's custom JS slot).
// Adds two ambient effects from jamegam.hackclub.com and nothing else:
//   1. the rainbow glow rising from the bottom of the form
//   2. the drifting pixel "dust" particles behind the content
//
// Why JS, not the CSS slot: a <canvas> can't be added from CSS, and Fillout's CSS
// slot strips url()s anyway. Both effects mount inside #question-container (the
// full-height content column) so they sit at the true bottom of the page and
// scroll with the content - NOT pinned to the viewport. Both are pointer-events:
// none and z-index < 0, purely decorative. Coexists with signin.js (both can live
// in the same JS slot, concatenated).
(function () {
  if (window.__jgFx) return; window.__jgFx = true;

  var STYLE = [
    '#jg-rainbow,#jg-dust{position:absolute;left:50%;transform:translateX(-50%);width:100vw;pointer-events:none}',
    // dust: full content height, behind the rainbow, crisp pixels
    '#jg-dust{top:0;bottom:0;height:100%;z-index:-2;image-rendering:pixelated}',
    // rainbow: soft blurred blobs of the logo-flash palette, masked to fade upward,
    // anchored to the bottom of the content column
    '#jg-rainbow{bottom:0;height:52vh;z-index:-1;filter:blur(46px);background-repeat:no-repeat;' +
      'background:' +
        'radial-gradient(40% 130% at 0% 120%,#db9591 0%,#db959100 72%),' +
        'radial-gradient(40% 130% at 14.3% 120%,#dbaf91 0%,#dbaf9100 72%),' +
        'radial-gradient(40% 130% at 28.6% 120%,#dbd991 0%,#dbd99100 72%),' +
        'radial-gradient(40% 130% at 42.9% 120%,#97db91 0%,#97db9100 72%),' +
        'radial-gradient(40% 130% at 57.1% 120%,#91a4db 0%,#91a4db00 72%),' +
        'radial-gradient(40% 130% at 71.4% 120%,#b991db 0%,#b991db00 72%),' +
        'radial-gradient(22% 130% at 85.7% 120%,#db91d4 0%,#db91d4 18%,#db91d400 74%),' +
        'radial-gradient(40% 130% at 100% 120%,#db9591 0%,#db959100 72%);' +
      '-webkit-mask-image:linear-gradient(to top,#000 0%,#0000 100%);mask-image:linear-gradient(to top,#000 0%,#0000 100%)}',
    // the rainbow/dust bleed to 100vw past the centred column; clip so no h-scroll
    'body,#scrollable-widgets-wrapper{overflow-x:clip!important}',
    // every image pixelated, like the site (incl. Fillout's own icons/uploads)
    'img{image-rendering:crisp-edges;image-rendering:pixelated!important}',
    // the content column has an inline solid background that would hide the
    // effects behind it; make it transparent so the rainbow + dust show through.
    // extra bottom padding gives the rainbow room below the last field/button.
    '#question-container{background:transparent!important;padding-bottom:72px!important}',
    // edge doodles: faint ink hand-drawings down the gutters, behind everything,
    // pixelated like the site. Each positioned via inline --top/--edge below.
    '.jg-doodle{position:absolute;top:var(--top);width:var(--w);pointer-events:none;z-index:-3;opacity:.09;image-rendering:pixelated;transition:opacity .2s ease}',
    '.jg-doodle.l{left:var(--edge)}.jg-doodle.r{right:var(--edge)}',
    '.jg-doodle img{display:block;width:100%;height:auto;image-rendering:pixelated}',
    // fade right down once a doodle underlaps the centred column (set at runtime
    // by measureCrowded), and on mobile where the column fills the width.
    '.jg-doodle.crowded{opacity:.03}',
    '@media(max-width:639px){.jg-doodle,.jg-doodle.crowded{opacity:.02}}'
  ].join('');

  // a few of the site's edge doodles (shorter page -> just three), spread down
  // the left/right gutters. src hotlinks jamegam.hackclub.com (an <img> element,
  // so it loads fine - no CSS url() for Fillout to strip).
  var DOODLES = [
    { img: 'doodle_cat', side: 'l', top: '17%', edge: '-20px',  w: '324px' },
    { img: 'doodle_hackclub', side: 'r', top: '44%', edge: '8px',   w: '270px' },
    { img: 'doodle_duck', side: 'l', top: '72%', edge: '24px',  w: '150px' }
  ];

  // fade a doodle once it creeps within PAD px of the centred column (or overlaps
  // it) - mirrors the site's per-element crowding test. CSS can't express this.
  function measureCrowded() {
    var col = document.getElementById('question-container');
    if (!col) return;
    var c = col.getBoundingClientRect(), PAD = 120;
    var ds = document.querySelectorAll('.jg-doodle');
    for (var i = 0; i < ds.length; i++) {
      var r = ds[i].getBoundingClientRect();
      ds[i].classList.toggle('crowded', r.right > c.left - PAD && r.left < c.right + PAD);
    }
  }

  function injectStyle() {
    if (!document.head || document.getElementById('jg-fx-style')) return;
    var s = document.createElement('style'); s.id = 'jg-fx-style'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function mount() {
    var qc = document.getElementById('question-container');
    if (!qc) return false;
    // Anchor to #question-container's PARENT (the `pb-6 sm:pb-20 w-full flex
    // justify-center` wrapper). Its padding box includes the page's bottom
    // padding, so bottom:0 lands at the TRUE bottom of the form - anchoring to
    // the card itself stops short, above that padding.
    var host = qc.parentElement || qc;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (!document.getElementById('jg-dust')) {
      var c = document.createElement('canvas');
      c.id = 'jg-dust'; c.setAttribute('aria-hidden', 'true');
      host.insertBefore(c, host.firstChild);
      startDust(c);
    }
    if (!document.getElementById('jg-rainbow')) {
      var d = document.createElement('div');
      d.id = 'jg-rainbow'; d.setAttribute('aria-hidden', 'true');
      host.insertBefore(d, host.firstChild);
    }
    if (!document.getElementById('jg-doodles')) {
      var box = document.createElement('div');
      box.id = 'jg-doodles'; box.setAttribute('aria-hidden', 'true');
      box.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:-3;overflow:hidden';
      for (var i = 0; i < DOODLES.length; i++) {
        var o = DOODLES[i];
        var s = document.createElement('span');
        s.className = 'jg-doodle ' + o.side;
        s.style.cssText = '--top:' + o.top + ';--edge:' + o.edge + ';--w:' + o.w;
        var im = document.createElement('img');
        im.src = 'https://jamegam.hackclub.com/assets/' + o.img + '.png'; im.alt = '';
        s.appendChild(im); box.appendChild(s);
      }
      host.insertBefore(box, host.firstChild);
    }
    return true;
  }

  // ---- pixel dust (vanilla port of the site's Dust.svelte) ------------------
  function startDust(canvas) {
    var DUST_PX = 4;
    var COLORS = ['#eceae8', '#e6e4e1', '#dedbd8', '#d6d3cf', '#cdc9c5', '#c6c2be'];
    var ctx = canvas.getContext('2d');
    var dust = [], dw = 0, dh = 0, rafId = 0, last = performance.now();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function spawn(p) {
      p.x = Math.random() * dw; p.y = Math.random() * dh;
      p.ang = Math.random() * Math.PI * 2;
      p.speed = 0.5 + Math.random() * 1.0;
      p.turn = 0.25 + Math.random() * 0.4;
      p.size = Math.random() < 0.8 ? 1 : 2;
      p.color = COLORS[(Math.random() * Math.random() * COLORS.length) | 0];
      p.alpha = 0.18 + Math.random() * 0.22;
      p.maxLife = 12 + Math.random() * 18; p.life = 0;
      return p;
    }
    function init() {
      var w = canvas.offsetWidth, h = canvas.offsetHeight;
      var ndw = Math.ceil(w / DUST_PX), ndh = Math.ceil(h / DUST_PX);
      if (ndw < 1 || ndh < 1) return;
      if (ndw === dw && ndh === dh && dust.length) return;
      dw = ndw; dh = ndh; canvas.width = dw; canvas.height = dh;
      var count = Math.round((w * h) / (120 * 120));
      if (dust.length > count) dust.length = count;
      else while (dust.length < count) { var p = spawn({}); p.life = Math.random() * p.maxLife; dust.push(p); }
      draw(0);
    }
    function draw(dt) {
      ctx.clearRect(0, 0, dw, dh);
      for (var i = 0; i < dust.length; i++) {
        var p = dust[i];
        p.life += dt; if (p.life >= p.maxLife) spawn(p);
        p.ang += (Math.random() - 0.5) * p.turn * dt * 2;
        p.x += Math.cos(p.ang) * p.speed * dt; p.y += Math.sin(p.ang) * p.speed * dt;
        if (p.x < -2) p.x = dw + 1; else if (p.x > dw + 2) p.x = -1;
        if (p.y < -2) p.y = dh + 1; else if (p.y > dh + 2) p.y = -1;
        var t = p.life / p.maxLife, env = Math.min(1, Math.min(t, 1 - t) / 0.2);
        ctx.globalAlpha = p.alpha * env; ctx.fillStyle = p.color;
        ctx.fillRect(p.x | 0, p.y | 0, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }
    function frame(now) {
      var dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
      draw(dt); rafId = requestAnimationFrame(frame);
    }
    init();
    try { new ResizeObserver(init).observe(canvas); } catch (e) {}
    if (!reduce) rafId = requestAnimationFrame(function (t) { last = t; frame(t); });
  }

  // re-measure crowding on resize / reflow (debounced to a frame)
  var rafM = 0;
  function scheduleMeasure() { if (!rafM) rafM = requestAnimationFrame(function () { rafM = 0; measureCrowded(); }); }
  window.addEventListener('resize', scheduleMeasure);
  try { new ResizeObserver(scheduleMeasure).observe(document.body); } catch (e) {}

  // mount now + retry for ~12s to catch the SPA's late render
  injectStyle();
  var n = 0, iv = setInterval(function () { injectStyle(); mount(); measureCrowded(); if (++n > 48) clearInterval(iv); }, 250);
})();
