// Jame Gam: "Sign in with Hack Club".
// Paste this whole file into Fillout's FORM-LEVEL custom code / JS slot (the one
// in form settings that runs on the published form page - NOT an HTML element,
// which Fillout sandboxes in a script-less iframe).
//
// Then drop a Heading or Text element reading exactly  [[hc-signin]]  wherever you
// want the button. This script finds that placeholder, hides it, and renders the
// button (or, on return from Hack Club Auth, a "signed in as ..." card) in its place.
//
// HIDDEN FIELDS to add (prefill-from-URL-parameter, names matching exactly), and
// map to the Submission Form columns:
//   email, first_name, last_name, slack_id, slack_handle, verification_status,
//   birthday, address_line_1, address_line_2, city, state_province,
//   zip_postal_code, country, hca_token
// Display-only (read by this script for the card; NO hidden field needed):
//   slack_avatar, address_text
//
// Self-contained: injects its own CSS and reads the form's own URL, so the same
// paste works on every jam form with no edits. Hidden fields still do the actual
// data capture via Fillout's native URL-param prefill.
//
// DEBUG: set DEBUG=true to log to the console while wiring it up.
(function () {
  var DEBUG = true;
  function log() {
    if (!DEBUG || !window.console) return;
    var a = ['[hc-signin]'].concat([].slice.call(arguments));
    console.log.apply(console, a);
  }

  if (window.__hcSignin) { log('already loaded, skipping'); return; }
  window.__hcSignin = true;
  log('script loaded; readyState =', document.readyState);

  var BROKER = 'https://jamegam.hackclub.com/api/auth/login';
  // Where the "edit on Hack Club" link points (their HCA profile/settings). Update
  // if HCA exposes a deeper settings path.
  var HCA_SETTINGS = 'https://auth.hackclub.com/';
  var SENTINEL = '[[hc-signin]]';

  // Inline icons (no emojis in UI). currentColor = inherit the line's text color.
  var IC = {
    check: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8.5l3.5 3.5L13 4"/></svg>',
    cal: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg>',
    pin: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 6.8A1.8 1.8 0 1 1 8 4.2a1.8 1.8 0 0 1 0 3.6z"/></svg>',
    ext: '<svg class="hc-ic hc-ic-ext" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3H3v10h10v-3M9.5 2.5H14V7M14 2.5L7.5 9"/></svg>'
  };
  var CSS =
    '#hc-signin{font-family:inherit;margin:0 0 1.25rem;width:100%}' +
    '#hc-signin .hc-out{text-align:center}' +
    '#hc-signin .hc-btn{display:inline-flex;align-items:center;gap:.5rem;background:#ec3750;color:#fff;border:0;border-radius:8px;padding:.7rem 1.15rem;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}' +
    '#hc-signin .hc-btn:hover{filter:brightness(1.06)}' +
    '#hc-signin .hc-card{display:flex;align-items:flex-start;gap:.75rem;background:#fff;border:1px solid #e3e3e3;border-radius:12px;padding:.7rem .85rem;max-width:360px;margin:0 auto;box-shadow:0 1px 2px rgba(0,0,0,.04);text-align:left}' +
    '#hc-signin .hc-av{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#f0f0f0;flex:0 0 auto}' +
    '#hc-signin .hc-meta{min-width:0;line-height:1.3}' +
    '#hc-signin .hc-name{font-weight:600}' +
    '#hc-signin .hc-sub{color:#666;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#hc-signin .hc-line{color:#555;font-size:.82rem;margin-top:.15rem}' +
    '#hc-signin .hc-line.hc-muted{color:#aaa}' +
    '#hc-signin .hc-edit{display:inline-block;margin-top:.4rem;color:#338eda;font-size:.8rem;text-decoration:underline}' +
    '#hc-signin .hc-edit:hover{filter:brightness(1.06)}' +
    '#hc-signin .hc-ic{display:inline-block !important;margin-right:.35rem;vertical-align:-2px}' +
    '#hc-signin .hc-ic-ext{margin-right:0;margin-left:.2rem;vertical-align:-1px}' +
    '#hc-signin .hc-right{margin-left:auto;flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:.2rem}' +
    '#hc-signin .hc-badge{color:#2ea44f;font-size:.8rem;font-weight:600}' +
    '#hc-signin .hc-signout{background:none;border:0;padding:0;color:#999;font-size:.78rem;font-weight:500;cursor:pointer;text-decoration:underline;white-space:nowrap}' +
    '#hc-signin .hc-signout:hover{color:#666}' +
    '#hc-signin .hc-err{color:#ec3750;font-size:.85rem;margin-top:.4rem}';

  var host = null; // the Fillout element holding the sentinel
  var container = null; // our injected #hc-signin
  var ticks = 0;

  // document.body may not exist yet if the slot runs in <head>; wait for it.
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  function start() {
    log('start(); injecting CSS + beginning to poll for', JSON.stringify(SENTINEL));
    injectCSS();
    var iv = setInterval(tick, 200);
    setTimeout(function () {
      clearInterval(iv);
      if (!container) log('GAVE UP after ~20s - never found the placeholder. See dumpCandidates() above.');
    }, 20000);
    try {
      if (window.MutationObserver) {
        new MutationObserver(tick).observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {
      log('MutationObserver failed:', e && e.message);
    }
    tick();
  }

  function tick() {
    if (container && document.body.contains(container)) {
      if (host) host.style.display = 'none';
      return;
    }
    ticks++;
    var leaf = findSentinel();
    if (!leaf) {
      if (ticks % 10 === 1) { log('tick', ticks, '- placeholder not found yet'); dumpCandidates(); }
      return;
    }
    log('found placeholder element:', leaf, '- mounting');
    host = leaf.closest('[class*="fillout-field"]') || leaf;
    host.style.display = 'none';
    container = document.createElement('div');
    container.id = 'hc-signin';
    host.parentNode.insertBefore(container, host);
    render(container);
    log('mounted into', host);
  }

  function findSentinel() {
    var nodes = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div,label,td,li');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue; // leaf nodes only
      var t = (el.textContent || '').trim();
      if (t === SENTINEL || t.indexOf(SENTINEL) !== -1) return el;
    }
    return null;
  }

  // Logs any leaf text that looks remotely like our sentinel, to catch the case
  // where Fillout mangles "[[hc-signin]]" (e.g. strips brackets or pipes it).
  function dumpCandidates() {
    var nodes = document.querySelectorAll('h1,h2,h3,h4,h5,p,span,div,label,td,li');
    var hits = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;
      var t = (el.textContent || '').trim();
      if (t && /hc.?signin|\[\[|\]\]/i.test(t)) hits.push(JSON.stringify(t));
    }
    log('leaf texts containing bracket/hc-signin:', hits.length ? hits.join(' , ') : '(none - placeholder text may be gone/mangled)');
  }

  function render(root) {
    var q = new URLSearchParams(location.search);
    log('render; hca_token present =', !!q.get('hca_token'));
    if (q.get('hca_token')) {
      var name = [q.get('first_name'), q.get('last_name')].filter(Boolean).join(' ');
      var email = q.get('email') || '';
      var handle = q.get('slack_handle') || '';
      var avatar = q.get('slack_avatar') || '';
      var who = name || handle || email;
      var sub = handle ? ('@' + handle) : email;
      var birthday = q.get('birthday') || '';
      var address = q.get('address_text') || '';
      // Sign out = reload the form at its clean URL, dropping the identity params
      // so the hidden fields clear and it flips back to the sign-in button.
      var clean = location.origin + location.pathname;
      root.innerHTML =
        '<div class="hc-card">' +
          (avatar ? '<img class="hc-av" src="' + esc(avatar) + '" alt="" />' : '') +
          '<div class="hc-meta">' +
            '<div class="hc-name">' + esc(who) + '</div>' +
            (sub && sub !== who ? '<div class="hc-sub">' + esc(sub) + '</div>' : '') +
            (birthday ? '<div class="hc-line">' + IC.cal + esc(birthday) + '</div>' : '') +
            (address
              ? '<div class="hc-line">' + IC.pin + esc(address) + '</div>'
              : '<div class="hc-line hc-muted">' + IC.pin + 'no address on file</div>') +
            '<a class="hc-edit" href="' + HCA_SETTINGS + '" target="_blank" rel="noopener">edit on Hack Club' + IC.ext + '</a>' +
          '</div>' +
          '<div class="hc-right">' +
            '<span class="hc-badge">' + IC.check + 'signed in</span>' +
            '<a class="hc-signout" href="' + esc(clean) + '">sign out</a>' +
          '</div>' +
        '</div>';
    } else {
      var url = BROKER + '?to=' + encodeURIComponent(location.origin + location.pathname);
      root.innerHTML =
        '<div class="hc-out">' +
          '<a class="hc-btn" href="' + url + '">Sign in with Hack Club</a>' +
          (q.get('hca_error')
            ? '<div class="hc-err">Sign-in did not go through - give it another try.</div>'
            : '') +
        '</div>';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function injectCSS() {
    if (document.getElementById('hc-signin-css')) return;
    var s = document.createElement('style');
    s.id = 'hc-signin-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
})();
