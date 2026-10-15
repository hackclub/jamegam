// Jame Gam Fillout theme, minimal edition (paste into Fillout's custom JS slot).
// Same ambient effects as theme.js minus the edge doodles:
//   1. the rainbow glow rising from the bottom of the form
//   2. the drifting pixel "dust" particles behind the content
//
// Why JS, not the CSS slot: a <canvas> can't be added from CSS, and Fillout's CSS
// slot strips url()s anyway. Unlike theme.js (which anchors to the wrapper around
// #question-container), both effects mount inside #form-step-widgets-container:
// that column is full-height, so the rainbow sits at the bottom of the SCREEN even
// when the form content is short. The container is h-full (height:100%), which
// wouldn't grow past one viewport on long forms, so mount() flips it to
// height:auto + min-height:100% - short forms still reach the screen bottom, long
// forms grow and the rainbow lands at the true content bottom. Both effects are
// pointer-events: none and z-index < 0, purely decorative. Coexists with signin.js
// (both can live in the same JS slot, concatenated).
(function () {
  if (window.__jgFx) return; window.__jgFx = true;

  var STYLE = [
    '#jg-rainbow,#jg-dust{position:absolute;left:50%;transform:translateX(-50%);width:100vw;pointer-events:none}',
    // dust: full content height, behind the rainbow, crisp pixels
    '#jg-dust{top:0;bottom:0;height:100%;z-index:-2;image-rendering:pixelated}',
    // rainbow: soft blurred blobs of the logo-flash palette, masked to fade upward,
    // anchored to the bottom of the full-height column
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
    // password step: dust only, and a lock above the title (see below)
    'body.jg-pw #jg-rainbow{display:none!important}',
    '#jg-lock{display:block;margin:0 auto .6rem;width:56px;height:56px;color:#a7a5a4}',
    '#jg-lock svg{display:block;width:100%;height:100%}'
  ].join('');

  function injectStyle() {
    if (!document.head || document.getElementById('jg-fx-style')) return;
    var s = document.createElement('style'); s.id = 'jg-fx-style'; s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ---- the password step ---------------------------------------------------
  // Once a jam closes, the form sits behind Fillout's password gate (a "login"
  // step: one centred title + caption + password input, rendered inside the same
  // #question-container). It is a quiet page, so it gets the dust only - no
  // rainbow - plus a lock above the title. The step is a client-side render, so
  // this has to flip both ways as the user moves off it.
  var LOCK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
    '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>';

  function isPasswordStep() {
    return !!document.querySelector('#question-container input[type="password"]');
  }

  // The title is one Quill block whose leading empty <h3><br></h3> lines are
  // deliberate vertical spacing, so anchor to its first line with real text
  // rather than to the top of the block (which would sit ~8 blank lines up).
  function mountLock() {
    if (document.getElementById('jg-lock')) return;
    var qc = document.getElementById('question-container');
    var ed = qc && qc.querySelector('.ql-editor');
    if (!ed) return;
    var anchor = null;
    for (var i = 0; i < ed.children.length; i++) {
      // zero-width space + nbsp count as blank here; Fillout emits both
      if ((ed.children[i].textContent || '').replace(/[\s​ ]/g, '')) { anchor = ed.children[i]; break; }
    }
    var box = document.createElement('span');
    box.id = 'jg-lock'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = LOCK;
    ed.insertBefore(box, anchor); // insertBefore(x, null) === appendChild
  }

  function unmountLock() {
    var l = document.getElementById('jg-lock');
    if (l && l.parentNode) l.parentNode.removeChild(l);
  }

  function mount(pw) {
    var host = document.getElementById('form-step-widgets-container');
    if (!host || !document.getElementById('question-container')) return false;
    // h-full (height:100%) -> min-height:100% so the column still fills the
    // screen on short forms but grows with the content on long ones; bottom:0
    // then always means "bottom of screen or bottom of content, whichever is
    // lower".
    host.style.height = 'auto'; host.style.minHeight = '100%';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (!document.getElementById('jg-dust')) {
      var c = document.createElement('canvas');
      c.id = 'jg-dust'; c.setAttribute('aria-hidden', 'true');
      host.insertBefore(c, host.firstChild);
      startDust(c);
    }
    if (!pw && !document.getElementById('jg-rainbow')) {
      var d = document.createElement('div');
      d.id = 'jg-rainbow'; d.setAttribute('aria-hidden', 'true');
      host.insertBefore(d, host.firstChild);
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

  // mount now + retry for ~12s to catch the SPA's late render. The clock resets
  // while the password gate is up, so the effects still land when the user gets
  // through it minutes later.
  injectStyle();
  var n = 0, iv = setInterval(function () {
    injectStyle();
    var pw = isPasswordStep();
    if (document.body) document.body.classList.toggle('jg-pw', pw);
    if (pw) { n = 0; mountLock(); } else unmountLock();
    mount(pw);
    if (++n > 48) clearInterval(iv);
  }, 250);
})();
