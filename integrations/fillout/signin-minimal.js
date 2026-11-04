// Jame Gam: "Sign in with Hack Club", minimal edition.
// Paste this whole file into Fillout's FORM-LEVEL custom code / JS slot (the one
// in form settings that runs on the published form page - NOT an HTML element,
// which Fillout sandboxes in a script-less iframe).
//
// Same flow as signin.js, but the signed-in card is just identity: slack avatar,
// name, email, "signed in" badge, sign out. No address / phone / birthday lines,
// no address picker, no "edit on Hack Club Auth" link. For lightweight forms
// (prize suggestions etc.) where you only need to know WHO submitted.
//
// Then drop a Heading or Text element reading exactly  [[hc-signin]]  wherever you
// want the button. This script finds that placeholder, hides it, and renders the
// button (or, on return from Hack Club Auth, the card) in its place.
//
// Token mode, like signin.js: after sign-in the form URL carries only
// submit_token (a signed pointer to their Sign Ups row), never their email. The
// card's details come from jamegam.hackclub.com/api/submit/card, and the row's
// identity fields are written after submit by the "resolve identity" Airtable
// automation (integrations/fillout/resolve-automation.js, with `table` set to
// the form's table, which must be listed in TABLES in /api/submit/resolve).
//
// FIELDS to add: submit_token, a VISIBLE required field (hidden fields can't be
// required) prefilled from the URL parameter of the same name and mapped to the
// table's submit_token column. That's what forces sign-in; this script hides it.
// Do NOT map email from the form: the resolve automation fills it.
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
  var CARD_API = 'https://jamegam.hackclub.com/api/submit/card';
  var SENTINEL = '[[hc-signin]]';
  // Fields to force-hide by their aria-label (Fillout sets aria-label to the
  // field's label), for fields that couldn't be made hidden in the editor.
  var HIDE_FIELDS = ['submit_token'];

  // Inline icons (no emojis in UI). currentColor = inherit the line's text color.
  var IC = {
    check: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8.5l3.5 3.5L13 4"/></svg>'
  };
  var CSS =
    '#hc-signin{font-family:inherit;margin:0 0 1.25rem;width:100%}' +
    '#hc-signin .hc-out{text-align:center}' +
    '#hc-signin .hc-btn{display:inline-flex;align-items:center;gap:.5rem;background:#ec3750;color:#fff;border:0;border-radius:8px;padding:.7rem 1.15rem;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}' +
    '#hc-signin .hc-btn:hover{filter:brightness(1.06)}' +
    '#hc-signin .hc-card{display:flex;align-items:center;gap:.7rem;max-width:380px!important;margin:0 auto;background:#fff;border:1px solid #e6e6e6;border-radius:14px;padding:.9rem 1rem;box-shadow:0 1px 2px rgba(0,0,0,.05);text-align:left}' +
    '#hc-signin .hc-av{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#f0f0f0;flex:0 0 auto}' +
    '#hc-signin .hc-id{min-width:0;line-height:1.2;margin-right:auto}' +
    '#hc-signin .hc-name{font-weight:600;font-size:1rem;color:#1a1a1a}' +
    '#hc-signin .hc-sub{color:#777;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#hc-signin .hc-side{display:flex;flex-direction:column;align-items:flex-end;gap:.35rem;flex:0 0 auto}' +
    '#hc-signin .hc-status{display:inline-flex;align-items:center;gap:.3rem;color:#2ea44f;font-size:.76rem;font-weight:600;white-space:nowrap}' +
    '#hc-signin .hc-signout{background:none;border:0;padding:0;color:#999;font-size:.8rem;cursor:pointer;text-decoration:none;white-space:nowrap}' +
    '#hc-signin .hc-signout:hover{color:#666;text-decoration:underline}' +
    '#hc-signin .hc-ic{flex:0 0 auto}' +
    '#hc-signin .hc-btn .hc-req{opacity:.8;font-weight:500}' +
    '#hc-signin .hc-err{color:#ec3750;font-size:.85rem;margin-top:.4rem}' +
    '#hc-signin .hc-loading{color:#999;font-size:.85rem;text-align:center;padding:.6rem 0}';

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
    hideFields();
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

  // Hide the raw data-capture fields (e.g. the submit_token input) wherever they
  // ended up on this form. Widget IDs differ per form, so match on the input's
  // aria-label OR the rendered label text (the aria-label can be absent on the
  // first render), then hide the enclosing fillout-field wrapper.
  function hideFields() {
    for (var i = 0; i < HIDE_FIELDS.length; i++) {
      var name = HIDE_FIELDS[i];
      var hits = [].slice.call(document.querySelectorAll(
        'input[aria-label="' + name + '"],textarea[aria-label="' + name + '"]'));
      var labels = document.querySelectorAll('.fillout-field-label');
      for (var k = 0; k < labels.length; k++) {
        // strip the required asterisk (" *") off the label text
        var t = (labels[k].textContent || '').replace(/\s*\*\s*$/, '').trim();
        if (t === name) hits.push(labels[k]);
      }
      for (var j = 0; j < hits.length; j++) {
        // nearest widget wrapper - NOT the label itself or #question-container
        var w = hits[j].closest(
          '[class*="fillout-field"]:not(.fillout-field-label):not(.fillout-field-container)');
        if (w && w.style.display !== 'none') {
          w.style.display = 'none';
          log('hid field', name);
        }
      }
    }
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
    var token = q.get('submit_token');
    log('render; submit_token present =', !!token);
    if (!token) { renderSignIn(root, q.get('hca_error') ? 'Sign-in did not go through - give it another try.' : ''); return; }

    root.innerHTML = '<div class="hc-loading">loading your Hack Club info...</div>';
    fetch(CARD_API + '?t=' + encodeURIComponent(token))
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) renderCard(root, res.d);
        else if (res.status === 401) renderSignIn(root, 'Your sign-in expired - sign in again to submit.');
        else renderSignIn(root, 'Could not load your Hack Club info - try signing in again.');
      })
      .catch(function (e) {
        log('card fetch failed:', e && e.message);
        renderSignIn(root, 'Could not load your Hack Club info - try signing in again.');
      });
  }

  function renderSignIn(root, err) {
    var url = BROKER + '?v=2&to=' + encodeURIComponent(location.origin + location.pathname);
    root.innerHTML =
      '<div class="hc-out">' +
        '<a class="hc-btn" href="' + url + '">Sign in with Hack Club <span class="hc-req">(required)</span></a>' +
        (err ? '<div class="hc-err">' + esc(err) + '</div>' : '') +
      '</div>';
  }

  function renderCard(root, d) {
    var name = [d.firstName, d.lastName].filter(Boolean).join(' ');
    var email = d.email || '';
    var avatar = d.slackAvatar || '';
    var who = name || d.slackHandle || email;
    // Sign out = reload the form at its clean URL, dropping the token so the
    // field clears and it flips back to the sign-in button.
    var clean = location.origin + location.pathname;

    root.innerHTML =
      '<div class="hc-card">' +
        (avatar ? '<img class="hc-av" src="' + esc(avatar) + '" alt="" />' : '') +
        '<div class="hc-id">' +
          '<div class="hc-name">' + esc(who) + '</div>' +
          (email && email !== who ? '<div class="hc-sub">' + esc(email) + '</div>' : '') +
        '</div>' +
        '<div class="hc-side">' +
          '<span class="hc-status">' + IC.check + '<span>signed in</span></span>' +
          '<a class="hc-signout" href="' + esc(clean) + '">sign out</a>' +
        '</div>' +
      '</div>';
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
