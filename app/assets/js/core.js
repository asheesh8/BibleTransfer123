/* ============================================================================
   EasyTransfer app — shared core: the parts with no look of their own.

   The module registry, storage, small helpers, the shared-library scope,
   theme, the catalogue, content language, file safety and the offline
   install. Everything a page draws lives in modules beside this one:
   ui/shell.js (header, tab bar, icons, sheets, toasts) and ui/covers.js
   (cover art and item rows). docs/architecture/modules.md has the map.

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

  // ----------------------------------------------------------- app shell
  /* The same files also run inside the iPhone and Android apps (mobile/,
     Capacitor). There the page comes from inside the app — capacitor:// on
     iPhone, https://localhost on Android — so neither "is it http(s)?" nor
     location.origin means what it does on the website:

     · native        true inside the app
     · online        true where the website's services can be reached: the
                     website, a Pi, and the app (which calls the live site)
     · publicOrigin  where a link someone else can open points: the live site
                     from the app, this server everywhere else
     · publicHref    this page's address as such a link

     Inside the app pages link to each other as files (kikuyu/index.html), the
     way they do off a card, because the app has no server to rewrite /kikuyu. */
  var PUBLIC_ORIGIN = 'https://www.bibletransfer123.org';
  var native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
                  window.Capacitor.isNativePlatform());
  var online = native || location.protocol === 'http:' || location.protocol === 'https:';
  var publicOrigin = native ? PUBLIC_ORIGIN : location.origin;
  function publicHref(href) {
    var u = new URL(href || location.href, location.href);
    return native ? PUBLIC_ORIGIN + u.pathname + u.search + u.hash : u.href;
  }

  /* The app has no /api of its own, so its calls go to the live site through
     Capacitor's native HTTP (a browser fetch from the app's origin would be a
     cross-site request the site refuses). The site's same-origin check guards
     against other web pages driving a visitor's browser; the app is not a web
     page, so it says which site it belongs to. Everything else — the DBS CDNs,
     PeerJS — stays an ordinary fetch. */
  if (native && window.fetch && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) {
    var pageFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : '';
      if (!/^\/api\//.test(url)) return pageFetch(input, init);
      init = init || {};
      var headers = { Origin: PUBLIC_ORIGIN };
      var given = init.headers || {};
      Object.keys(given).forEach(function (k) { headers[k] = given[k]; });
      var data;
      if (typeof init.body === 'string') {
        try { data = JSON.parse(init.body); } catch (e) { data = init.body; }
      }
      return window.Capacitor.Plugins.CapacitorHttp.request({
        url: PUBLIC_ORIGIN + url, method: init.method || 'GET', headers: headers,
        data: data, responseType: 'json'
      }).then(function (res) {
        var body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
      });
    };
  }

  /* Online features VillageServer can switch off in every app at once, from
     registry/app-config.json, without a new release. features/app.js keeps
     the last answer from /api/app-config; until there is one, all are on. The
     website and cards always have them all. */
  function feature(name) {
    if (!native) return true;
    try {
      var c = JSON.parse(window.localStorage.getItem('et.appconfig') || 'null');
      return !(c && c.data && c.data.features && c.data.features[name] === false);
    } catch (e) { return true; }
  }

  /* Android's WebView has no navigator.share, so the app's share sheet comes
     from Capacitor's Share plugin; a closed sheet rejects with AbortError. */
  var Share = native && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  if (Share && typeof navigator.share !== 'function') try {
    navigator.share = function (d) {
      d = d || {};
      return Share.share({ title: d.title, text: d.text, url: d.url }).then(function () {}, function (err) {
        var e = new Error((err && err.message) || 'Share cancelled');
        e.name = /cancel/i.test(e.message) ? 'AbortError' : 'Error';
        throw e;
      });
    };
  } catch (e) { /* read-only navigator: the share row stays hidden */ }

  // ------------------------------------------------------------- modules
  // Each file registers one module and names the modules it needs. Pages
  // still load plain <script> tags in order (see docs/decisions/0002); the
  // registry turns a missing or misordered tag into a clear error instead
  // of an "undefined is not a function" three screens later.
  var modules = {};
  function module(name, deps, factory) {
    if (modules[name]) throw new Error('ET module "' + name + '" is defined twice');
    var args = deps.map(function (d) {
      if (!modules[d]) {
        throw new Error('ET module "' + name + '" needs "' + d +
          '", which this page has not loaded yet. Check the order of its <script> tags.');
      }
      return modules[d];
    });
    modules[name] = factory.apply(null, args) || {};
    return modules[name];
  }
  function use(name) {
    if (!modules[name]) throw new Error('ET module "' + name + '" is not loaded on this page');
    return modules[name];
  }

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

  /* A shared language library is a deliberately closed view of one language.
     Its landing page supplies ET_SHARED_LIBRARY; item/help/nearby pages carry
     the same scope in their query string so their navigation cannot drift back
     into the complete catalogue. This is a presentation boundary for a clean
     recipient experience, not an authentication system. */
  function libraryScope() {
    var direct = window.ET_SHARED_LIBRARY;
    if (direct && direct.lang) return direct;
    var lang = qs('only');
    if (!/^[a-z]{3}$/.test(lang)) return null;
    return {
      lang: lang,
      ui: qs('ui') || 'en',
      slug: qs('share') || '',
      name: qs('name') || ((window.LIBRARY && window.LIBRARY.languages[lang] || {}).name || lang)
    };
  }

  function scopedUrl(path, params) {
    var p = [], scope = libraryScope(), k;
    params = params || {};
    for (k in params) if (Object.prototype.hasOwnProperty.call(params, k) && params[k] != null) {
      p.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    if (scope) {
      p.push('only=' + encodeURIComponent(scope.lang));
      p.push('ui=' + encodeURIComponent(scope.ui || 'en'));
      if (scope.slug) p.push('share=' + encodeURIComponent(scope.slug));
      if (scope.name) p.push('name=' + encodeURIComponent(scope.name));
    }
    return path + (p.length ? '?' + p.join('&') : '');
  }

  function scopeEntryUrl() {
    var scope = libraryScope();
    if (!scope) return 'library.html';
    if (scope.slug) {
      return location.protocol === 'file:' || native ? scope.slug + '/index.html' : '/' + scope.slug;
    }
    return scopedUrl('library.html');
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
        '<h1>' + ET.i18n.h('ui.catalog.missing') + '</h1>' +
        '<p>' + ET.i18n.h('ui.catalog.file') + '</p>' +
        '<p class="muted">' + ET.i18n.h('ui.catalog.missing.sub') + '</p></div>';
      throw new Error('catalog.js missing');
    }
    return window.LIBRARY;
  }

  function byId(id) {
    var R = library().resources;
    for (var i = 0; i < R.length; i++) { if (R[i].id === id) return R[i]; }
    return null;
  }

  /* An item's title in the reader's own script when it is in their language,
     otherwise the catalogue title. Every screen that names an item uses it. */
  function displayTitle(r) {
    return r.native && inMyLanguage(r) ? r.native : r.title;
  }

  /* The interface language and the language the content is SPOKEN in are
     different things, and conflating them is how an English reader tapped an
     English title and heard Sindhi. Choosing a language picks both: English
     shows English films, اردو shows Urdu, سنڌي shows Sindhi. The library can
     still browse the others on purpose. */
  var CONTENT = { mg: 'mlg', rn: 'run', ak: 'aka', ti: 'tir', ar: 'ara', ht: 'hat', es: 'spa', ny: 'nya', rw: 'kin', xh: 'xho', sn: 'sna', ha: 'hau', ln: 'lin', pcm: 'pcm', yo: 'yor', pt: 'por', am: 'amh', fr: 'fra', en: 'eng', ur: 'urd', snd: 'snd', ps: 'pus', cmn: 'cmn', yue: 'yue', guz: 'guz', swh: 'swh', zul: 'zul', mas: 'mas', kik: 'kik', hi: 'hin', mr: 'mar', lg: 'lug', luo: 'luo', om: 'orm', ig: 'ibo', pa: 'pan', pnb: 'pnb', ne: 'npi' };
  function contentCode(ui) { return CONTENT[ui] || 'eng'; }
  function contentLang() {
    var scope = libraryScope();
    if (scope) return scope.lang;
    var ui = (ET.i18n && ET.i18n.current()) || 'en';
    return contentCode(ui);
  }
  function inMyLanguage(r) { return r.lang === contentLang(); }

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }


  /* ---------------------------------------------------------- safety

     A blob URL runs in the origin that made it. So a file arriving over
     Nearby, opened with "Open it now", would execute as this app if it were
     allowed to be HTML — reading its storage, its saved folder handle, its
     service worker. A phone handed to a stranger for ten seconds is enough.

     So the type is decided here from the file extension, never from what the
     sender claimed, and anything not on this list is handed over as a plain
     download that no browser will execute. */
  var SAFE_TYPES = {
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    pdf: 'application/pdf', txt: 'text/plain', epub: 'application/epub+zip', zip: 'application/zip'
  };
  function safeType(name) {
    var m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ''));
    return (m && SAFE_TYPES[m[1].toLowerCase()]) || 'application/octet-stream';
  }
  /* Can this be opened in a tab without handing the opener our origin? */
  function openable(name) {
    var t = safeType(name);
    return /^(video|audio|image)\//.test(t) || t === 'application/pdf' || t === 'text/plain';
  }

  /* Catalogue links land in href. esc() makes them safe as text but leaves the
     scheme alone, so `javascript:` would still run on tap. Only ordinary web
     links and relative paths get through. */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return '';     // javascript:, data:, file:, …
    return u;                                           // relative path on the card
  }

  // ------------------------------------------------------- install / SW
  // Off a card the page is file://, where service workers do not exist and
  // registering one throws. Only ever attempt it over HTTP(S).
  function registerSW() {
    if (!('serviceWorker' in navigator) || native) return;
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

  // Installing the offline shell downloads every page and screenshot. Start
  // only after the visible page has loaded, so it cannot delay its scripts.
  function scheduleSW() {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(registerSW, { timeout: 4000 });
    } else {
      window.setTimeout(registerSW, 1500);
    }
  }
  if ('serviceWorker' in navigator && !native &&
      (location.protocol === 'http:' || location.protocol === 'https:')) {
    if (document.readyState === 'complete') scheduleSW();
    else window.addEventListener('load', scheduleSW, { once: true });
  }


  /* Films and audio kept inside the phone app: save.js keeps them, the home
     shelf lists and deletes them. Keyed by the address they came from. */
  var KEPT = 'et.kept';
  function keptFiles() {
    try { return JSON.parse(store.get(KEPT, '{}')) || {}; } catch (e) { return {}; }
  }
  function forgetKept(url) {
    var k = keptFiles(), f = k[url];
    if (!f) return Promise.resolve();
    delete k[url];
    store.set(KEPT, JSON.stringify(k));
    var fs = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    return fs ? fs.deleteFile({ path: f.uri }).catch(function () {}) : Promise.resolve();
  }

  var api = {
    keptFiles: keptFiles, forgetKept: forgetKept,
    native: native, online: online, publicOrigin: publicOrigin, publicHref: publicHref, feature: feature,
    store: store, esc: esc, qs: qs, human: human, pad: pad, $: $, $$: $$,
    theme: theme, library: library, byId: byId, displayTitle: displayTitle,
    canInstall: canInstall, onInstallable: onInstallable,
    promptInstall: promptInstall, standalone: standalone,
    safeType: safeType, openable: openable, safeUrl: safeUrl,
    libraryScope: libraryScope, scopedUrl: scopedUrl, scopeEntryUrl: scopeEntryUrl,
    contentCode: contentCode, contentLang: contentLang, inMyLanguage: inMyLanguage,
    module: module, use: use
  };
  modules.core = api;
  return api;
})();
