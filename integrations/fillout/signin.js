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
//   zip_postal_code, country, phone_number, hca_token
// Display/control-only (read by this script; NO hidden field needed):
//   slack_avatar, addresses (JSON list for the address picker), addr (selected id)
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
  // Where the "edit on Hack Club Auth" link points (their HCA identity page).
  var HCA_SETTINGS = 'https://auth.hackclub.com/identity/edit';
  var SENTINEL = '[[hc-signin]]';

  // Inline icons (no emojis in UI). currentColor = inherit the line's text color.
  var IC = {
    check: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 8.5l3.5 3.5L13 4"/></svg>',
    cal: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg>',
    pin: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 6.8A1.8 1.8 0 1 1 8 4.2a1.8 1.8 0 0 1 0 3.6z"/></svg>',
    ext: '<svg class="hc-ic" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3H3v10h10v-3M9.5 2.5H14V7M14 2.5L7.5 9"/></svg>',
    chev: '<svg class="hc-ic" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>',
    phone: '<svg class="hc-ic" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2c0-.55.45-1 1-1h2.1c.43 0 .8.27.94.67l.86 2.4a1 1 0 0 1-.25 1.05L6.4 6.3a8.5 8.5 0 0 0 3.3 3.3l1.18-1.25a1 1 0 0 1 1.05-.25l2.4.86c.4.14.67.5.67.94V13c0 .55-.45 1-1 1C7.6 14 3 9.4 3 3z"/></svg>'
  };
  var CSS =
    '#hc-signin{font-family:inherit;margin:0 0 1.25rem;width:100%}' +
    '#hc-signin .hc-out{text-align:center}' +
    '#hc-signin .hc-btn{display:inline-flex;align-items:center;gap:.5rem;background:#ec3750;color:#fff;border:0;border-radius:8px;padding:.7rem 1.15rem;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}' +
    '#hc-signin .hc-btn:hover{filter:brightness(1.06)}' +
    '#hc-signin .hc-card{display:flex;flex-direction:column;gap:.8rem;max-width:380px!important;margin:0 auto;background:#fff;border:1px solid #e6e6e6;border-radius:14px;padding:.9rem 1rem;box-shadow:0 1px 2px rgba(0,0,0,.05);text-align:left}' +
    '#hc-signin .hc-head{display:flex;align-items:center;gap:.7rem}' +
    '#hc-signin .hc-av{width:48px;height:48px;border-radius:50%;object-fit:cover;background:#f0f0f0;flex:0 0 auto}' +
    '#hc-signin .hc-id{min-width:0;line-height:1.2}' +
    '#hc-signin .hc-name{font-weight:600;font-size:1rem;color:#1a1a1a}' +
    '#hc-signin .hc-sub{color:#777;font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#hc-signin .hc-status{margin-left:auto;align-self:flex-start;display:inline-flex;align-items:center;gap:.3rem;color:#2ea44f;font-size:.76rem;font-weight:600;white-space:nowrap}' +
    '#hc-signin .hc-data{display:flex;flex-direction:column;gap:.3rem}' +
    '#hc-signin .hc-line{display:flex;align-items:flex-start;gap:.45rem;color:#444;font-size:.85rem;line-height:1.35}' +
    '#hc-signin .hc-line.hc-muted{color:#aaa}' +
    '#hc-signin .hc-foot{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding-top:.7rem;border-top:1px solid #efefef}' +
    '#hc-signin .hc-edit{display:inline-flex;align-items:center;gap:.25rem;color:#338eda;font-size:.82rem;font-weight:500;text-decoration:none}' +
    '#hc-signin .hc-edit:hover{text-decoration:underline}' +
    '#hc-signin .hc-signout{background:none;border:0;padding:0;color:#999;font-size:.8rem;cursor:pointer;text-decoration:none;white-space:nowrap}' +
    '#hc-signin .hc-signout:hover{color:#666;text-decoration:underline}' +
    '#hc-signin .hc-ic{flex:0 0 auto}' +
    '#hc-signin .hc-line .hc-ic{margin-top:.13rem;color:#b3b3b3}' +
    '#hc-signin .hc-addr-wrap{display:inline-flex;align-items:center;gap:.25rem;min-width:0}' +
    '#hc-signin .hc-addr-wrap .hc-ic{margin-top:0}' +
    '#hc-signin .hc-addr-sel{appearance:none;-webkit-appearance:none;border:0;background:transparent;font:inherit;color:inherit;line-height:inherit;padding:0;margin:0;max-width:100%;cursor:pointer}' +
    '#hc-signin .hc-addr-sel:hover{color:#1a1a1a}' +
    '#hc-signin .hc-addr-sel:focus{outline:none}' +
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
      var addresses = [];
      try { addresses = JSON.parse(q.get('addresses') || '[]'); } catch (e) { addresses = []; }
      var selId = q.get('addr') || (addresses[0] && addresses[0].id) || '';
      var selAddr = null;
      for (var j = 0; j < addresses.length; j++) {
        if (String(addresses[j].id) === String(selId)) { selAddr = addresses[j]; break; }
      }
      if (!selAddr) selAddr = addresses[0] || null;
      var phone = selAddr && selAddr.phone ? selAddr.phone : '';
      // Sign out = reload the form at its clean URL, dropping the identity params
      // so the hidden fields clear and it flips back to the sign-in button.
      var clean = location.origin + location.pathname;

      // 1 address (the common case) stays plain text; >1 becomes a subtle picker.
      var addrHtml;
      if (addresses.length > 1) {
        var opts = '';
        for (var i = 0; i < addresses.length; i++) {
          var a = addresses[i];
          opts += '<option value="' + esc(a.id) + '"' +
            (String(a.id) === String(selId) ? ' selected' : '') + '>' + esc(addrText(a)) + '</option>';
        }
        addrHtml = '<div class="hc-line hc-addr">' + IC.pin +
          '<span class="hc-addr-wrap"><select class="hc-addr-sel" aria-label="Mailing address">' +
          opts + '</select>' + IC.chev + '</span></div>';
      } else if (addresses.length === 1) {
        addrHtml = '<div class="hc-line">' + IC.pin + '<span>' + esc(addrText(addresses[0])) + '</span></div>';
      } else {
        addrHtml = '<div class="hc-line hc-muted">' + IC.pin + '<span>no address on file</span></div>';
      }

      root.innerHTML =
        '<div class="hc-card">' +
          '<div class="hc-head">' +
            (avatar ? '<img class="hc-av" src="' + esc(avatar) + '" alt="" />' : '') +
            '<div class="hc-id">' +
              '<div class="hc-name">' + esc(who) + '</div>' +
              (sub && sub !== who ? '<div class="hc-sub">' + esc(sub) + '</div>' : '') +
            '</div>' +
            '<span class="hc-status">' + IC.check + '<span>signed in</span></span>' +
          '</div>' +
          '<div class="hc-data">' +
            (birthday ? '<div class="hc-line">' + IC.cal + '<span>' + esc(birthday) + '</span></div>' : '') +
            addrHtml +
            (phone ? '<div class="hc-line">' + IC.phone + '<span>' + esc(phone) + '</span></div>' : '') +
          '</div>' +
          '<div class="hc-foot">' +
            '<a class="hc-edit" href="' + HCA_SETTINGS + '" target="_blank" rel="noopener"><span>edit on Hack Club Auth</span>' + IC.ext + '</a>' +
            '<a class="hc-signout" href="' + esc(clean) + '">sign out</a>' +
          '</div>' +
        '</div>';

      var sel = root.querySelector('.hc-addr-sel');
      if (sel) sel.addEventListener('change', function () { pickAddress(this.value, addresses); });
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

  function addrText(a) {
    return [a.line1, a.line2, a.city, a.region, a.postal, a.country].filter(Boolean).join(', ');
  }

  // Switch the active mailing address: reload the form with the chosen address in
  // the URL params so Fillout re-prefills the hidden fields. Cheap because the
  // picker sits at the top, before anything is filled in.
  function pickAddress(id, list) {
    var a = null;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) { a = list[i]; break; }
    }
    if (!a) return;
    var u = new URL(location.href);
    setParam(u, 'address_line_1', a.line1);
    setParam(u, 'address_line_2', a.line2);
    setParam(u, 'city', a.city);
    setParam(u, 'state_province', a.region);
    setParam(u, 'zip_postal_code', a.postal);
    setParam(u, 'country', a.country);
    setParam(u, 'phone_number', a.phone);
    u.searchParams.set('addr', a.id);
    location.href = u.toString();
  }

  function setParam(u, k, v) {
    if (v) u.searchParams.set(k, v);
    else u.searchParams.delete(k);
  }

  function injectCSS() {
    if (document.getElementById('hc-signin-css')) return;
    var s = document.createElement('style');
    s.id = 'hc-signin-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
})();
