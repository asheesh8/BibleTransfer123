/* ============================================================================
   ET shell: the furniture every screen shares.

   Depends on: core.js. Draws the header (logo, language and theme buttons),
   the tab bar, the "tap to change language" hint, the lantern logo and its
   animated Kandili slot, the icon set, the plain sheet, the step header, the
   copy-to-clipboard toast and the Facebook share link.

   These were part of core.js until the modular rebuild (docs/decisions/0002)
   and keep their old names (ET.header, ET.icon, ET.sheet, …), so no screen
   had to change when they moved. The design kit's ET.ui.sheet, ET.ui.toast
   and ET.ui.icon are their successors as screens move onto the kit.
   ========================================================================= */

window.ET.module('ui/shell', ['core'], function (ET) {
  'use strict';

  var store = ET.store, esc = ET.esc, $ = ET.$, $$ = ET.$$, theme = ET.theme;
  var libraryScope = ET.libraryScope, scopedUrl = ET.scopedUrl, scopeEntryUrl = ET.scopeEntryUrl;

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
    mail:    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
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
    home:    '<path d="M4 11l8-7 8 7"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/>',
    facebook: '<path d="M15.5 3.5H14a4 4 0 0 0-4 4V10H7.5v3.5H10v7h3.5v-7H16l.5-3.5h-3V8a1 1 0 0 1 1-1h2V3.5z"/>'
  };

  function icon(name, cls) {
    var d = P[name] || P.link;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
           'aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  }

  // The lantern is the app's mascot — نور, "light". Drawn rather than
  // generated so it is identical on every card and costs nothing to ship.
  // Where the design kit lives: beside this file, wherever the page is.
  var ASSETS = ((document.currentScript && document.currentScript.src) || '')
    .replace(/js\/ui\/shell\.js(\?.*)?$/, '');

  /* With a pose, the animated Kandili (ET.mascot, assets/js/brand/mascot.js,
     fetched after the page has painted): a slot of held size showing the
     still drawing until the script arrives, then mascots() brings it to
     life. Without one, the still drawing on its own, as the header logo,
     which should never bob. */
  function lantern(size, pose) {
    var s = size || 32;
    if (typeof pose === 'string') {
      return '<span class="et-kandili-slot" data-pose="' + esc(pose) + '" style="width:' + s +
        'px;height:' + Math.round(s * 340 / 320) + 'px">' + lanternSvg(s) + '</span>';
    }
    return lanternSvg(s);
  }

  // A pose on the page plays the moment it belongs to (hello waves, and so on).
  var MOMENT_OF = { hello: 'welcome', play: 'play', saved: 'saved', share: 'shared', hooray: 'milestone',
                    waiting: 'loading', offline: 'offline', thinking: 'notfound', sleeping: 'empty' };

  function mascots(root) {
    if (!ET.mascot) return;
    $$('.et-kandili-slot:not([data-k])', root || document).forEach(function (el) {
      el.setAttribute('data-k', '1');
      var pose = el.getAttribute('data-pose') || 'neutral';
      var k = ET.mascot.create(el, { pose: pose, size: el.style.width, tappable: true });
      if (MOMENT_OF[pose]) k.moment(MOMENT_OF[pose]);
    });
  }

  function loadMascot() {
    if (ET.mascot) { mascots(); return; }
    if (!ASSETS || $('#et-mascot-js')) return;
    ['css/tokens.css', 'css/components/mascot.css'].forEach(function (href) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = ASSETS + href;
      document.head.appendChild(l);
    });
    var sc = document.createElement('script');
    sc.id = 'et-mascot-js';
    sc.src = ASSETS + 'js/brand/mascot.js';
    sc.onload = function () { mascots(); };
    document.head.appendChild(sc);
  }

  function lanternSvg(s) {
    // Kandili: the flame on top is its mood, the face sits on the glass.
    return '<svg class="et-lantern" viewBox="-3 -9 54 54" width="' + s + '" height="' + s + '" aria-hidden="true">' +
      '<path d="M17 7c0-8 14-8 14 0" stroke="#B87D06" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path class="k-flame" d="M24-8c3.4 3.2 3.8 6.8 0 10c-3.8-3.2-3.4-6.8 0-10z" fill="#F5B52E"/>' +
      '<path d="M24-2.4c1.7 1.6 1.9 3.4 0 5c-1.9-1.6-1.7-3.4 0-5z" fill="#FFE7A3"/>' +
      '<path d="M18 6h12a2 2 0 0 1 0 4H18a2 2 0 0 1 0-4z" fill="#B87D06"/>' +
      '<path d="M14 12h20l3 22a5 5 0 0 1-5 5.6H16A5 5 0 0 1 11 34z" fill="#E8A317"/>' +
      '<path d="M17 15h14l2.2 17a3 3 0 0 1-3 3.4H17.8a3 3 0 0 1-3-3.4z" fill="#FDF3DC"/>' +
      '<g class="k-eyes"><ellipse cx="20.6" cy="23.6" rx="1.9" ry="2.4" fill="#4E1F64"/>' +
      '<ellipse cx="27.4" cy="23.6" rx="1.9" ry="2.4" fill="#4E1F64"/>' +
      '<circle cx="21.1" cy="22.8" r=".6" fill="#fff"/><circle cx="27.9" cy="22.8" r=".6" fill="#fff"/></g>' +
      '<circle cx="18.2" cy="28" r="1.3" fill="#F4A38C"/><circle cx="29.8" cy="28" r="1.3" fill="#F4A38C"/>' +
      '<path d="M21.8 28.4a3 3 0 0 0 4.4 0" stroke="#4E1F64" stroke-width="1.4" ' +
      'stroke-linecap="round" fill="none"/>' +
      '<path d="M12 41h24" stroke="#B87D06" stroke-width="3.4" stroke-linecap="round"/>' +
      '</svg>';
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
    document.body.classList.add('has-top');   // releases the space app.css held for it

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

  // ------------------------------------------------------- facebook share
  /* Facebook's share dialog takes only a link and reads the title, words and
     picture from that page's og: tags (each language page has its own card).
     It won't accept ready-made post words, so those go on the clipboard and a
     short note says to paste them. Call from the click, before the link opens. */
  function facebookUrl(url) {
    // hashtag is the only extra Facebook still pre-fills (the person can remove
    // it); prefilled post words and quote= are against Facebook's platform policy.
    return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&hashtag=' + encodeURIComponent('#Bible');
  }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
  }
  var toastTimer;
  function toast(html) {
    var el = document.getElementById('et-toast');
    if (!el) {
      el = document.createElement('p');
      el.id = 'et-toast'; el.className = 'et-toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.innerHTML = icon('check') + '<span>' + html + '</span>';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 9000);
  }
  function facebookShare(a, url, words) {
    a.href = facebookUrl(url);
    copyText(words, function () { toast(window.ET.i18n.h('fbshare.copied')); });
  }


  var api = {
    icon: icon, lantern: lantern, mascots: mascots, loadMascot: loadMascot,
    header: header, tabbar: tabbar, sheet: sheet, stepper: stepper,
    facebookUrl: facebookUrl, facebookShare: facebookShare, copyText: copyText, toast: toast
  };
  for (var k in api) ET[k] = api[k];
  return api;
});
