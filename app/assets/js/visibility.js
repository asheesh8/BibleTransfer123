/* Library switches: what the library shows, decided once for everyone.

   The catalogues keep every item. This file decides which ones appear, so
   nothing is ever deleted and anything can be switched back on:

   1. Built-in defaults (below): films and audio Bibles all on; Scripture text
      cut to the five best-known translations per language; old scans, audio
      collections, books and partner links off.
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

  var SCRIPTURE_LIMIT = 5;

  // Languages with more than five Scripture texts. Chosen for how widely each
  // translation is known and read; every other language keeps all of its own.
  var TOP_SCRIPTURE = {
    eng: [
      'eng-text-engkjv',                                        // King James Version
      'eng-text-engweb',                                        // World English Bible
      'eng-scripture-dbs-new-american-standard-bible-898f5117d', // NASB
      'eng-scripture-dbs-new-english-translation-net-0838050dd', // NET
      'eng-text-engbsb'                                         // Berean Standard Bible
    ],
    fra: [
      'fra-text-fralsg',     // Louis Segond 1910
      'fra-edition-frasg21', // Segond 21
      'fra-edition-fraswr',  // Bible du Semeur
      'fra-edition-frabcf',  // Bible en français courant
      'fra-text-fradby'      // Darby
    ],
    por: [
      'por-edition-porarc',  // Almeida Revista e Corrigida
      'por-edition-porbar',  // Almeida Revista e Atualizada
      'por-edition-porbnv',  // Nova Versão Internacional
      'por-edition-porfie',  // Almeida Corrigida Fiel
      'por-edition-pornvt'   // Nova Versão Transformadora
    ],
    cmn: [
      'cmn-text-chinese-union-version-simplified-1919',
      'cmn-text-chinese-union-version-traditional-1919',
      'cmn-text-new-chinese-version-simplified-1992',
      'cmn-text-new-chinese-version-traditional-1992',
      'cmn-text-chinese-king-james-version-simplified-1992'
    ],
    ara: [
      'ara-text-arbvdv',     // Van Dyck
      'ara-text-arbnav',     // Ketab El Hayat (New Arabic Version)
      'ara-text-arberv',     // Easy-to-Read Version
      'ara-text-arbonav',    // Open New Arabic Version
      'ara-text-arzvdv'      // Egyptian Arabic
    ],
    amh: [
      'amh-text-amhubs',     // 1962 Bible (Bible Society of Ethiopia)
      'amh-edition-amhniv',  // New Amharic Standard Version
      'amh-edition-amhaclb', // Common Language Bible
      'amh-edition-amhort',  // Orthodox Bible
      'amh-edition-amhibs'   // IBS Version
    ],
    orm: [
      'orm-text-gazbib',      // Oromo Contemporary Version
      'orm-text-gazbibl',     // Oromo Contemporary Version, Latin script
      'orm-text-haebse',      // Eastern Oromo 2005
      'orm-publisher-gazgaz', // West Central Oromo New Testament
      'orm-publisher-gaxbsk'  // Borana 1994
    ]
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

  function typeOn(lang, type, state) {
    var t = state && state.types && state.types[lang];
    if (own(t, type)) return t[type] === true;
    return own(TYPE_DEFAULTS, type) ? TYPE_DEFAULTS[type] : true;
  }

  /* Default for one item, before any per-item switch. */
  function itemDefault(r, firstScripture) {
    if (r.type !== 'scripture') return true;
    if (own(TOP_SCRIPTURE, r.lang)) return TOP_SCRIPTURE[r.lang].indexOf(r.id) !== -1;
    return !firstScripture || firstScripture[r.id] === true;
  }

  // A language not in TOP_SCRIPTURE that grows past five keeps its first five.
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
    typeOn: typeOn,
    resolve: resolve,
    current: current
  };

  if (!window.ET_VISIBILITY_ADMIN) apply(window.LIBRARY, current());
})();
