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
      return location.protocol === 'file:' ? scope.slug + '/index.html' : '/' + scope.slug;
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

  // -------------------------------------------------------------- header
  function header(active) {
    var t = theme();
    var scope = libraryScope();
    var el = document.createElement('header');
    el.className = 'top';
    el.innerHTML =
      '<div class="wrap">' +
        '<span class="brand">' + lantern(30) +
          '<span data-i18n="app.name">The Library</span></span>' +
        (scope ? '' : '<button class="fchip" id="et-lang" data-i18n-aria="ui.lang" aria-label="Language">' +
          icon('globe') + '<span id="et-lang-label"></span></button>') +
        '<button class="fchip" id="et-theme" data-i18n-aria="ui.theme" aria-label="Light or dark">' +
          icon(t === 'dark' ? 'sun' : 'moon') + '</button>' +
      '</div>';
    document.body.insertBefore(el, document.body.firstChild);

    $('#et-theme').addEventListener('click', function () {
      var now = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light' : 'dark';
      theme(now);
      this.innerHTML = icon(now === 'dark' ? 'sun' : 'moon');
    });
    if (!scope) {
      $('#et-lang').addEventListener('click', function () {
        store.set('et.langknown', '1');            // they found it; stop pointing
        var hint = $('#et-hint');
        if (hint) hint.remove();
        ET.i18n.picker();
      });
      langHint();
      // First run, whichever page someone lands on: ask before showing them
      // a library in a language they may not read.
      if (ET.i18n && !ET.i18n.chosen()) ET.i18n.welcome();
    }
    if (active) { /* reserved for nav highlighting */ }
  }

  /* The four destinations. Everything else in the app is reached from one of
     them, which is why no destination needs a Back button of its own. */
  var TABS = [
    ['index.html',   'home',   'tab.home'],
    ['library.html', 'search', 'tab.library'],
    ['nearby.html',  'share',  'tab.send'],
    ['help.html',    'book',   'tab.guide']
  ];

  function tabbar(here) {
    var scope = libraryScope();
    var tabs = scope
      ? [[scopeEntryUrl(), 'search', 'tab.library'], [scopedUrl('help.html'), 'book', 'tab.guide']]
      : TABS;
    var el = document.createElement('nav');
    el.className = 'tabbar';
    el.setAttribute('data-i18n-aria', 'ui.mainnav');
    el.setAttribute('aria-label', ET.i18n.t('ui.mainnav'));
    el.innerHTML = tabs.map(function (tb) {
      var on = scope ? (here === 'library.html' ? tb[2] === 'tab.library' : tb[0].split('?')[0] === here)
                     : tb[0] === here;
      return '<a href="' + tb[0] + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<span class="pipe">' + icon(tb[1]) + '</span>' +
        '<span data-i18n="' + tb[2] + '"></span></a>';
    }).join('');
    document.body.appendChild(el);
    document.body.classList.add('has-tabs');
  }

  /* A row: artwork, what it is, what it is called, and one pill saying what a
     tap does. The library, the shelves and search all render the same one. */
  function displayTitle(r) {
    return r.native && inMyLanguage(r) ? r.native : r.title;
  }

  /* Generated cover art, for everything DBS has no artwork for.

     A plain grey tile with an icon reads as "missing". Instead every item gets
     a cover of its own: a colour family by kind, shifted per title so a shelf
     of Bibles is not one repeated swatch, a large motif, and the title in its
     own script. It is CSS and a few SVG paths — no image to fetch, so it is
     there offline and on the first paint, and a real cover simply lands on
     top of it when one loads. */
  var COVER = {
    film:          [[292, 48, 22], [338, 55, 34]],
    scripture:     [[232, 45, 22], [258, 50, 34]],
    'audio-bible': [[186, 55, 18], [200, 60, 30]],
    audio:         [[26, 70, 22], [40, 78, 36]],
    historic:      [[32, 38, 20], [40, 45, 34]],
    link:          [[214, 25, 20], [222, 30, 32]]
  };
  var MOTIF = {
    // sunrise over hills
    film: '<circle cx="50" cy="58" r="20" fill="currentColor" opacity=".35"/>' +
          '<path d="M0 78 Q25 58 50 72 T100 66 V100 H0z" fill="currentColor" opacity=".28"/>' +
          '<path d="M0 88 Q30 74 60 86 T100 82 V100 H0z" fill="currentColor" opacity=".22"/>',
    // open book
    scripture: '<path d="M50 34 C38 26 22 26 12 30 V74 C22 70 38 70 50 78 C62 70 78 70 88 74 V30 C78 26 62 26 50 34z" ' +
               'fill="none" stroke="currentColor" stroke-width="3" opacity=".45"/>' +
               '<path d="M50 34 V78" stroke="currentColor" stroke-width="2.5" opacity=".45"/>' +
               '<path d="M20 40h20M20 48h20M20 56h16M60 40h20M60 48h20M60 56h16" stroke="currentColor" stroke-width="2" opacity=".3"/>',
    // book and sound
    'audio-bible': '<path d="M30 38 C24 34 16 34 10 36 V68 C16 66 24 66 30 70 C36 66 44 66 50 68 V36 C44 34 36 34 30 38z" fill="currentColor" opacity=".3"/>' +
                   '<path d="M62 40 Q70 52 62 64 M72 32 Q86 52 72 72 M82 24 Q102 52 82 80" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".42"/>',
    // sound waves
    audio: '<circle cx="50" cy="52" r="8" fill="currentColor" opacity=".45"/>' +
           '<circle cx="50" cy="52" r="20" fill="none" stroke="currentColor" stroke-width="3" opacity=".35"/>' +
           '<circle cx="50" cy="52" r="33" fill="none" stroke="currentColor" stroke-width="3" opacity=".24"/>' +
           '<circle cx="50" cy="52" r="46" fill="none" stroke="currentColor" stroke-width="3" opacity=".14"/>',
    // scroll
    historic: '<rect x="22" y="22" width="56" height="60" rx="3" fill="currentColor" opacity=".18"/>' +
              '<path d="M18 22h64M18 82h64" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".35"/>' +
              '<path d="M30 36h40M30 45h40M30 54h34M30 63h38" stroke="currentColor" stroke-width="2.2" opacity=".32"/>',
    // globe
    link: '<circle cx="50" cy="52" r="30" fill="none" stroke="currentColor" stroke-width="3" opacity=".4"/>' +
          '<ellipse cx="50" cy="52" rx="13" ry="30" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".32"/>' +
          '<path d="M20 52h60M25 37h50M25 67h50" stroke="currentColor" stroke-width="2.2" opacity=".28"/>'
  };
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function genCover(r, withTitle) {
    var ty = COVER[r.type] ? r.type : 'link';
    var c = COVER[ty], h = hash(r.id || r.title || '');
    var shift = (h % 40) - 20, angle = 130 + (h % 80);
    // The motif sits in the upper part, clear of the title, at a slight tilt
    // that differs per title so a shelf of one kind still varies.
    var tilt = ((h >> 8) % 17) - 8, size = withTitle ? .62 : .8;
    var off = (100 - 100 * size) / 2;
    var a = 'hsl(' + (c[0][0] + shift) + ' ' + c[0][1] + '% ' + c[0][2] + '%)';
    var b = 'hsl(' + (c[1][0] + shift) + ' ' + c[1][1] + '% ' + c[1][2] + '%)';
    var year = ty === 'historic' && r.year ? '<span class="gen-year">' + esc(r.year) + '</span>' : '';
    var glow = 'radial-gradient(circle at ' + (20 + h % 60) + '% ' + (10 + (h >> 4) % 30) + '%, rgba(255,255,255,.16), transparent 55%)';
    return '<span class="gen" style="background:' + glow + ',linear-gradient(' + angle + 'deg,' + a + ',' + b + ')" aria-hidden="true">' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMin meet"><g transform="translate(' + off + ' ' + (withTitle ? 4 : off) + ') ' +
      'rotate(' + tilt + ' ' + (50 * size) + ' ' + (50 * size) + ') scale(' + size + ')">' + MOTIF[ty] + '</g></svg>' + year +
      (withTitle ? '<span class="gen-title" dir="auto">' + esc(displayTitle(r)) + '</span>' : '') +
      '</span>';
  }
  function artHTML(r, withTitle) {
    var art = r.cover || r.coverOnline;
    return genCover(r, withTitle) +
      (art ? '<img src="' + esc(art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '');
  }

  function row(r, action) {
    return '<a class="rowi" href="' + esc(scopedUrl('item.html', { id: r.id })) + '">' +
      '<span class="art">' + artHTML(r, false) + '</span>' +
      '<span class="meta">' +
        '<span class="kicker">' + esc(action.kicker) + '</span>' +
        '<span class="name" dir="auto">' + esc(displayTitle(r)) + '</span>' +
        '<span class="sub latin">' + esc(action.sub) + '</span>' +
      '</span>' +
      '<span class="go">' + esc(action.verb) + '</span></a>';
  }

  function poster(r, sub) {
    return '<a class="poster" href="' + esc(scopedUrl('item.html', { id: r.id })) + '">' +
      '<span class="art">' + artHTML(r, true) + '</span>' +
      '<span class="name" dir="auto">' + esc(displayTitle(r)) + '</span>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</a>';
  }

  /* A small arrow under the language button, saying "tap to change language"
     and cycling that sentence through every language the app speaks.

     Someone who opens the library in a language they cannot read has to find
     this button to get out, and a globe on its own does not say so. It cycles
     rather than picking one language because the reader we most need to reach
     is exactly the one who cannot read the current one. It points once, and
     never again after the button has been used. */
  function langHint() {
    if (store.get('et.langknown', '') === '1') return;
    var btn = $('#et-lang');
    if (!btn) return;

    var el = document.createElement('div');
    el.className = 'lang-hint';
    el.id = 'et-hint';
    el.innerHTML = '<span class="beak"></span><span class="say" id="et-hint-say"></span>';
    document.body.appendChild(el);

    // Anchored to the viewport, because the header it points at is sticky.
    function place() {
      var r = btn.getBoundingClientRect();
      el.style.top = (r.bottom + 10) + 'px';
      // Centred under the button, then nudged back inside the screen.
      var left = r.left + r.width / 2 - el.offsetWidth / 2;
      left = Math.max(10, Math.min(left, document.documentElement.clientWidth - el.offsetWidth - 10));
      el.style.left = left + 'px';
      el.style.setProperty('--beak', (r.left + r.width / 2 - left) + 'px');
    }

    var langs = ET.i18n.langs, at = 0;
    var say = $('#et-hint-say', el);

    /* It belongs to the top of the page, not to the reader's whole journey
       down it. The moment they scroll, it goes; it comes back only if they
       return to the top, where it is pointing at something they can see. */
    function atTop() { return (window.scrollY || document.documentElement.scrollTop || 0) < 8; }
    var parked = false;
    function onScroll() {
      var top = atTop();
      if (!top && !parked) { parked = true; el.hidden = true; }
      else if (top && parked) { parked = false; el.hidden = false; show(); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    function show() {
      if (parked) return;
      var l = langs[at % langs.length];
      say.textContent = ET.i18n.say('ui.changelang', l.code);
      say.setAttribute('dir', l.dir);
      say.setAttribute('lang', l.code);
      el.classList.remove('in');
      void el.offsetWidth;                        // restart the fade
      el.classList.add('in');
      place();
      at += 1;
    }
    show();
    // Someone who cannot read this language needs the rotation; someone who
    // has asked for less motion just gets their own language, held still.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var timer = setInterval(function () {
        if (!document.body.contains(el)) {
          clearInterval(timer);
          window.removeEventListener('scroll', onScroll);
          return;
        }
        show();
      }, 2600);
    }
    window.addEventListener('resize', place);
    el.addEventListener('click', function () { btn.click(); });
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

  /* Artwork with a guaranteed fallback.

     Online-only resources carry the publisher's cover URL. With no connection
     that load fails, and a CSS background-image fails silently into an empty
     grey box. Instead the type icon is always drawn, and the cover is an <img>
     laid over it that removes itself on error — so offline the icon shows
     through, and online the artwork covers it. */
  function thumb(r, extraStyle) {
    return '<div class="thumb"' + (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' +
      artHTML(r, false) + '</div>';
  }

  /* The interface language and the language the content is SPOKEN in are
     different things, and conflating them is how an English reader tapped an
     English title and heard Sindhi. Choosing a language picks both: English
     shows English films, اردو shows Urdu, سنڌي shows Sindhi. The library can
     still browse the others on purpose. */
  var CONTENT = { mg: 'mlg', rn: 'run', ak: 'aka', ny: 'nya', rw: 'kin', xh: 'xho', sn: 'sna', ha: 'hau', ln: 'lin', pcm: 'pcm', yo: 'yor', pt: 'por', am: 'amh', fr: 'fra', en: 'eng', ur: 'urd', snd: 'snd', ps: 'pus', cmn: 'cmn', yue: 'yue', guz: 'guz', swh: 'swh', zul: 'zul', mas: 'mas', kik: 'kik', hi: 'hin', mr: 'mar', lg: 'lug', luo: 'luo', om: 'orm', ig: 'ibo', pa: 'pan', pnb: 'pnb', ne: 'npi' };
  function contentCode(ui) { return CONTENT[ui] || 'eng'; }
  function contentLang() {
    var scope = libraryScope();
    if (scope) return scope.lang;
    var ui = (ET.i18n && ET.i18n.current()) || 'en';
    return contentCode(ui);
  }
  function inMyLanguage(r) { return r.lang === contentLang(); }

  /* Standard book numbering — matches the DBS CDN audio layout,
     e.g. NT_URDBSI/40_Matthew/40_Matthew_001.mp3 (from GawahiiTV's sheet.js). */
  var BOOKS = {
    OT: [[1,'Genesis',50],[2,'Exodus',40],[3,'Leviticus',27],[4,'Numbers',36],[5,'Deuteronomy',34],
      [6,'Joshua',24],[7,'Judges',21],[8,'Ruth',4],[9,'1Samuel',31],[10,'2Samuel',24],[11,'1Kings',22],
      [12,'2Kings',25],[13,'1Chronicles',29],[14,'2Chronicles',36],[15,'Ezra',10],[16,'Nehemiah',13],
      [17,'Esther',10],[18,'Job',42],[19,'Psalms',150],[20,'Proverbs',31],[21,'Ecclesiastes',12],
      [22,'SongofSongs',8],[23,'Isaiah',66],[24,'Jeremiah',52],[25,'Lamentations',5],[26,'Ezekiel',48],
      [27,'Daniel',12],[28,'Hosea',14],[29,'Joel',3],[30,'Amos',9],[31,'Obadiah',1],[32,'Jonah',4],
      [33,'Micah',7],[34,'Nahum',3],[35,'Habakkuk',3],[36,'Zephaniah',3],[37,'Haggai',2],
      [38,'Zechariah',14],[39,'Malachi',4]],
    NT: [[40,'Matthew',28],[41,'Mark',16],[42,'Luke',24],[43,'John',21],[44,'Acts',28],[45,'Romans',16],
      [46,'1Corinthians',16],[47,'2Corinthians',13],[48,'Galatians',6],[49,'Ephesians',6],
      [50,'Philippians',4],[51,'Colossians',4],[52,'1Thessalonians',5],[53,'2Thessalonians',3],
      [54,'1Timothy',6],[55,'2Timothy',4],[56,'Titus',3],[57,'Philemon',1],[58,'Hebrews',13],
      [59,'James',5],[60,'1Peter',5],[61,'2Peter',3],[62,'1John',5],[63,'2John',1],[64,'3John',1],
      [65,'Jude',1],[66,'Revelation',22]]
  };
  var LOCAL_BOOKS = {
    xh: {
  "Genesis": "Genesis",
  "Exodus": "Eksodus",
  "Leviticus": "Levitikus",
  "Numbers": "Numeri",
  "Deuteronomy": "Duteronomi",
  "Joshua": "Yoshuwa",
  "Judges": "Abagwebi",
  "Ruth": "Rute",
  "1Samuel": "1 Samuweli",
  "2Samuel": "2 Samuweli",
  "1Kings": "1 Kumkani",
  "2Kings": "2 Kumkani",
  "1Chronicles": "1 Kronike",
  "2Chronicles": "2 Kronike",
  "Ezra": "Ezra",
  "Nehemiah": "Nehemiya",
  "Esther": "Estere",
  "Job": "Yobhi",
  "Psalms": "Iindumiso",
  "Proverbs": "Imizekeliso",
  "Ecclesiastes": "INtshumayeli",
  "SongofSongs": "INgoma yazo iiNgoma",
  "Isaiah": "Isaya",
  "Jeremiah": "Yeremiya",
  "Lamentations": "Izililo",
  "Ezekiel": "Hezekile",
  "Daniel": "Daniyeli",
  "Hosea": "Hoseya",
  "Joel": "Yoweli",
  "Amos": "Amosi",
  "Obadiah": "Obhadiya",
  "Jonah": "Yona",
  "Micah": "Mika",
  "Nahum": "Nahum",
  "Habakkuk": "Habhakuki",
  "Zephaniah": "Zefaniya",
  "Haggai": "Hagayi",
  "Zechariah": "Zekariya",
  "Malachi": "Malaki",
  "Matthew": "Mateyu",
  "Mark": "Marko",
  "Luke": "Luka",
  "John": "Yohane",
  "Acts": "IZenzo",
  "Romans": "KwabaseRoma",
  "1Corinthians": "1 KwabaseKorinte",
  "2Corinthians": "2 KwabaseKorinte",
  "Galatians": "KwabaseGalati",
  "Ephesians": "KwabaseEfese",
  "Philippians": "KwabaseFilipi",
  "Colossians": "KwabaseKolose",
  "1Thessalonians": "1 KwabaseTesalonika",
  "2Thessalonians": "2 KwabaseTesalonika",
  "1Timothy": "1 KuTimoti",
  "2Timothy": "2 KuTimoti",
  "Titus": "KuTito",
  "Philemon": "KuFilemon",
  "Hebrews": "KumaHebhere",
  "James": "Yakobi",
  "1Peter": "1 Petros",
  "2Peter": "2 Petros",
  "1John": "1 Yohane",
  "2John": "2 Yohane",
  "3John": "3 Yohane",
  "Jude": "Yuda",
  "Revelation": "ISityhilelo"
},
    ny: {
  "Genesis": "Genesis",
  "Exodus": "Eksodo",
  "Leviticus": "Levitiko",
  "Numbers": "Numeri",
  "Deuteronomy": "Deuteronomo",
  "Joshua": "Yoswa",
  "Judges": "Oweruza",
  "Ruth": "Rute",
  "1Samuel": "1 Samueli",
  "2Samuel": "2 Samueli",
  "1Kings": "1 Mafumu",
  "2Kings": "2 Mafumu",
  "1Chronicles": "1 Mbiri",
  "2Chronicles": "2 Mbiri",
  "Ezra": "Ezara",
  "Nehemiah": "Nehemiya",
  "Esther": "Estere",
  "Job": "Yobu",
  "Psalms": "Masalimo",
  "Proverbs": "Miyambo",
  "Ecclesiastes": "Mlaliki",
  "SongofSongs": "Nyimbo ya Solomoni",
  "Isaiah": "Yesaya",
  "Jeremiah": "Yeremiya",
  "Lamentations": "Maliro",
  "Ezekiel": "Ezekieli",
  "Daniel": "Danieli",
  "Hosea": "Hoseya",
  "Joel": "Yoweli",
  "Amos": "Amosi",
  "Obadiah": "Obadiya",
  "Jonah": "Yona",
  "Micah": "Mika",
  "Nahum": "Nahumu",
  "Habakkuk": "Habakuku",
  "Zephaniah": "Zefaniya",
  "Haggai": "Hagai",
  "Zechariah": "Zekariya",
  "Malachi": "Malaki",
  "Matthew": "Mateyu",
  "Mark": "Marko",
  "Luke": "Luka",
  "John": "Yohane",
  "Acts": "Machitidwe a Atumwi",
  "Romans": "Aroma",
  "1Corinthians": "1 Akorinto",
  "2Corinthians": "2 Akorinto",
  "Galatians": "Agalatiya",
  "Ephesians": "Aefeso",
  "Philippians": "Afilipi",
  "Colossians": "Akolose",
  "1Thessalonians": "1 Atesalonika",
  "2Thessalonians": "2 Atesalonika",
  "1Timothy": "1 Timoteyo",
  "2Timothy": "2 Timoteyo",
  "Titus": "Tito",
  "Philemon": "Filemoni",
  "Hebrews": "Ahebri",
  "James": "Yakobo",
  "1Peter": "1 Petro",
  "2Peter": "2 Petro",
  "1John": "1 Yohane",
  "2John": "2 Yohane",
  "3John": "3 Yohane",
  "Jude": "Yuda",
  "Revelation": "Chivumbulutso"
},
    rw: {
  "Genesis": "Itangiriro",
  "Exodus": "Kuva",
  "Leviticus": "Abalewi",
  "Numbers": "Kubara",
  "Deuteronomy": "Gutegeka kwa Kabiri",
  "Joshua": "Yosuwa",
  "Judges": "Abacamanza",
  "Ruth": "Rusi",
  "1Samuel": "1 Samweli",
  "2Samuel": "2 Samweli",
  "1Kings": "1 Abami",
  "2Kings": "2 Abami",
  "1Chronicles": "1 Ngoma",
  "2Chronicles": "2 Ngoma",
  "Ezra": "Ezira",
  "Nehemiah": "Nehemiya",
  "Esther": "Esiteri",
  "Job": "Yobu",
  "Psalms": "Zaburi",
  "Proverbs": "Imigani",
  "Ecclesiastes": "Umubwiriza",
  "SongofSongs": "Indirimbo ya Salomo",
  "Isaiah": "Yesaya",
  "Jeremiah": "Yeremiya",
  "Lamentations": "Amaganya",
  "Ezekiel": "Ezekiyeli",
  "Daniel": "Daniyeli",
  "Hosea": "Hoseya",
  "Joel": "Yoweli",
  "Amos": "Amosi",
  "Obadiah": "Obadiya",
  "Jonah": "Yona",
  "Micah": "Mika",
  "Nahum": "Nahumu",
  "Habakkuk": "Habakuki",
  "Zephaniah": "Zefaniya",
  "Haggai": "Hagayi",
  "Zechariah": "Zekariya",
  "Malachi": "Malaki",
  "Matthew": "Matayo",
  "Mark": "Mariko",
  "Luke": "Luka",
  "John": "Yohana",
  "Acts": "Ibyakozwe n’Intumwa",
  "Romans": "Abaroma",
  "1Corinthians": "1 Abakorinto",
  "2Corinthians": "2 Abakorinto",
  "Galatians": "Abagalatiya",
  "Ephesians": "Abefeso",
  "Philippians": "Abafilipi",
  "Colossians": "Abakolosayi",
  "1Thessalonians": "1 Abatesalonike",
  "2Thessalonians": "2 Abatesalonike",
  "1Timothy": "1 Timoteyo",
  "2Timothy": "2 Timoteyo",
  "Titus": "Tito",
  "Philemon": "Filemoni",
  "Hebrews": "Abaheburayo",
  "James": "Yakobo",
  "1Peter": "1 Petero",
  "2Peter": "2 Petero",
  "1John": "1 Yohana",
  "2John": "2 Yohana",
  "3John": "3 Yohana",
  "Jude": "Yuda",
  "Revelation": "Ibyahishuwe"
},
    sn: {
  "Genesis": "Genesi",
  "Exodus": "Eksodho",
  "Leviticus": "Revhitiko",
  "Numbers": "Numeri",
  "Deuteronomy": "Dheuteronomio",
  "Joshua": "Joshua",
  "Judges": "Vatongi",
  "Ruth": "Rute",
  "1Samuel": "1 Samueri",
  "2Samuel": "2 Samueri",
  "1Kings": "1 Madzimambo",
  "2Kings": "2 Madzimambo",
  "1Chronicles": "1 Makoronike",
  "2Chronicles": "2 Makoronike",
  "Ezra": "Ezra",
  "Nehemiah": "Nehemia",
  "Esther": "Esteri",
  "Job": "Jobho",
  "Psalms": "Mapisarema",
  "Proverbs": "Zvirevo",
  "Ecclesiastes": "Muparidzi",
  "SongofSongs": "Rwiyo rwaSoromoni",
  "Isaiah": "Isaya",
  "Jeremiah": "Jeremia",
  "Lamentations": "Mariro",
  "Ezekiel": "Ezekieri",
  "Daniel": "Dhanieri",
  "Hosea": "Hosea",
  "Joel": "Joere",
  "Amos": "Amosi",
  "Obadiah": "Obhadhia",
  "Jonah": "Jona",
  "Micah": "Mika",
  "Nahum": "Nahumi",
  "Habakkuk": "Habhakuki",
  "Zephaniah": "Zefania",
  "Haggai": "Hagai",
  "Zechariah": "Zekaria",
  "Malachi": "Maraki",
  "Matthew": "Mateu",
  "Mark": "Mako",
  "Luke": "Ruka",
  "John": "Johani",
  "Acts": "Mabasa",
  "Romans": "VaRoma",
  "1Corinthians": "1 VaKorinde",
  "2Corinthians": "2 VaKorinde",
  "Galatians": "VaGaratia",
  "Ephesians": "VaEfeso",
  "Philippians": "VaFiripi",
  "Colossians": "VaKorose",
  "1Thessalonians": "1 VaTesaronika",
  "2Thessalonians": "2 VaTesaronika",
  "1Timothy": "1 Timoti",
  "2Timothy": "2 Timoti",
  "Titus": "Tito",
  "Philemon": "Firemoni",
  "Hebrews": "VaHebheru",
  "James": "Jakobho",
  "1Peter": "1 Petro",
  "2Peter": "2 Petro",
  "1John": "1 Johani",
  "2John": "2 Johani",
  "3John": "3 Johani",
  "Jude": "Judha",
  "Revelation": "Zvakazarurwa"
},
    rn: {
  "Genesis": "Itanguriro",
  "Exodus": "Kuvayo",
  "Leviticus": "Abalewi",
  "Numbers": "Guharura",
  "Deuteronomy": "Gusubira mu Vyagezwe",
  "Joshua": "Yosuwa",
  "Judges": "Abacamanza",
  "Ruth": "Rusi",
  "1Samuel": "1 Samweli",
  "2Samuel": "2 Samweli",
  "1Kings": "1 Abami",
  "2Kings": "2 Abami",
  "1Chronicles": "1 Ivyo ku Ngoma",
  "2Chronicles": "2 Ivyo ku Ngoma",
  "Ezra": "Ezira",
  "Nehemiah": "Nehemiya",
  "Esther": "Esiteri",
  "Job": "Yobu",
  "Psalms": "Zaburi",
  "Proverbs": "Imigani",
  "Ecclesiastes": "Umusiguzi",
  "SongofSongs": "Indirimbo ya Salomo",
  "Isaiah": "Yesaya",
  "Jeremiah": "Yeremiya",
  "Lamentations": "Gucura Intimba",
  "Ezekiel": "Ezekiyeli",
  "Daniel": "Daniyeli",
  "Hosea": "Hoseya",
  "Joel": "Yoweli",
  "Amos": "Amosi",
  "Obadiah": "Obadiya",
  "Jonah": "Yona",
  "Micah": "Mika",
  "Nahum": "Nahumu",
  "Habakkuk": "Habakuki",
  "Zephaniah": "Zefaniya",
  "Haggai": "Hagayi",
  "Zechariah": "Zekariya",
  "Malachi": "Malaki",
  "Matthew": "Matayo",
  "Mark": "Mariko",
  "Luke": "Luka",
  "John": "Yohana",
  "Acts": "Ivyakozwe n’Intumwa",
  "Romans": "Abaroma",
  "1Corinthians": "1 Ab’i Korinto",
  "2Corinthians": "2 Ab’i Korinto",
  "Galatians": "Ab’i Galatiya",
  "Ephesians": "Abanyefeso",
  "Philippians": "Ab’i Filipi",
  "Colossians": "Ab’i Kolosayi",
  "1Thessalonians": "1 Ab’i Tesalonike",
  "2Thessalonians": "2 Ab’i Tesalonike",
  "1Timothy": "1 Timoteyo",
  "2Timothy": "2 Timoteyo",
  "Titus": "Tito",
  "Philemon": "Filemoni",
  "Hebrews": "Abaheburayo",
  "James": "Yakobo",
  "1Peter": "1 Petero",
  "2Peter": "2 Petero",
  "1John": "1 Yohana",
  "2John": "2 Yohana",
  "3John": "3 Yohana",
  "Jude": "Yuda",
  "Revelation": "Ivyahishuriwe Yohana"
},
    ak: {
  "Genesis": "1 Mose",
  "Exodus": "2 Mose",
  "Leviticus": "3 Mose",
  "Numbers": "4 Mose",
  "Deuteronomy": "5 Mose",
  "Joshua": "Yosua",
  "Judges": "Atemmufo",
  "Ruth": "Rut",
  "1Samuel": "1 Samuel",
  "2Samuel": "2 Samuel",
  "1Kings": "1 Ahemfo",
  "2Kings": "2 Ahemfo",
  "1Chronicles": "1 Berɛsosɛm",
  "2Chronicles": "2 Berɛsosɛm",
  "Ezra": "Ɛsra",
  "Nehemiah": "Nehemia",
  "Esther": "Ɛster",
  "Job": "Hiob",
  "Psalms": "Nnwom",
  "Proverbs": "Mmebusɛm",
  "Ecclesiastes": "Ɔsɛnkafo",
  "SongofSongs": "Nnwom mu Dwom",
  "Isaiah": "Yesaia",
  "Jeremiah": "Yeremia",
  "Lamentations": "Kwadwom",
  "Ezekiel": "Hesekiel",
  "Daniel": "Daniel",
  "Hosea": "Hosea",
  "Joel": "Yoɛl",
  "Amos": "Amos",
  "Obadiah": "Obadia",
  "Jonah": "Yona",
  "Micah": "Mika",
  "Nahum": "Nahum",
  "Habakkuk": "Habakuk",
  "Zephaniah": "Sefania",
  "Haggai": "Hagai",
  "Zechariah": "Sakaria",
  "Malachi": "Malaki",
  "Matthew": "Mateo",
  "Mark": "Marko",
  "Luke": "Luka",
  "John": "Yohane",
  "Acts": "Asomafo Nnwuma",
  "Romans": "Romafo",
  "1Corinthians": "1 Korintofo",
  "2Corinthians": "2 Korintofo",
  "Galatians": "Galatifo",
  "Ephesians": "Efesofo",
  "Philippians": "Filipifo",
  "Colossians": "Kolosefo",
  "1Thessalonians": "1 Tesalonikafo",
  "2Thessalonians": "2 Tesalonikafo",
  "1Timothy": "1 Timoteo",
  "2Timothy": "2 Timoteo",
  "Titus": "Tito",
  "Philemon": "Filemon",
  "Hebrews": "Hebrifo",
  "James": "Yakobo",
  "1Peter": "1 Petro",
  "2Peter": "2 Petro",
  "1John": "1 Yohane",
  "2John": "2 Yohane",
  "3John": "3 Yohane",
  "Jude": "Yuda",
  "Revelation": "Adiyisɛm"
},
    mg: {
  "Matthew": "Matio",
  "Mark": "Marka",
  "Luke": "Lioka",
  "John": "Jaona",
  "Acts": "Asan’ny Apostoly",
  "Romans": "Romana",
  "1Corinthians": "1 Korintiana",
  "2Corinthians": "2 Korintiana",
  "Galatians": "Galatiana",
  "Ephesians": "Efesiana",
  "Philippians": "Filipiana",
  "Colossians": "Kolosiana",
  "1Thessalonians": "1 Tesaloniana",
  "2Thessalonians": "2 Tesaloniana",
  "1Timothy": "1 Timoty",
  "2Timothy": "2 Timoty",
  "Titus": "Titosy",
  "Philemon": "Filemona",
  "Hebrews": "Hebreo",
  "James": "Jakoba",
  "1Peter": "1 Petera",
  "2Peter": "2 Petera",
  "1John": "1 Jaona",
  "2John": "2 Jaona",
  "3John": "3 Jaona",
  "Jude": "Joda",
  "Revelation": "Apokalipsy"
},
    ha: {
  "Genesis": "Farawa",
  "Exodus": "Fitowa",
  "Leviticus": "Firistoci",
  "Numbers": "ƘIDAYA",
  "Deuteronomy": "MAIMAITAWAR SHARIʼA",
  "Joshua": "Yoshuwa",
  "Judges": "Mahukunta",
  "Ruth": "Rut",
  "1Samuel": "1 SAMAʼILA",
  "2Samuel": "2 SAMAʼILA",
  "1Kings": "1 Sarakuna",
  "2Kings": "2 Sarakuna",
  "1Chronicles": "1 Tarihi",
  "2Chronicles": "2 Tarihi",
  "Ezra": "Ezra",
  "Nehemiah": "Nehemiya",
  "Esther": "Esta",
  "Job": "Ayuba",
  "Psalms": "Zabura",
  "Proverbs": "Karin Magana",
  "Ecclesiastes": "Mai Hadishi",
  "SongofSongs": "WAƘAR WAƘOƘI",
  "Isaiah": "Ishaya",
  "Jeremiah": "Irmiya",
  "Lamentations": "Makoki",
  "Ezekiel": "Ezekiyel",
  "Daniel": "Daniyel",
  "Hosea": "Hosiya",
  "Joel": "Yowel",
  "Amos": "Amos",
  "Obadiah": "Obadiya",
  "Jonah": "Yunana",
  "Micah": "Mika",
  "Nahum": "Nahum",
  "Habakkuk": "Habakkuk",
  "Zephaniah": "Zefaniya",
  "Haggai": "Haggai",
  "Zechariah": "Zakariya",
  "Malachi": "Malaki",
  "Matthew": "Mattiyu",
  "Mark": "Markus",
  "Luke": "Luka",
  "John": "Yohanna",
  "Acts": "Ayyukan Manzanni",
  "Romans": "Romawa",
  "1Corinthians": "1 Korintiyawa",
  "2Corinthians": "2 Korintiyawa",
  "Galatians": "Galatiyawa",
  "Ephesians": "Afisawa",
  "Philippians": "Filibbiyawa",
  "Colossians": "Kolossiyawa",
  "1Thessalonians": "1 Tessalonikawa",
  "2Thessalonians": "2 Tessalonikawa",
  "1Timothy": "1 Timoti",
  "2Timothy": "2 Timoti",
  "Titus": "Titus",
  "Philemon": "Filemon",
  "Hebrews": "Ibraniyawa",
  "James": "YAƘUB",
  "1Peter": "1 Bitrus",
  "2Peter": "2 Bitrus",
  "1John": "1 Yohanna",
  "2John": "2 Yohanna",
  "3John": "3 Yohanna",
  "Jude": "Yahuda",
  "Revelation": "RUʼUYA TA YOHANNA"
},
    ln: {
  "Genesis": "Ebandeli",
  "Exodus": "Kobima",
  "Leviticus": "Levitike",
  "Numbers": "Mitango",
  "Deuteronomy": "Deteronomi",
  "Joshua": "Jozue",
  "Judges": "Bilombe",
  "Ruth": "Rite",
  "1Samuel": "1 Samuele",
  "2Samuel": "2 Samuele",
  "1Kings": "1 Bakonzi",
  "2Kings": "2 Bakonzi",
  "1Chronicles": "1 Masolo ya Kala",
  "2Chronicles": "2 Masolo ya Kala",
  "Ezra": "Esidrasi",
  "Nehemiah": "Neyemi",
  "Esther": "Ester",
  "Job": "Yobo",
  "Psalms": "Banzembo",
  "Proverbs": "Masese",
  "Ecclesiastes": "Mosakoli",
  "SongofSongs": "Loyembo ya Salomo",
  "Isaiah": "Ezayi",
  "Jeremiah": "Jeremi",
  "Lamentations": "Bileli",
  "Ezekiel": "Ezekieli",
  "Daniel": "Daniele",
  "Hosea": "Oze",
  "Joel": "Joeli",
  "Amos": "Amosi",
  "Obadiah": "Abidiasi",
  "Jonah": "Yona",
  "Micah": "Mishe",
  "Nahum": "Naumi",
  "Habakkuk": "Abakuki",
  "Zephaniah": "Sofoni",
  "Haggai": "Aje",
  "Zechariah": "Zakari",
  "Malachi": "Malashi",
  "Matthew": "Matayo",
  "Mark": "Malako",
  "Luke": "Luka",
  "John": "Yoane",
  "Acts": "Misala ya Bantoma",
  "Romans": "Barome",
  "1Corinthians": "1 Bakolinto",
  "2Corinthians": "2 Bakolinto",
  "Galatians": "Bagalatia",
  "Ephesians": "Ba-Efeso",
  "Philippians": "Bafilipi",
  "Colossians": "Bakolose",
  "1Thessalonians": "1 Batesalonika",
  "2Thessalonians": "2 Batesalonika",
  "1Timothy": "1 Timote",
  "2Timothy": "2 Timote",
  "Titus": "Tito",
  "Philemon": "Filemo",
  "Hebrews": "Ba-Ebre",
  "James": "Jake",
  "1Peter": "1 Petelo",
  "2Peter": "2 Petelo",
  "1John": "1 Yoane",
  "2John": "2 Yoane",
  "3John": "3 Yoane",
  "Jude": "Jide",
  "Revelation": "Emoniseli"
},
    pcm: {
  "Genesis": "Jenesis",
  "Exodus": "Exodus",
  "Leviticus": "Levitikus",
  "Numbers": "Nombas",
  "Deuteronomy": "Deutronomi",
  "Joshua": "Joshua",
  "Judges": "Judges",
  "Ruth": "Rut",
  "1Samuel": "1 Samuel",
  "2Samuel": "2 Samuel",
  "1Kings": "1 Kings",
  "2Kings": "2 Kings",
  "1Chronicles": "1 Kronikles",
  "2Chronicles": "2 Kronikles",
  "Ezra": "Ezra",
  "Nehemiah": "Nehemaya",
  "Esther": "Estha",
  "Job": "Job",
  "Psalms": "Psalms",
  "Proverbs": "Proverbs",
  "Ecclesiastes": "Ekklesiastes",
  "SongofSongs": "Song of Songs",
  "Isaiah": "Isaya",
  "Jeremiah": "Jeremaya",
  "Lamentations": "Lamentashons",
  "Ezekiel": "Ezekiel",
  "Daniel": "Daniel",
  "Hosea": "Hosea",
  "Joel": "Joel",
  "Amos": "Amos",
  "Obadiah": "Obadaya",
  "Jonah": "Jonah",
  "Micah": "Mikah",
  "Nahum": "Nahum",
  "Habakkuk": "Habakkuk",
  "Zephaniah": "Zefanaya",
  "Haggai": "Haggai",
  "Zechariah": "Zekaraya",
  "Malachi": "Malakai",
  "Matthew": "Matiu",
  "Mark": "Mark",
  "Luke": "Luke",
  "John": "John",
  "Acts": "Acts",
  "Romans": "Romans",
  "1Corinthians": "1 Korintians",
  "2Corinthians": "2 Korintians",
  "Galatians": "Galatians",
  "Ephesians": "Efesians",
  "Philippians": "Filippians",
  "Colossians": "Kolossians",
  "1Thessalonians": "1 Tesalonians",
  "2Thessalonians": "2 Tesalonians",
  "1Timothy": "1 Timoti",
  "2Timothy": "2 Timoti",
  "Titus": "Titus",
  "Philemon": "Filemon",
  "Hebrews": "Hibru",
  "James": "James",
  "1Peter": "1 Pita",
  "2Peter": "2 Pita",
  "1John": "1 John",
  "2John": "2 John",
  "3John": "3 John",
  "Jude": "Jude",
  "Revelation": "Revelashon"
},
    yo: {
 "Genesis": "Gẹnẹsisi",
 "Exodus": "Eksodu",
 "Leviticus": "Lefitiku",
 "Numbers": "Numeri",
 "Deuteronomy": "Deuteronomi",
 "Joshua": "Joṣua",
 "Judges": "Onidajọ",
 "Ruth": "Rutu",
 "1Samuel": "1 Samuẹli",
 "2Samuel": "2 Samuẹli",
 "1Kings": "1 Ọba",
 "2Kings": "2 Ọba",
 "1Chronicles": "1 Kronika",
 "2Chronicles": "2 Kronika",
 "Ezra": "Esra",
 "Nehemiah": "Nehemiah",
 "Esther": "Esteri",
 "Job": "Jobu",
 "Psalms": "Saamu",
 "Proverbs": "Òwe",
 "Ecclesiastes": "Oniwaasu",
 "SongofSongs": "Orin Solomoni",
 "Isaiah": "Isaiah",
 "Jeremiah": "Jeremiah",
 "Lamentations": "Ẹkún Jeremiah",
 "Ezekiel": "Esekiẹli",
 "Daniel": "Daniẹli",
 "Hosea": "Hosea",
 "Joel": "Joẹli",
 "Amos": "Amosi",
 "Obadiah": "Obadiah",
 "Jonah": "Jona",
 "Micah": "Mika",
 "Nahum": "Nahumu",
 "Habakkuk": "Habakuku",
 "Zephaniah": "Sefaniah",
 "Haggai": "Hagai",
 "Zechariah": "Sekariah",
 "Malachi": "Malaki",
 "Matthew": "Matiu",
 "Mark": "Marku",
 "Luke": "Luku",
 "John": "Johanu",
 "Acts": "Ìṣe àwọn Aposteli",
 "Romans": "Romu",
 "1Corinthians": "1 Kọrinti",
 "2Corinthians": "2 Kọrinti",
 "Galatians": "Galatia",
 "Ephesians": "Efesu",
 "Philippians": "Filipi",
 "Colossians": "Kolose",
 "1Thessalonians": "1 Tẹsalonika",
 "2Thessalonians": "2 Tẹsalonika",
 "1Timothy": "1 Timotiu",
 "2Timothy": "2 Timotiu",
 "Titus": "Titu",
 "Philemon": "Filemoni",
 "Hebrews": "Heberu",
 "James": "Jakọbu",
 "1Peter": "1 Peteru",
 "2Peter": "2 Peteru",
 "1John": "1 Johanu",
 "2John": "2 Johanu",
 "3John": "3 Johanu",
 "Jude": "Juda",
 "Revelation": "Ìfihàn"
},
    pt: {
  "Genesis": "Gênesis",
  "Exodus": "Êxodo",
  "Leviticus": "Levítico",
  "Numbers": "Números",
  "Deuteronomy": "Deuteronômio",
  "Joshua": "Josué",
  "Judges": "Juízes",
  "Ruth": "Rute",
  "1Samuel": "1 Samuel",
  "2Samuel": "2 Samuel",
  "1Kings": "1 Reis",
  "2Kings": "2 Reis",
  "1Chronicles": "1 Crônicas",
  "2Chronicles": "2 Crônicas",
  "Ezra": "Esdras",
  "Nehemiah": "Neemias",
  "Esther": "Ester",
  "Job": "Jó",
  "Psalms": "Salmos",
  "Proverbs": "Provérbios",
  "Ecclesiastes": "Eclesiastes",
  "SongofSongs": "Cântico dos Cânticos",
  "Isaiah": "Isaías",
  "Jeremiah": "Jeremias",
  "Lamentations": "Lamentações",
  "Ezekiel": "Ezequiel",
  "Daniel": "Daniel",
  "Hosea": "Oseias",
  "Joel": "Joel",
  "Amos": "Amós",
  "Obadiah": "Obadias",
  "Jonah": "Jonas",
  "Micah": "Miqueias",
  "Nahum": "Naum",
  "Habakkuk": "Habacuque",
  "Zephaniah": "Sofonias",
  "Haggai": "Ageu",
  "Zechariah": "Zacarias",
  "Malachi": "Malaquias",
  "Matthew": "Mateus",
  "Mark": "Marcos",
  "Luke": "Lucas",
  "John": "João",
  "Acts": "Atos dos Apóstolos",
  "Romans": "Romanos",
  "1Corinthians": "1 Coríntios",
  "2Corinthians": "2 Coríntios",
  "Galatians": "Gálatas",
  "Ephesians": "Efésios",
  "Philippians": "Filipenses",
  "Colossians": "Colossenses",
  "1Thessalonians": "1 Tessalonicenses",
  "2Thessalonians": "2 Tessalonicenses",
  "1Timothy": "1 Timóteo",
  "2Timothy": "2 Timóteo",
  "Titus": "Tito",
  "Philemon": "Filemom",
  "Hebrews": "Hebreus",
  "James": "Tiago",
  "1Peter": "1 Pedro",
  "2Peter": "2 Pedro",
  "1John": "1 João",
  "2John": "2 João",
  "3John": "3 João",
  "Jude": "Judas",
  "Revelation": "Apocalipse"
},
    am: {
  "Genesis": "ዘፍጥረት",
  "Exodus": "ዘጸአት",
  "Leviticus": "ዘሌዋውያን",
  "Numbers": "ዘኍልቍ",
  "Deuteronomy": "ዘዳግም",
  "Joshua": "ኢያሱ",
  "Judges": "መሳፍንት",
  "Ruth": "ሩት",
  "1Samuel": "1ኛ ሳሙኤል",
  "2Samuel": "2ኛ ሳሙኤል",
  "1Kings": "1ኛ ነገሥት",
  "2Kings": "2ኛ ነገሥት",
  "1Chronicles": "1ኛ ዜና መዋዕል",
  "2Chronicles": "2ኛ ዜና መዋዕል",
  "Ezra": "ዕዝራ",
  "Nehemiah": "ነህምያ",
  "Esther": "አስቴር",
  "Job": "ኢዮብ",
  "Psalms": "መዝሙረ ዳዊት",
  "Proverbs": "ምሳሌ",
  "Ecclesiastes": "መክብብ",
  "SongofSongs": "መኃልየ መኃልይ",
  "Isaiah": "ኢሳይያስ",
  "Jeremiah": "ኤርምያስ",
  "Lamentations": "ሰቆቃወ ኤርምያስ",
  "Ezekiel": "ሕዝቅኤል",
  "Daniel": "ዳንኤል",
  "Hosea": "ሆሴዕ",
  "Joel": "ኢዩኤል",
  "Amos": "አሞጽ",
  "Obadiah": "አብድዩ",
  "Jonah": "ዮናስ",
  "Micah": "ሚክያስ",
  "Nahum": "ናሆም",
  "Habakkuk": "ዕንባቆም",
  "Zephaniah": "ሶፎንያስ",
  "Haggai": "ሐጌ",
  "Zechariah": "ዘካርያስ",
  "Malachi": "ሚልክያስ",
  "Matthew": "ማቴዎስ",
  "Mark": "ማርቆስ",
  "Luke": "ሉቃስ",
  "John": "ዮሐንስ",
  "Acts": "የሐዋርያት ሥራ",
  "Romans": "ሮሜ",
  "1Corinthians": "1ኛ ቆሮንቶስ",
  "2Corinthians": "2ኛ ቆሮንቶስ",
  "Galatians": "ገላትያ",
  "Ephesians": "ኤፌሶን",
  "Philippians": "ፊልጵስዩስ",
  "Colossians": "ቆላስይስ",
  "1Thessalonians": "1ኛ ተሰሎንቄ",
  "2Thessalonians": "2ኛ ተሰሎንቄ",
  "1Timothy": "1ኛ ጢሞቴዎስ",
  "2Timothy": "2ኛ ጢሞቴዎስ",
  "Titus": "ቲቶ",
  "Philemon": "ፊልሞና",
  "Hebrews": "ዕብራውያን",
  "James": "ያዕቆብ",
  "1Peter": "1ኛ ጴጥሮስ",
  "2Peter": "2ኛ ጴጥሮስ",
  "1John": "1ኛ ዮሐንስ",
  "2John": "2ኛ ዮሐንስ",
  "3John": "3ኛ ዮሐንስ",
  "Jude": "ይሁዳ",
  "Revelation": "የዮሐንስ ራእይ"
},
    fr: {
  "Genesis": "Genèse",
  "Exodus": "Exode",
  "Leviticus": "Lévitique",
  "Numbers": "Nombres",
  "Deuteronomy": "Deutéronome",
  "Joshua": "Josué",
  "Judges": "Juges",
  "Ruth": "Ruth",
  "1Samuel": "1 Samuel",
  "2Samuel": "2 Samuel",
  "1Kings": "1 Rois",
  "2Kings": "2 Rois",
  "1Chronicles": "1 Chroniques",
  "2Chronicles": "2 Chroniques",
  "Ezra": "Esdras",
  "Nehemiah": "Néhémie",
  "Esther": "Esther",
  "Job": "Job",
  "Psalms": "Psaumes",
  "Proverbs": "Proverbes",
  "Ecclesiastes": "Ecclésiaste",
  "SongofSongs": "Cantique des cantiques",
  "Isaiah": "Ésaïe",
  "Jeremiah": "Jérémie",
  "Lamentations": "Lamentations",
  "Ezekiel": "Ézéchiel",
  "Daniel": "Daniel",
  "Hosea": "Osée",
  "Joel": "Joël",
  "Amos": "Amos",
  "Obadiah": "Abdias",
  "Jonah": "Jonas",
  "Micah": "Michée",
  "Nahum": "Nahum",
  "Habakkuk": "Habacuc",
  "Zephaniah": "Sophonie",
  "Haggai": "Aggée",
  "Zechariah": "Zacharie",
  "Malachi": "Malachie",
  "Matthew": "Matthieu",
  "Mark": "Marc",
  "Luke": "Luc",
  "John": "Jean",
  "Acts": "Actes",
  "Romans": "Romains",
  "1Corinthians": "1 Corinthiens",
  "2Corinthians": "2 Corinthiens",
  "Galatians": "Galates",
  "Ephesians": "Éphésiens",
  "Philippians": "Philippiens",
  "Colossians": "Colossiens",
  "1Thessalonians": "1 Thessaloniciens",
  "2Thessalonians": "2 Thessaloniciens",
  "1Timothy": "1 Timothée",
  "2Timothy": "2 Timothée",
  "Titus": "Tite",
  "Philemon": "Philémon",
  "Hebrews": "Hébreux",
  "James": "Jacques",
  "1Peter": "1 Pierre",
  "2Peter": "2 Pierre",
  "1John": "1 Jean",
  "2John": "2 Jean",
  "3John": "3 Jean",
  "Jude": "Jude",
  "Revelation": "Apocalypse"
},
    // Published names from DBS’s Igbo Union audio Bible selector.
    ig: {
      "Genesis": "Jenesis",
      "Exodus": "ỌPUPU",
      "Leviticus": "LEVITIKỌS",
      "Numbers": "ỌNỤỌGỤGỤ",
      "Deuteronomy": "Diuteronomi",
      "Joshua": "Joshua",
      "Judges": "Ndi-Ikpe",
      "Ruth": "Rut",
      "1Samuel": "1 Samuel",
      "2Samuel": "2 Samuel",
      "1Kings": "1 NDỊ EZE",
      "2Kings": "2 NDỊ EZE",
      "1Chronicles": "1 Ihe E Mere",
      "2Chronicles": "2 Ihe E Mere",
      "Ezra": "Ezra",
      "Nehemiah": "Nehemaia",
      "Esther": "Esta",
      "Job": "Job",
      "Psalms": "ABỤ ỌMA",
      "Proverbs": "Ilu",
      "Ecclesiastes": "Eklisiastis",
      "SongofSongs": "ABÙ NKE ABÙ",
      "Isaiah": "AỊZAYA",
      "Jeremiah": "Jeremaya",
      "Lamentations": "ABÙ-ÁKWÁ",
      "Ezekiel": "Ezikiel",
      "Daniel": "Daniel",
      "Hosea": "Hosiya",
      "Joel": "Juel",
      "Amos": "Emos",
      "Obadiah": "Obadaia",
      "Jonah": "Jona",
      "Micah": "Maika",
      "Nahum": "Nehum",
      "Habakkuk": "Habakuk",
      "Zephaniah": "Zefanaya",
      "Haggai": "Hegai",
      "Zechariah": "Zekaraya",
      "Malachi": "Malakai",
      "Matthew": "Matiu",
      "Mark": "Mak",
      "Luke": "Luk",
      "John": "JỌN",
      "Acts": "ỌLU NDI-OZI",
      "Romans": "NDỊ ROM",
      "1Corinthians": "1 NDỊ KỌRINT",
      "2Corinthians": "2 NDỊ KỌRINT",
      "Galatians": "Ndi Galetia",
      "Ephesians": "NDI EFESỌS",
      "Philippians": "NDỊ FILIPAI",
      "Colossians": "NDỊ KỌLỌSỊ",
      "1Thessalonians": "1 NDỊ TESALONAỊKA",
      "2Thessalonians": "2 NDỊ TESALONAỊKA",
      "1Timothy": "1 Timoti",
      "2Timothy": "2 Timoti",
      "Titus": "TAỊTỌS",
      "Philemon": "FỊLỊMỌN",
      "Hebrews": "Ndi-Hibru",
      "James": "Jemis",
      "1Peter": "1 Pita",
      "2Peter": "2 Pita",
      "1John": "1 JỌN",
      "2John": "2 JỌN",
      "3John": "3 JỌN",
      "Jude": "Jud",
      "Revelation": "Nkpughe"
},
    // Native names from DBS’s current Oromo audio Bible.
    om: {
    "Genesis": "Uumama",
    "Exodus": "BAʼUU",
    "Leviticus": "Lewwota",
    "Numbers": "Lakkoobsa",
    "Deuteronomy": "ኬሰ ዴቢ",
    "Joshua": "Iyyaasuu",
    "Judges": "Abbootii Murtii",
    "Ruth": "Ruut",
    "1Samuel": "1 SAAMUʼEEL",
    "2Samuel": "2 ሳሙኤል",
    "1Kings": "1 Mootota",
    "2Kings": "2 Mootota",
    "1Chronicles": "1 Seenaa",
    "2Chronicles": "2 Seenaa",
    "Ezra": "Izraa",
    "Nehemiah": "Nahimiyaa",
    "Esther": "አስቴር",
    "Job": "Iyyoob",
    "Psalms": "Faarfannaa",
    "Proverbs": "Fakkeenya",
    "Ecclesiastes": "Lallaba",
    "SongofSongs": "ዌዱ",
    "Isaiah": "Isaayyaas",
    "Jeremiah": "Ermiyaas",
    "Lamentations": "Faaruu",
    "Ezekiel": "ህስቅኤል",
    "Daniel": "DAANIʼEL",
    "Hosea": "HOOSEʼAA",
    "Joel": "YOOʼEEL",
    "Amos": "Amoos",
    "Obadiah": "ኦባድያ",
    "Jonah": "Yoonaas",
    "Micah": "Miikiyaas",
    "Nahum": "Naahoom",
    "Habakkuk": "አንባቆም",
    "Zephaniah": "Sefaaniyaa",
    "Haggai": "Haagee",
    "Zechariah": "Zakkaariyaas",
    "Malachi": "Miilkiyaas",
    "Matthew": "ማቴዎስ",
    "Mark": "Maarqos",
    "Luke": "Luqaas",
    "John": "Yohannis",
    "Acts": "Hojii",
    "Romans": "ሮማ",
    "1Corinthians": "1 Qorontos",
    "2Corinthians": "2 Qorontos",
    "Galatians": "Galaatiyaa",
    "Ephesians": "ኤፌሶን",
    "Philippians": "Fiiliphisiyuus",
    "Colossians": "Qolosaayis",
    "1Thessalonians": "1 Tasaloniiqee",
    "2Thessalonians": "2 Tasaloniiqee",
    "1Timothy": "1 ጢሞቴዎስ",
    "2Timothy": "2 Xiimotewos",
    "Titus": "Tiitoo",
    "Philemon": "Fiilmoonaa",
    "Hebrews": "እብሮተ",
    "James": "Yaaqoob",
    "1Peter": "1 Phexros",
    "2Peter": "2 Phexros",
    "1John": "1 Yohannis",
    "2John": "2 ዮሀንስ",
    "3John": "3 Yohannis",
    "Jude": "Yihuudaa",
    "Revelation": "MULʼATA"
},
    // All 66 names copied from DBS’s current Dholuo audio Bible selector.
    luo: {
    "Genesis": "Chakruok",
    "Exodus": "Wuok",
    "Leviticus": "Tim Jo-Lawi",
    "Numbers": "Kwan",
    "Deuteronomy": "Rapar Mar Chik",
    "Joshua": "Joshua",
    "Judges": "JONGʼAD BURA",
    "Ruth": "Ruth",
    "1Samuel": "1 Samuel",
    "2Samuel": "2 Samuel",
    "1Kings": "1 Ruodhi",
    "2Kings": "2 Ruodhi",
    "1Chronicles": "1 Weche Mag Ndalo",
    "2Chronicles": "2 Weche Mag Ndalo",
    "Ezra": "Ezra",
    "Nehemiah": "Nehemia",
    "Esther": "Esta",
    "Job": "Ayub",
    "Psalms": "Zaburi",
    "Proverbs": "Ngeche",
    "Ecclesiastes": "Eklesiastes",
    "SongofSongs": "Wer Mamit",
    "Isaiah": "Isaya",
    "Jeremiah": "Jeremia",
    "Lamentations": "Ywagruok",
    "Ezekiel": "Ezekiel",
    "Daniel": "Daniel",
    "Hosea": "Hosea",
    "Joel": "Joel",
    "Amos": "Amos",
    "Obadiah": "Obadia",
    "Jonah": "Jona",
    "Micah": "Mika",
    "Nahum": "Nahum",
    "Habakkuk": "Habakuk",
    "Zephaniah": "Zefania",
    "Haggai": "Hagai",
    "Zechariah": "Zekaria",
    "Malachi": "Malaki",
    "Matthew": "Mathayo",
    "Mark": "Mariko",
    "Luke": "Luka",
    "John": "Johana",
    "Acts": "Tich Joote",
    "Romans": "Jo-Rumi",
    "1Corinthians": "1 Jo-Korintho",
    "2Corinthians": "2 Jo-Korintho",
    "Galatians": "Jo-Galatia",
    "Ephesians": "Jo-Efeso",
    "Philippians": "Jo-Filipi",
    "Colossians": "Jo-Kolosai",
    "1Thessalonians": "1 Jo-Thesalonika",
    "2Thessalonians": "2 Jo-Thesalonika",
    "1Timothy": "1 Timotheo",
    "2Timothy": "2 Timotheo",
    "Titus": "Tito",
    "Philemon": "Filemon",
    "Hebrews": "Jo-Hibrania",
    "James": "Jakobo",
    "1Peter": "1 Petro",
    "2Peter": "2 Petro",
    "1John": "1 Johana",
    "2John": "2 Johana",
    "3John": "3 Johana",
    "Jude": "Juda",
    "Revelation": "Fweny"
},
    // Names from DBS’s Luganda Bible audio book picker.
    lg: {
    "Genesis": "Olubereberye",
    "Exodus": "Okuva",
    "Leviticus": "Ebyabaleevi",
    "Numbers": "Okubala",
    "Deuteronomy": "Ekyamateeka Olwokubiri",
    "Joshua": "Yoswa",
    "Judges": "Ekyabalamuzi",
    "Ruth": "Luusi",
    "1Samuel": "1 Samwiri",
    "2Samuel": "2 Samwiri",
    "1Kings": "1 Bassekabaka",
    "2Kings": "2 Bassekabaka",
    "1Chronicles": "1 Ebyomumirembe",
    "2Chronicles": "2 Ebyomumirembe",
    "Ezra": "Ezera",
    "Nehemiah": "Nekkemiya",
    "Esther": "Eseza",
    "Job": "Yobu",
    "Psalms": "Zabbuli",
    "Proverbs": "Engero",
    "Ecclesiastes": "Omubuulizi",
    "SongofSongs": "Oluyimba",
    "Isaiah": "Isaaya",
    "Jeremiah": "Yeremiya",
    "Lamentations": "Okukungubaga",
    "Ezekiel": "Ezeekyeri",
    "Daniel": "Danyeri",
    "Hosea": "Koseya",
    "Joel": "Yoweeri",
    "Amos": "Amosi",
    "Obadiah": "Obadiya",
    "Jonah": "Yona",
    "Micah": "Mikka",
    "Nahum": "Nakkumu",
    "Habakkuk": "Kaabakuuku",
    "Zephaniah": "Zeffaniya",
    "Haggai": "Kaggayi",
    "Zechariah": "Zekkaliya",
    "Malachi": "Malaki",
    "Matthew": "Matayo",
    "Mark": "Makko",
    "Luke": "Lukka",
    "John": "Yokaana",
    "Acts": "Ebikolwa by’Abatume",
    "Romans": "Abaruumi",
    "1Corinthians": "1 Abakkolinso",
    "2Corinthians": "2 Abakkolinso",
    "Galatians": "Abaggalatiya",
    "Ephesians": "Abaefeso",
    "Philippians": "Abafiripi",
    "Colossians": "Abakkolosaayi",
    "1Thessalonians": "1 Basessaloniika",
    "2Thessalonians": "2 Basessaloniika",
    "1Timothy": "1 Timoseewo",
    "2Timothy": "2 Timoseewo",
    "Titus": "Tito",
    "Philemon": "Firemooni",
    "Hebrews": "Abaebbulaniya",
    "James": "Yakobo",
    "1Peter": "1 Peetero",
    "2Peter": "2 Peetero",
    "1John": "1 Yokaana",
    "2John": "2 Yokaana",
    "3John": "3 Yokaana",
    "Jude": "Yuda",
    "Revelation": "Okubikkulirwa"
},
    hi: {
      Genesis:'उत्पत्ति', Exodus:'निर्गमन', Leviticus:'लैव्यव्यवस्था', Numbers:'गिनती',
      Deuteronomy:'व्यवस्था विवरण', Joshua:'यहोशू', Judges:'न्यायियों', Ruth:'रूत',
      '1Samuel':'१ शमूएल', '2Samuel':'२ शमूएल', '1Kings':'१ राजा', '2Kings':'२ राजा',
      '1Chronicles':'१ इतिहास', '2Chronicles':'२ इतिहास', Ezra:'एज्रा', Nehemiah:'नहेम्याह',
      Esther:'एस्तेर', Job:'अय्यूब', Psalms:'भजन संहिता', Proverbs:'नीतिवचन',
      Ecclesiastes:'सभोपदेशक', SongofSongs:'श्रेष्ठगीत', Isaiah:'यशायाह', Jeremiah:'यिर्मयाह',
      Lamentations:'विलापगीत', Ezekiel:'यहेजकेल', Daniel:'दानिय्येल', Hosea:'होशे', Joel:'योएल',
      Amos:'आमोस', Obadiah:'ओबद्याह', Jonah:'योना', Micah:'मीका', Nahum:'नहूम',
      Habakkuk:'हबक्कूक', Zephaniah:'सपन्याह', Haggai:'हाग्गै', Zechariah:'जकर्याह', Malachi:'मलाकी',
      Matthew:'मत्ती', Mark:'मरकुस', Luke:'लूका', John:'यूहन्ना', Acts:'प्रेरितों के काम',
      Romans:'रोमियों', '1Corinthians':'१ कुरिन्थियों', '2Corinthians':'२ कुरिन्थियों',
      Galatians:'गलातियों', Ephesians:'इफिसियों', Philippians:'फिलिप्पियों', Colossians:'कुलुस्सियों',
      '1Thessalonians':'१ थिस्सलुनीकियों', '2Thessalonians':'२ थिस्सलुनीकियों',
      '1Timothy':'१ तीमुथियुस', '2Timothy':'२ तीमुथियुस', Titus:'तीतुस', Philemon:'फिलेमोन',
      Hebrews:'इब्रानियों', James:'याकूब', '1Peter':'१ पतरस', '2Peter':'२ पतरस',
      '1John':'१ यूहन्ना', '2John':'२ यूहन्ना', '3John':'३ यूहन्ना', Jude:'यहूदा',
      Revelation:'प्रकाशित वाक्य'
    }
  };
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function bookName(b) {
    var lang = window.ET && window.ET.i18n ? window.ET.i18n.current() : 'en';
    return (LOCAL_BOOKS[lang] && LOCAL_BOOKS[lang][b]) ||
      b.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^(\d)/, '$1 ');
  }
  function audioBibleUrl(play, testament, num, name, ch) {
    // A few filesets keep each testament in a numbered folder ("01 OT_NPIB08").
    var dir = (play.dirs && play.dirs[testament]) || testament + '_' + play.version;
    return 'https://dbs.org/cdn/audio/' + play.fileset + '/' + encodeURIComponent(dir) +
      '/' + pad(num) + '_' + name + '/' + pad(num) + '_' + name + '_' + pad(ch, 3) + '.mp3';
  }

  /* The step header every guided flow uses: numbered dots joined by a bar,
     ticked as they complete, and "Step 2 of 4" in words for anyone who does not
     read the dots. Same shape in Save and Nearby, so learning one teaches both. */
  function stepper(count, at) {
    var dots = [];
    for (var i = 0; i < count; i++) {
      var cls = i < at ? 'done' : i === at ? 'on' : '';
      dots.push('<span class="dot ' + cls + '">' + (i < at ? icon('check') : '<span class="num">' + (i + 1) + '</span>') + '</span>');
    }
    return '<div class="stepper" aria-hidden="true">' + dots.join('<span class="bar"></span>') + '</div>' +
      '<p class="step-of">' + (ET.i18n ? ET.i18n.h('save.of', { done: at + 1, total: count }) : '') + '</p>';
  }

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

  // Installing the offline shell downloads every page and screenshot. Start
  // only after the visible page has loaded, so it cannot delay its scripts.
  function scheduleSW() {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(registerSW, { timeout: 4000 });
    } else {
      window.setTimeout(registerSW, 1500);
    }
  }
  if ('serviceWorker' in navigator &&
      (location.protocol === 'http:' || location.protocol === 'https:')) {
    if (document.readyState === 'complete') scheduleSW();
    else window.addEventListener('load', scheduleSW, { once: true });
  }

  return {
    store: store, icon: icon, lantern: lantern, esc: esc, qs: qs, human: human,
    canInstall: canInstall, onInstallable: onInstallable,
    promptInstall: promptInstall, standalone: standalone,
    $: $, $$: $$, theme: theme, library: library, byId: byId, header: header,
    sheet: sheet, typeIcon: typeIcon, thumb: thumb, stepper: stepper,
    tabbar: tabbar, row: row, poster: poster, displayTitle: displayTitle,
    safeType: safeType, openable: openable, safeUrl: safeUrl,
    libraryScope: libraryScope, scopedUrl: scopedUrl, scopeEntryUrl: scopeEntryUrl,
    contentCode: contentCode, contentLang: contentLang, inMyLanguage: inMyLanguage,
    BOOKS: BOOKS, pad: pad, bookName: bookName, audioBibleUrl: audioBibleUrl
  };
})();
