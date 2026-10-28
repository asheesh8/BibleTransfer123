/* The library browser: search, two rows of filters, a grid of cards.

   Filter state lives in the URL, so a chosen shelf can be linked to from home,
   survives a reload, and comes back with the browser's own Back button — which
   on a phone is the button people actually use. */
window.ET.module('library', ['core', 'ui/shell', 'ui/covers', 'i18n', 'save'], function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;
  var lib = ET.library();
  var scope = ET.libraryScope();
  var lockedLang = scope && scope.lang;

  // A link that names a language (or asks for all with lang=all) wins;
  // otherwise the shelf opens on the language this person chose.
  var urlLang = ET.qs('lang');
  var state = {
    q: ET.qs('q') || '',
    type: ET.qs('type') || '',
    lang: lockedLang || (urlLang === 'all' ? '' : (urlLang || ET.contentLang())),
    from: ET.qs('from') || '',
    bulk: false
  };
  var selected = {};

  var TYPES = ['film', 'scripture', 'audio-bible', 'audio', 'historic', 'book', 'link'];

  /* Where an item comes from: the partner library or publisher in its credit.
     DBS pages spell some partners more than one way, so those share one chip,
     and the Digital Bible Society's archive scans sit with the rest of DBS. */
  var SOURCE_ALIASES = {
    'Digital Bible Society Archive': 'Digital Bible Society',
    'Visual Bible Int.': 'Visual Bible International',
    'Davar Partners': 'Davar Partners International',
    'Story Runners': 'StoryRunners',
    "Prophets' Story": "Prophet's Story",
    'The Story of Jesus': 'Story of Jesus',
    'Creation to Christ Stories': 'Creation to Christ'
  };

  // A joint credit ("Audio Scripture Ministries · Faith Comes By Hearing")
  // belongs under both partners.
  function sources(r) {
    return String(r.org || '').split(' · ').map(function (s) {
      s = s.trim();
      return SOURCE_ALIASES[s] || s;
    }).filter(Boolean);
  }

  // Every source in the language being browsed, the biggest shelves first.
  function presentSources(list) {
    var n = {};
    list.forEach(function (r) {
      sources(r).forEach(function (s) { n[s] = (n[s] || 0) + 1; });
    });
    return Object.keys(n).sort(function (a, b) {
      return n[b] - n[a] || a.localeCompare(b);
    }).map(function (s) { return { name: s, n: n[s] }; });
  }

  function present(list) {
    var seen = {};
    list.forEach(function (r) { seen[r.type] = true; });
    return TYPES.filter(function (x) { return seen[x]; });
  }

  function matches(r) {
    if (lockedLang && r.lang !== lockedLang) return false;
    if (state.type && r.type !== state.type) return false;
    if (state.lang && r.lang !== state.lang) return false;
    if (state.from && sources(r).indexOf(state.from) < 0) return false;
    if (state.q) {
      var hay = [r.title, r.native, r.org, r.desc, r.langName, r.typeLabel]
        .join(' ').toLowerCase();
      // Every word must appear somewhere, in any order — "urdu john" finds the
      // Urdu Gospel of John without the searcher guessing the catalogue's wording.
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        if (hay.indexOf(words[i]) === -1) return false;
      }
    }
    return true;
  }

  /* Every resource is the same row everywhere in the app: artwork, what kind
     of thing it is, its name, and one pill saying what a tap does. */
  function details(r) {
    var kicker = t('type.' + r.type);
    var verb = r.play ? t('act.watch') : r.read ? t('act.read') : t('act.open');
    var tone = r.play ? 'watch' : r.read ? 'read' : '';
    if (r.type === 'audio' || r.type === 'audio-bible') { verb = t('act.listen'); tone = 'listen'; }
    if (!r.play && !r.read && !hasFiles(r)) {
      verb = r.cardOnly ? t('act.oncard') : t('act.visit'); tone = '';
    }
    var bits = [r.langName, r.duration || r.stats, r.org].filter(Boolean);
    return {
      kicker: kicker + (r.offline ? ' · ' + t('item.offline') : ''),
      sub: bits.join(' · '),
      verb: verb,
      tone: tone
    };
  }

  function card(r) { return ET.row(r, details(r)); }

  // A language page loads its shelf catalogue (catalog-xxx-shelf.js), which
  // says these up front instead of carrying every file and chapter link.
  function hasFiles(r) { return r.hasFiles != null ? r.hasFiles : !!(r.files || []).length; }
  function canSave(r) {
    if (r.canSave != null) return r.canSave;
    return (r.files || []).some(function (f) { return f.file || f.chapters; });
  }

  /* Bulk save needs the download lists the shelf left out: fetch this
     language's full catalogue once, when someone actually asks for it. */
  var full = null;
  function withFullRecords(picked, done) {
    if (!lib.shelf || !lockedLang) return done(picked);
    function pick() { done(picked.map(function (r) { return full[r.id] || r; })); }
    if (full) return pick();
    var shelf = window.LIBRARY, s = document.createElement('script');
    s.src = 'data/catalog-' + lockedLang + '.js';
    s.onload = function () {
      full = {};
      ((window.LIBRARY || {}).resources || []).forEach(function (r) { full[r.id] = r; });
      window.LIBRARY = shelf;
      pick();
    };
    s.onerror = function () {
      window.LIBRARY = shelf;
      if (ET.ui && ET.ui.toast) ET.ui.toast.show({ text: t('ui.needsnet'), tone: 'danger' });
      else window.alert(t('ui.needsnet'));
    };
    document.head.appendChild(s);
  }

  function selectCard(r) {
    var d = details(r), art = r.cover || r.coverOnline, on = !!selected[r.id];
    return '<button type="button" class="rowi bulk-row" role="checkbox" aria-checked="' + on +
      '" data-bulk-id="' + ET.esc(r.id) + '">' +
      '<span class="art">' + ET.icon(ET.typeIcon(r.type)) +
        (art ? '<img src="' + ET.esc(art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '') +
      '</span><span class="meta">' +
        '<span class="kicker">' + h('type.' + r.type) +
          (r.offline ? ' · ' + h('item.offline') : '') + '</span>' +
        '<span class="name" dir="auto">' + ET.esc(ET.displayTitle(r)) + '</span>' +
        '<span class="sub latin">' + ET.esc(d.sub) + '</span>' +
      '</span><span class="bulk-check">' + ET.icon('check') + '</span></button>';
  }

  function syncUrl() {
    var p = [];
    // Keep the incoming link reference while updating filters. Consent may be
    // chosen later; deleting it here would make a shared arrival look direct.
    // Preserving a URL never enables analytics or stores a visitor identity.
    var shareRef = ET.qs('et_share'), shareChannel = ET.qs('et_channel');
    if (/^[A-Za-z0-9_-]{8,80}$/.test(shareRef)) {
      p.push('et_share=' + encodeURIComponent(shareRef));
      if (/^[a-z_]{1,32}$/.test(shareChannel)) p.push('et_channel=' + encodeURIComponent(shareChannel));
    }
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.type) p.push('type=' + state.type);
    if (state.from) p.push('from=' + encodeURIComponent(state.from));
    if (!lockedLang) p.push('lang=' + (state.lang || 'all'));
    var url = location.pathname + (p.length ? '?' + p.join('&') : '');
    // Some browsers refuse replaceState on a file:// origin. Keeping the URL in
    // step with the filters is a convenience; it is not worth a broken page.
    try { history.replaceState(null, '', url); } catch (e) {}
  }

  function chips() {
    var inScope = lockedLang ? lib.resources.filter(function (r) { return r.lang === lockedLang; })
                             : lib.resources;
    var avail = present(inScope);
    var typeFilters = ET.$('#type-filters');
    var typeScroll = typeFilters.scrollLeft;
    /* The kinds are picture tiles, not a row of words: an icon in its own
       colour, the word, and how many there are. Someone who cannot read the
       word still finds the films by the film picture. */
    var counted = inScope.filter(function (r) { return !state.lang || r.lang === state.lang; });
    var count = {};
    counted.forEach(function (r) { count[r.type] = (count[r.type] || 0) + 1; });
    function tile(ty, label, icon, n) {
      return '<button class="fchip kind-tile" data-type="' + ty + '" data-kind="' + (ty || 'all') +
        '" aria-pressed="' + (state.type === ty) + '">' +
        '<span class="kind-ico">' + ET.icon(icon) + '</span>' +
        '<span class="kind-name">' + label + '</span>' +
        '<span class="kind-n">' + n + '</span></button>';
    }
    typeFilters.innerHTML = [tile('', h('lib.all'), 'grid', counted.length)].concat(
      avail.map(function (ty) {
        return tile(ty, h('type.' + ty), ty === 'audio-bible' ? 'ears' : ty === 'book' ? 'book' : ET.typeIcon(ty), count[ty] || 0);
      })).join('');
    typeFilters.scrollLeft = typeScroll;
    if (!typeFilters.dataset.ready && state.type) {
      var activeType = typeFilters.querySelector('[aria-pressed="true"]');
      if (activeType) typeFilters.scrollLeft = activeType.offsetLeft - typeFilters.offsetLeft - 8;
    }
    typeFilters.dataset.ready = '1';
    ET.$$('#type-filters [data-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.type = b.getAttribute('data-type'); render();
      });
    });

    sourceChips();

    var langFilters = ET.$('#lang-filters');
    if (!langFilters || lockedLang) return;
    var currentLang = ET.$('#lang-filter-current');
    var currentLabel = state.lang && lib.languages[state.lang];
    currentLang.innerHTML = currentLabel ? ET.esc(currentLabel.native || currentLabel.name) : h('lib.all');

    // A to Z by English name, like the interface language picker, so a
    // reader can find their language without knowing how the list was built.
    var langs = Object.keys(lib.languages).sort(function (a, b) {
      return lib.languages[a].name.localeCompare(lib.languages[b].name, 'en');
    });
    langFilters.innerHTML =
      ['<button class="et-chip" data-lang="" aria-pressed="' + (!state.lang) + '">' +
        h('lib.all') + '</button>'].concat(
        langs.map(function (code) {
          var L = lib.languages[code];
          // English's "native" name is just English — printing both said it twice.
          var same = (L.native || '') === L.name;
          return '<button class="et-chip" data-lang="' + code + '" aria-pressed="' +
            (state.lang === code) + '">' +
            (same ? '<span class="latin">' + ET.esc(L.name) + '</span>'
                  : '<span dir="auto">' + ET.esc(L.native) + '</span> <span class="latin">' +
                    ET.esc(L.name) + '</span>') + '</button>';
        })).join('');

    ET.$$('#lang-filters [data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lang = b.getAttribute('data-lang');
        state.bulk = false; selected = {};
        ET.$('#lang-disclosure').open = false;
        render();
      });
    });
  }

  function sourceChips() {
    var box = ET.$('#source-disclosure');
    var scopeLang = lockedLang || state.lang;
    var avail = presentSources(lib.resources.filter(function (r) {
      return !scopeLang || r.lang === scopeLang;
    }));
    // A source missing from this language (after switching language, or from
    // an old link) would leave an empty shelf with no chip to undo it.
    var known = avail.some(function (s) { return s.name === state.from; });
    if (state.from && !known) state.from = '';
    // One source is nothing to choose between.
    box.hidden = avail.length < 2;
    if (box.hidden) return;

    ET.$('#source-filter-current').innerHTML = state.from ? ET.esc(state.from) : h('lib.all');
    var list = ET.$('#source-filters');
    list.innerHTML =
      ['<button class="et-chip" data-from="" aria-pressed="' + (!state.from) + '">' +
        h('lib.all') + '</button>'].concat(
        avail.map(function (s) {
          return '<button class="et-chip" data-from="' + ET.esc(s.name) + '" aria-pressed="' +
            (state.from === s.name) + '"><span dir="auto">' + ET.esc(s.name) +
            '</span> <span class="fcount">' + s.n + '</span></button>';
        })).join('');
    ET.$$('#source-filters [data-from]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.from = b.getAttribute('data-from');
        box.open = false;
        render();
      });
    });
  }

  function selectedResources() {
    return lib.resources.filter(function (r) { return selected[r.id] && canSave(r); });
  }

  function bulkControls(visible) {
    var controls = ET.$('#bulk-controls'), dock = ET.$('#bulk-dock');
    var actions = ET.$('#library-actions');
    var downloadable = visible.filter(canSave);
    if (!state.bulk) {
      document.body.classList.remove('bulk-mode');
      dock.hidden = true;
      controls.innerHTML = state.lang && downloadable.length
        ? '<button class="et-btn et-btn--go et-btn--block bulk-start" id="bulk-start">' + ET.icon('save') +
          ET.i18n.h('lib.bulk.start') + '</button>' : '';
      var start = ET.$('#bulk-start');
      if (actions) actions.classList.toggle('has-bulk', !!start);
      if (start) start.addEventListener('click', function () {
        state.bulk = true; selected = {}; render();
      });
      return;
    }

    var n = selectedResources().length;
    if (actions) actions.classList.remove('has-bulk');
    controls.innerHTML = '<div class="bulk-tools"><strong>' +
      ET.i18n.h('lib.bulk.selected', { n: n }) + '</strong><div class="btn-row">' +
      '<button class="et-btn et-btn--quiet" id="bulk-all">' + ET.i18n.h('lib.bulk.selectall') + '</button>' +
      '<button class="et-btn et-btn--quiet" id="bulk-cancel">' + ET.i18n.h('lib.bulk.cancel') +
      '</button></div></div>';
    dock.hidden = false;
    dock.innerHTML = '<button class="et-btn et-btn--go et-btn--lg et-btn--block" id="bulk-download"' +
      (n ? '' : ' disabled') + '>' + ET.icon('save') +
      ET.i18n.h('lib.bulk.download', { n: n }) + '</button>';
    document.body.classList.add('bulk-mode');

    ET.$('#bulk-all').addEventListener('click', function () {
      downloadable.forEach(function (r) { selected[r.id] = true; });
      render();
    });
    ET.$('#bulk-cancel').addEventListener('click', function () {
      state.bulk = false; selected = {}; render();
    });
    ET.$('#bulk-download').addEventListener('click', function () {
      var picked = selectedResources();
      if (picked.length) withFullRecords(picked, ET.save.openMany);
    });
  }

  function render() {
    chips();
    var visible = lib.resources.filter(matches);
    var hits = state.bulk ? visible.filter(canSave) : visible;
    ET.$('#results').innerHTML = hits.map(state.bulk ? selectCard : card).join('');
    if (state.bulk) {
      ET.$$('#results [data-bulk-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-bulk-id');
          if (selected[id]) delete selected[id]; else selected[id] = true;
          render();
        });
      });
    }
    bulkControls(visible);
    // Count against the language being browsed, not the whole library: with
    // English chosen, "268 of 676" read as if 408 English items were hidden.
    var scopeLang = lockedLang || state.lang;
    var total = scopeLang ? lib.resources.filter(function (r) { return r.lang === scopeLang; }).length
                          : lib.resources.length;
    ET.$('#count').innerHTML = hits.length === total
      ? h('lib.countall', { n: total })
      : h('lib.count', { n: hits.length, total: total });
    ET.$('#empty').hidden = hits.length > 0;
    ET.$('#results').hidden = hits.length === 0;
    syncUrl();
  }

  ET.header('library');
  ET.tabbar('library.html');
  ET.$('#search-ico').innerHTML = ET.icon('search');
  var shareIcon = ET.$('#share-language-ico');
  if (shareIcon) shareIcon.innerHTML = ET.icon('share');
  var saveGuide = ET.$('#library-save-guide');
  // Language landing pages use this script too, with a smaller HTML shell.
  if (!saveGuide && ET.$('#bulk-controls')) {
    ET.$('#bulk-controls').insertAdjacentHTML('afterend',
      '<a class="save-guide-entry" id="library-save-guide" href="save-guide.html#step-12" lang="en" dir="ltr">' +
      '<span id="save-guide-ico"></span><span>Saving on Mac or Windows? See the screenshot guide <small>(English)</small></span></a>');
    saveGuide = ET.$('#library-save-guide');
  }
  if (saveGuide) saveGuide.href = ET.scopedUrl('save-guide.html') + '#step-12';
  var saveGuideIcon = ET.$('#save-guide-ico');
  if (saveGuideIcon) saveGuideIcon.innerHTML = ET.icon('laptop');
  ET.$('#empty-art').innerHTML = ET.art.empty();
  // Language landing pages share this script with a smaller HTML shell.
  if (!ET.$('#source-disclosure')) {
    ET.$('#type-filters').insertAdjacentHTML('afterend',
      '<details class="library-language library-source" id="source-disclosure" hidden>' +
      '<summary><span data-i18n="lib.source">From</span><strong id="source-filter-current" dir="auto"></strong></summary>' +
      '<div class="filters" id="source-filters" role="group" data-i18n-aria="lib.source" aria-label="From"></div>' +
      '</details>');
  }

  var q = ET.$('#q');
  q.value = state.q;
  var timer;
  q.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = q.value.trim(); render(); }, 140);
  });
  ET.$('#reset').addEventListener('click', function () {
    state.q = ''; state.type = ''; state.from = ''; state.lang = lockedLang || ''; q.value = ''; render();
  });

  render();
  ET.i18n.apply();
  // apply() invokes every listener, so a listener must never call apply() back.
  // render() only rewrites the dynamic regions; apply() handles [data-i18n].
  // Switching the interface language switches the shelf with it.
  ET.i18n.onChange(function () {
    state.lang = lockedLang || ET.contentLang();
    state.bulk = false;
    selected = {};
    render();
  });
});
