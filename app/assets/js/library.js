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
    partner: ET.qs('partner') || '',
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

  /* Partner libraries: whole collections that reach us from one partner.
     Nearly everything here comes through the Digital Bible Society's library
     (dbs.org), including the films, recordings and Bibles of the ministries
     DBS gathers, so DBS gets the first and biggest section. Partners who give
     us files directly get a section of their own. Partners still being invited are shown only in
     the partner preview (?demo=partners), never to the public: their shelves
     come from features/partner-preview.js, fetched only in that mode. */
  var DBS = { id: 'dbs', name: 'Digital Bible Society', mark: 'DBS', tone: 'sky', url: 'https://dbs.org',
              logo: 'assets/partners/dbs.webp' };
  var WAKING = { id: 'wakingword', name: 'Waking Word Inc.', mark: 'WW', tone: 'green',
                 kicker: 'Craft Stick Bible Stories', url: 'https://wakingword.org' };
  // Files VillageServer hosts itself (app/assets/library), such as a study
  // workbook an author gave us.
  var OURS = { id: 'villageserver', name: 'VillageServer', mark: 'VS', tone: 'plain',
               url: 'https://villageservers.org' };
  var LIVE = [DBS, WAKING, OURS];

  function partnerOf(r) {
    if (/^Waking Word/.test(r.org || '')) return 'wakingword';
    var host = String(r.source || '').replace(/^https?:\/\/([^\/]+).*$/, '$1');
    if (/(^|\.)bibletransfer123\.org$/.test(host)) return 'villageserver';
    return 'dbs';
  }
  function emptyCounts() {
    var n = {};
    LIVE.forEach(function (p) { n[p.id] = 0; });
    return n;
  }

  // The partner preview stays on for this phone until ?demo=off.
  var demoAsk = ET.qs('demo');
  if (demoAsk) ET.store.set('et.demo', demoAsk === 'partners' ? 'partners' : '');
  var demoOn = ET.store.get('et.demo', '') === 'partners';
  var preview = [];   // filled by features/partner-preview.js in demo mode

  function partners() { return [DBS, WAKING].concat(preview, [OURS]); }
  function partnerById(id) {
    return partners().filter(function (p) { return p.id === id; })[0];
  }
  function partnerName(p) { return p.name; }
  // The partner's own logo where we have it, else its initials.
  function partnerMark(p) {
    return '<span class="partner-mark' + (p.logo ? ' partner-mark--logo' : '') + '" aria-hidden="true">' +
      (p.logo ? '<img src="' + ET.esc(p.logo) + '" alt="" width="96" height="96" decoding="async">' : ET.esc(p.mark)) +
      '</span>';
  }

  // A partner's empty shelf shows while browsing, not in search results.
  function shelfShown() { return !state.q && !state.from; }

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
    if (state.partner && partnerOf(r) !== state.partner) return false;
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
    if (state.partner) p.push('partner=' + encodeURIComponent(state.partner));
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
    partnerTiles(counted);

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

  /* The partner row: one big tile per library, DBS first. Each counts what it
     holds in the language and kind being browsed; a tap shows only that shelf. */
  function partnerTiles(counted) {
    var box = ET.$('#partner-tiles');
    if (!box) return;
    if (state.type) counted = counted.filter(function (r) { return r.type === state.type; });
    var n = emptyCounts();
    counted.forEach(function (r) { n[partnerOf(r)]++; });
    // A preview shelf named in the link waits for the preview to arrive.
    if (state.partner && !partnerById(state.partner) && !(demoOn && !preview.length)) state.partner = '';
    var list = partners().filter(function (p) { return p.preview || n[p.id]; });
    // With nothing but DBS there is nothing to choose between.
    box.hidden = list.length < 2;
    ET.$('#partner-label').hidden = box.hidden;
    if (box.hidden) return;
    var scroll = box.scrollLeft;
    box.innerHTML = list.map(function (p) {
      var soon = !!p.preview;
      return '<button class="fchip partner-tile partner-tile--' + p.tone + '" data-partner="' + p.id +
        '" aria-pressed="' + (state.partner === p.id) + '">' +
        partnerMark(p) +
        '<span class="partner-name" dir="auto">' + ET.esc(partnerName(p)) + '</span>' +
        '<span class="partner-n">' + (soon ? '<span lang="en">Empty, help us fill it</span>' : h('lib.countall', { n: n[p.id] })) +
        '</span></button>';
    }).join('');
    box.scrollLeft = scroll;
    ET.$$('#partner-tiles [data-partner]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-partner');
        state.partner = state.partner === id ? '' : id;
        render();
      });
    });
  }

  // The branded band that opens a partner's section of the list.
  function partnerHead(p, count) {
    var soon = !!p.preview;
    return '<header class="partner-head partner-head--' + p.tone + '">' +
      partnerMark(p) +
      '<span class="partner-head__text">' +
        (soon ? '<span class="partner-soon" lang="en">Empty shelf · waiting for you</span>'
              : p.id === 'dbs' ? '<span class="partner-soon">' + h('lib.partner.main') + '</span>'
              : p.kicker ? '<span class="partner-soon" lang="en">' + ET.esc(p.kicker) + '</span>' : '') +
        '<h2 dir="auto">' + ET.esc(partnerName(p)) + '</h2>' +
        (soon ? '<span class="partner-tag" lang="en">' + ET.esc(p.tagline) + '</span>'
              : '<span class="partner-tag">' + h('lib.countall', { n: count }) +
                (p.url ? ' · <a href="' + ET.esc(p.url) + '" target="_blank" rel="noopener">' +
                  ET.esc(p.url.replace(/^https?:\/\//, '')) + '</a>' : '') + '</span>') +
      '</span></header>';
  }

  /* Where a partner's library will go: an empty, dashed shelf that says so
     and asks for help filling it, with a button to how it would travel. */
  function emptyShelf(p) {
    return '<div class="partner-empty" lang="en" dir="ltr">' +
      '<p class="partner-empty__title">This shelf is empty, for now.</p>' +
      '<p class="partner-empty__text">It is waiting for ' + ET.esc(p.name) + '. ' + ET.esc(p.tagline) +
        ' would sit right here, and we would love your help to fill it. Everything placed here plays, saves and passes from phone to phone, ' +
        'in every language this library carries.</p>' +
      '<button type="button" class="et-btn et-btn--quiet partner-empty__go" data-shelf="' + p.id + '">' +
        'See how it would be shared</button></div>';
  }

  /* The list, in sections: DBS, then each partner in the preview, then every
     other library. Readers get every item, in order, as before. In the
     partner preview each section shows its first few and a button for the
     rest, so every partner is in view on one screen; choosing a partner, or
     searching, shows the whole of it. */
  var SHELF = 6;
  function sections(hits) {
    var by = {};
    LIVE.forEach(function (p) { by[p.id] = []; });
    hits.forEach(function (r) { by[partnerOf(r)].push(r); });
    var list = partners().filter(function (p) {
      if (state.partner && state.partner !== p.id) return false;
      return p.preview ? shelfShown() : by[p.id].length > 0;
    });
    var cap = demoOn && !state.partner && !state.q && list.length > 1;
    return list.map(function (p) {
      if (p.preview) return '<section class="partner-section">' + partnerHead(p) + emptyShelf(p) + '</section>';
      var items = by[p.id], more = cap && items.length > SHELF;
      return '<section class="partner-section">' + partnerHead(p, items.length) +
        (more ? items.slice(0, SHELF) : items).map(card).join('') +
        (more ? '<button type="button" class="et-btn et-btn--quiet et-btn--block partner-more" data-partner-more="' + p.id + '">' +
          h('lib.partner.all', { n: items.length }) + '</button>' : '') +
        '</section>';
    }).join('');
  }

  function shelvesShown() {
    return preview.some(function (p) {
      return (!state.partner || state.partner === p.id) && shelfShown();
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
        ? '<button class="et-btn et-btn--quiet et-btn--block bulk-start" id="bulk-start">' + ET.icon('save') +
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
    ET.$('#results').innerHTML = state.bulk ? hits.map(selectCard).join('') : sections(hits);
    ET.$$('#results [data-partner-more]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.partner = b.getAttribute('data-partner-more');
        render();
        var top = ET.$('#partner-tiles');
        if (top && top.scrollIntoView) top.scrollIntoView({ block: 'start' });
      });
    });
    if (!state.bulk && preview.length) {
      ET.$$('#results [data-shelf]').forEach(function (b) {
        b.addEventListener('click', function () {
          ET.partnerPreview.open(partnerById(b.getAttribute('data-shelf')),
            hits.filter(function (r) { return partnerOf(r) === 'dbs'; })[0]);
        });
      });
    }
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
    var onPreview = state.partner && !hits.length && shelvesShown();
    ET.$('#count').innerHTML = onPreview ? '<span lang="en">An empty shelf, ready for this partner\'s library</span>'
      : hits.length === total
      ? h('lib.countall', { n: total })
      : h('lib.count', { n: hits.length, total: total });
    var any = hits.length > 0 || (!state.bulk && shelvesShown());
    ET.$('#empty').hidden = any;
    ET.$('#results').hidden = !any;
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

  // The partner row sits above the kinds, on the library and on language pages.
  if (!ET.$('#partner-tiles')) {
    var kindLabel = ET.$('#type-filters').previousElementSibling;
    (kindLabel && kindLabel.classList.contains('flabel') ? kindLabel : ET.$('#type-filters')).insertAdjacentHTML('beforebegin',
      '<p class="flabel library-partner" id="partner-label" data-i18n="lib.partner" hidden>Libraries</p>' +
      '<div class="filters partner-tiles" id="partner-tiles" role="group" data-i18n-aria="lib.partner" aria-label="Libraries" hidden></div>');
  }

  if (demoOn) {
    var pv = document.createElement('script');
    pv.src = 'assets/js/features/partner-preview.js';
    pv.onload = function () {
      if (!ET.partnerPreview) return;
      preview = ET.partnerPreview.partners;
      ET.partnerPreview.banner();
      render();
    };
    document.head.appendChild(pv);
  }

  var q = ET.$('#q');
  q.value = state.q;
  var timer;
  q.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = q.value.trim(); render(); }, 140);
  });
  ET.$('#reset').addEventListener('click', function () {
    state.q = ''; state.type = ''; state.from = ''; state.partner = ''; state.lang = lockedLang || ''; q.value = ''; render();
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
