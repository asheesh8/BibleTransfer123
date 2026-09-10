/* ============================================================================
   EasyTransfer app — shared core.

   TWO CONSTRAINTS SHAPE EVERY FILE IN THIS FOLDER. Both come from the fact that
   this app is opened straight off a microSD card as often as it is served from
   a Raspberry Pi:

   1. NO ES MODULES. `<script type="module">` is fetched under CORS rules, and
      the file:// origin is opaque, so a module graph fails to load off a card
      with a console error and a blank page. Everything here is a classic
      script hanging one global, `ET`, off window.

   2. NO fetch() OF LOCAL DATA. Same reason. The catalogue arrives as
      data/catalog.js, which assigns window.LIBRARY, loaded by a plain
      <script> tag before these files.

   If you are tempted to modernise either of those: put the card in a phone and
   open it from the file manager first. That is how it is actually used.
   ========================================================================= */

window.ET = (function () {
  'use strict';

  // ------------------------------------------------------------- storage
  // Safari blocks localStorage on file:// entirely, and a phone in private
  // mode throws on write. Neither is a reason for the app to stop working, so
  // every access falls back to an in-memory object for the session.
  var memory = {};
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? (k in memory ? memory[k] : d) : v; }
      catch (e) { return k in memory ? memory[k] : d; }
    },
    set: function (k, v) {
      memory[k] = v;
      try { localStorage.setItem(k, v); } catch (e) { /* memory is enough */ }
    }
  };

  // --------------------------------------------------------------- icons
  var P = {
    film:    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 12h18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
    book:    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z"/>',
    wave:    '<path d="M3 12h2M8 6v12M12 3v18M16 8v8M20 11h1"/>',
    scan:    '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M8 12h8"/>',
    link:    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    chev:    '<path d="M9 5l7 7-7 7"/>',
    back:    '<path d="M15 5l-7 7 7 7"/>',
    save:    '<path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    share:   '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4"/>',
    play:    '<path d="M7 4.5l12 7.5-12 7.5z"/>',
    globe:   '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    check:   '<path d="M4 12.5l5 5L20 6.5"/>',
    x:       '<path d="M6 6l12 12M18 6L6 18"/>',
    phone:   '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18.5h2"/>',
    card:    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M8 4v7l2-1.5L12 11V4"/>',
    laptop:  '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
    wifi:    '<path d="M4.5 9.5a12 12 0 0 1 15 0"/><path d="M7.5 13a8 8 0 0 1 9 0"/><path d="M10.5 16.5a3.5 3.5 0 0 1 3 0"/><circle cx="12" cy="20" r="1"/>',
    folder:  '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    sun:     '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
    moon:    '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    warn:    '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>',
    home:    '<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>'
  };

  function icon(name, cls) {
    var d = P[name] || P.link;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
           'aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  }

  // The lantern is the app's mascot — نور, "light". Drawn rather than
  // generated so it is identical on every card and costs nothing to ship.
  function lantern(size) {
    var s = size || 32;
    return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<path d="M18 6h12a2 2 0 0 1 0 4H18a2 2 0 0 1 0-4z" fill="#B87D06"/>' +
      '<path d="M14 12h20l3 22a5 5 0 0 1-5 5.6H16A5 5 0 0 1 11 34z" fill="#E8A317"/>' +
      '<path d="M17 15h14l2.2 17a3 3 0 0 1-3 3.4H17.8a3 3 0 0 1-3-3.4z" fill="#FDF3DC"/>' +
      '<ellipse cx="24" cy="27" rx="5" ry="6.5" fill="#E8A317"/>' +
      '<circle cx="21.6" cy="25" r="1.4" fill="#4E1F64"/>' +
      '<circle cx="26.4" cy="25" r="1.4" fill="#4E1F64"/>' +
      '<path d="M21.8 29.4a3 3 0 0 0 4.4 0" stroke="#4E1F64" stroke-width="1.5" ' +
      'stroke-linecap="round" fill="none"/>' +
      '<path d="M12 41h24" stroke="#B87D06" stroke-width="3.2" stroke-linecap="round"/>' +
      '</svg>';
  }

  // ------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function human(n) {
    if (!n) return '';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? Math.round(n) : n.toFixed(1)) + ' ' + u[i];
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // --------------------------------------------------------------- theme
  function theme(next) {
    if (next) { store.set('et.theme', next); }
    var t = store.get('et.theme', '');
    if (t) { document.documentElement.setAttribute('data-theme', t); }
    else { document.documentElement.removeAttribute('data-theme'); }
    return t;
  }

  // ------------------------------------------------------------- library
  // A card whose catalog.js failed to load is the one failure the app cannot
  // paper over, so say so in plain words instead of rendering empty shelves.
  function library() {
    if (!window.LIBRARY || !window.LIBRARY.resources) {
      document.body.innerHTML =
        '<div class="wrap" style="padding:3rem 1.1rem;max-width:34rem">' +
        '<h1>This card is missing its catalogue</h1>' +
        '<p>The file <code>app/data/catalog.js</code> is not there, so the app ' +
        'has nothing to list.</p>' +
        '<p class="muted">This usually means the folders were renamed or copied ' +
        'incompletely. Copy the whole card again, keeping every folder name ' +
        'exactly as it was.</p></div>';
      throw new Error('catalog.js missing');
    }
    return window.LIBRARY;
  }

  function byId(id) {
    var R = library().resources;
    for (var i = 0; i < R.length; i++) { if (R[i].id === id) return R[i]; }
    return null;
  }

  // -------------------------------------------------------------- header
  function header(active) {
    var t = theme();
    var el = document.createElement('header');
    el.className = 'top';
    el.innerHTML =
      '<div class="wrap">' +
        '<a class="brand" href="index.html">' + lantern(30) +
          '<span data-i18n="app.name">The Library</span></a>' +
        '<button class="fchip" id="et-lang" aria-label="Language">' +
          icon('globe') + '<span id="et-lang-label"></span></button>' +
        '<button class="fchip" id="et-theme" aria-label="Light or dark">' +
          icon(t === 'dark' ? 'sun' : 'moon') + '</button>' +
      '</div>';
    document.body.insertBefore(el, document.body.firstChild);

    $('#et-theme').addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light' : 'dark';
      theme(now);
      this.innerHTML = icon(now === 'dark' ? 'sun' : 'moon');
    });
    $('#et-lang').addEventListener('click', function () { ET.i18n.picker(); });
    if (active) { /* reserved for nav highlighting */ }
  }

  // -------------------------------------------------------------- sheets
  function sheet(html) {
    var back = document.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>';
    function close() {
      back.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    var first = back.querySelector('button, a, input');
    if (first) first.focus();
    return { el: back.firstChild, close: close };
  }

  function typeIcon(t) {
    return { film: 'film', 'audio-bible': 'book', audio: 'wave',
             scripture: 'book', historic: 'scan', link: 'link' }[t] || 'link';
  }

  // ------------------------------------------------------- install / SW
  // Off a card the page is file://, where service workers do not exist and
  // registering one throws. Only ever attempt it over HTTP(S).
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(function () {
      // A Pi served over plain http from a non-localhost address will refuse.
      // The app works regardless; this is only what makes it installable.
    });
  }

  /* Chrome fires beforeinstallprompt when the page qualifies for installation,
     and the prompt can only be shown from a real user gesture — so it is caught
     here and handed to whatever wants to offer it.

     iOS never fires this. There, Add to Home Screen is a manual step in the
     Share menu, which is why help.html spells it out rather than relying on a
     button that will never appear on half the phones in the room. */
  var deferredInstall = null;
  var installWatchers = [];
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstall = e;
    installWatchers.forEach(function (fn) { try { fn(true); } catch (err) {} });
  });
  window.addEventListener('appinstalled', function () {
    deferredInstall = null;
    installWatchers.forEach(function (fn) { try { fn(false); } catch (err) {} });
  });

  function canInstall() { return !!deferredInstall; }
  function onInstallable(fn) { installWatchers.push(fn); fn(!!deferredInstall); }
  function promptInstall() {
    if (!deferredInstall) return;
    var e = deferredInstall;
    deferredInstall = null;
    e.prompt();
  }

  /* Standalone means it was launched from the home screen rather than a tab. */
  function standalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           navigator.standalone === true;
  }

  registerSW();

  return {
    store: store, icon: icon, lantern: lantern, esc: esc, qs: qs, human: human,
    canInstall: canInstall, onInstallable: onInstallable,
    promptInstall: promptInstall, standalone: standalone,
    $: $, $$: $$, theme: theme, library: library, byId: byId, header: header,
    sheet: sheet, typeIcon: typeIcon
  };
})();
