/* Library switches: what the library shows, decided once for everyone.

   The catalogues keep every item. This file decides which ones appear, so
   nothing is ever deleted and anything can be switched back on:

   1. Built-in defaults (below): films and audio Bibles all on; Scripture text
      cut to five translations in English and one classic Bible elsewhere; old scans, audio
      collections, books and partner links off (books stay on in English).
   2. The admin's switches (/admin/library), served by /api/visibility as
      window.ET_VISIBILITY_LIVE. A whole kind can be switched per language,
      and any single item on or off.

   Off a card (file://) or offline, /api/visibility cannot load; the copy this
   browser last saw is used, else the defaults. Loaded after the catalogue
   and before core.js, so every page already sees the filtered list. The admin
   page reuses ET_VISIBILITY.resolve to draw its switches. */
(function () {
  'use strict';

  var TYPE_DEFAULTS = {
    'film': true,
    'audio-bible': true,
    'scripture': true,
    'audio': false,
    'historic': false,
    'book': false,
    'link': false
  };

  // Kinds switched on in one language only. English has no DBS books; its one
  // book is the Bible Study Tool Box workbook the Library hosts itself.
  // Marachi has nothing but its Global Recordings programmes, so they show.
  var LANG_TYPE_DEFAULTS = {
    eng: { 'book': true },
    lri: { 'audio': true }
  };

  // English keeps five translations; every other language keeps one, its
  // classic Bible (the local equivalent of the King James Version). Where that
  // classic only opens online, a full Bible the app can read is preferred.
  var SCRIPTURE_LIMIT = 1;

  var TOP_SCRIPTURE = {
    eng: [
      'eng-text-engkjv',                                        // King James Version
      'eng-text-engweb',                                        // World English Bible
      'eng-scripture-dbs-new-american-standard-bible-898f5117d', // NASB
      'eng-scripture-dbs-new-english-translation-net-0838050dd', // NET
      'eng-text-engbsb'                                         // Berean Standard Bible
    ],
    aka: ['aka-text-akaocb'],                                    // Nkwa Asɛm
    amh: ['amh-text-amhubs'],                                    // 1962 Bible Society of Ethiopia
    ara: ['ara-text-arbvdv'],                                    // Van Dyck
    cmn: ['cmn-text-chinese-union-version-simplified-1919'],     // Chinese Union Version
    fra: ['fra-text-fralsg'],                                    // Louis Segond 1910
    hat: ['hat-text-hatabs'],                                    // Sent Bib 1985, Haitian Bible Society
    hau: ['hau-text-haudor'],                                    // Littafi Mai Tsarki
    hin: ['hin-text-hinold'],                                    // Hindi Old Version
    ibo: ['ibo-publisher-iboilb'],                               // Igbo Union Version
    kik: ['kik-text-kikokhw'],
    lin: ['lin-text-linocb'],
    lug: ['lug-scripture-dbs-open-luganda-contemporary-bible-4747d668e'],
    luo: ['luo-text-luoont'],
    mar: ['mar-text-maromb'],                                    // Revised Marathi Bible
    mlg: ['mlg-text-mlgdpv'],                                    // Malagasy Protestant 1965
    npi: ['npi-scripture-dbs-nepali-bible-e1ad858a3'],           // Nepali Bible
    nya: ['nya-text-nyaogw'],
    orm: ['orm-text-gazbib'],                                    // Oromo Contemporary Version
    pan: ['pan-text-panovv'],
    pcm: ['pcm-text-pcmwbt'],
    pnb: ['pnb-text-pnbpov'],                                    // Pavitra Bible 1945
    por: ['por-edition-porarc'],                                 // Almeida Revista e Corrigida
    run: ['run-text-runbsb'],
    sna: ['sna-text-snaibs'],
    spa: ['spa-text-sparv09'],                                   // Reina-Valera 1909
    swh: ['swh-text-swhulb'],
    tir: ['tir-text-tirtbi'],
    urd: ['urd-text-urdpnt'],                                    // Kitáb i Muqaddas
    yor: ['yor-text-yorycb'],
    yue: ['yue-text-studium-biblicum-version-1999'],
    zul: ['zul-text-online']
  };

  var STORE_KEY = 'et.visibility';

  function own(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k); }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache(state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* defaults are enough */ }
  }

  function validState(s) {
    return !!s && typeof s === 'object' && s.v === 1;
  }

  /* Admin overrides currently in force: the live copy when the server answered,
     else the last one this browser saw. */
  function current() {
    var live = window.ET_VISIBILITY_LIVE;
    if (validState(live)) { writeCache(live); return live; }
    if (live === null) { writeCache(null); return null; }   // server: no overrides
    var cached = readCache();
    return validState(cached) ? cached : null;
  }

  function typeDefault(lang, type) {
    if (own(LANG_TYPE_DEFAULTS[lang], type)) return LANG_TYPE_DEFAULTS[lang][type];
    return own(TYPE_DEFAULTS, type) ? TYPE_DEFAULTS[type] : true;
  }

  function typeOn(lang, type, state) {
    var t = state && state.types && state.types[lang];
    if (own(t, type)) return t[type] === true;
    return typeDefault(lang, type);
  }

  /* Default for one item, before any per-item switch. */
  function itemDefault(r, firstScripture) {
    if (r.type !== 'scripture') return true;
    if (own(TOP_SCRIPTURE, r.lang)) return TOP_SCRIPTURE[r.lang].indexOf(r.id) !== -1;
    return !firstScripture || firstScripture[r.id] === true;
  }

  // A language not in TOP_SCRIPTURE keeps its first Scripture text.
  function firstScriptureIds(resources) {
    var seen = {}, first = {};
    for (var i = 0; i < resources.length; i++) {
      var r = resources[i];
      if (r.type !== 'scripture' || own(TOP_SCRIPTURE, r.lang)) continue;
      seen[r.lang] = (seen[r.lang] || 0) + 1;
      if (seen[r.lang] <= SCRIPTURE_LIMIT) first[r.id] = true;
    }
    return first;
  }

  /* Every resource with its switches worked out: {r, typeOn, itemOn, itemDefault, visible}. */
  function resolve(resources, state) {
    var first = firstScriptureIds(resources);
    return resources.map(function (r) {
      var def = itemDefault(r, first);
      var item = state && state.items && own(state.items, r.id) ? state.items[r.id] === true : def;
      var kind = typeOn(r.lang, r.type, state);
      return { r: r, typeOn: kind, itemOn: item, itemDefault: def, visible: kind && item };
    });
  }

  function apply(lib, state) {
    if (!lib || !Array.isArray(lib.resources)) return;
    lib.allResources = lib.resources;
    lib.resources = resolve(lib.resources, state)
      .filter(function (x) { return x.visible; })
      .map(function (x) { return x.r; });
    if (lib.counts) lib.counts.total = lib.resources.length;
  }

  window.ET_VISIBILITY = {
    TYPE_DEFAULTS: TYPE_DEFAULTS,
    TOP_SCRIPTURE: TOP_SCRIPTURE,
    typeDefault: typeDefault,
    typeOn: typeOn,
    resolve: resolve,
    current: current
  };

  if (!window.ET_VISIBILITY_ADMIN) apply(window.LIBRARY, current());
})();
