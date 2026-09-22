/* The library browser: search, two rows of filters, a grid of cards.

   Filter state lives in the URL, so a chosen shelf can be linked to from home,
   survives a reload, and comes back with the browser's own Back button — which
   on a phone is the button people actually use. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t;
  var lib = ET.library();

  // A link that names a language (or asks for all with lang=all) wins;
  // otherwise the shelf opens on the language this person chose.
  var urlLang = ET.qs('lang');
  var state = {
    q: ET.qs('q') || '',
    type: ET.qs('type') || '',
    lang: urlLang === 'all' ? '' : (urlLang || ET.contentLang())
  };

  var TYPES = ['film', 'scripture', 'audio-bible', 'audio', 'historic', 'link'];

  function present(list) {
    var seen = {};
    list.forEach(function (r) { seen[r.type] = true; });
    return TYPES.filter(function (x) { return seen[x]; });
  }

  function matches(r) {
    if (state.type && r.type !== state.type) return false;
    if (state.lang && r.lang !== state.lang) return false;
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
  function card(r) {
    var kicker = t('type.' + r.type);
    var verb = r.play ? t('act.watch') : r.read ? t('act.read') : t('act.open');
    if (r.type === 'audio' || r.type === 'audio-bible') verb = t('act.listen');
    if (!r.play && !r.read && !(r.files || []).length) verb = r.cardOnly ? t('act.oncard') : t('act.visit');
    var bits = [r.langName, r.duration || r.stats, r.org].filter(Boolean);
    return ET.row(r, {
      kicker: kicker + (r.offline ? ' · ' + t('item.offline') : ''),
      sub: bits.join(' · '),
      verb: verb
    });
  }

  function syncUrl() {
    var p = [];
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.type) p.push('type=' + state.type);
    p.push('lang=' + (state.lang || 'all'));
    var url = location.pathname + (p.length ? '?' + p.join('&') : '');
    // Some browsers refuse replaceState on a file:// origin. Keeping the URL in
    // step with the filters is a convenience; it is not worth a broken page.
    try { history.replaceState(null, '', url); } catch (e) {}
  }

  function chips() {
    var avail = present(lib.resources);
    ET.$('#type-filters').innerHTML =
      ['<button class="fchip" data-type="" aria-pressed="' + (!state.type) + '">' +
        ET.esc(t('lib.all')) + '</button>'].concat(
        avail.map(function (ty) {
          return '<button class="fchip" data-type="' + ty + '" aria-pressed="' +
            (state.type === ty) + '">' + ET.esc(t('type.' + ty)) + '</button>';
        })).join('');

    // Keep the catalogue filters in the same worldwide-speaker order as the
    // interface language picker. Append future catalogue-only languages so a
    // missing interface translation never hides their resources.
    var langs = ET.i18n.langs.map(function (lang) {
      return ET.contentCode(lang.code);
    }).filter(function (code, at, all) {
      return lib.languages[code] && all.indexOf(code) === at;
    });
    Object.keys(lib.languages).forEach(function (code) {
      if (langs.indexOf(code) < 0) langs.push(code);
    });
    ET.$('#lang-filters').innerHTML =
      ['<button class="fchip" data-lang="" aria-pressed="' + (!state.lang) + '">' +
        ET.esc(t('lib.all')) + '</button>'].concat(
        langs.map(function (code) {
          var L = lib.languages[code];
          // English's "native" name is just English — printing both said it twice.
          var same = (L.native || '') === L.name;
          return '<button class="fchip" data-lang="' + code + '" aria-pressed="' +
            (state.lang === code) + '">' +
            (same ? '<span class="latin">' + ET.esc(L.name) + '</span>'
                  : '<span dir="auto">' + ET.esc(L.native) + '</span> <span class="latin">' +
                    ET.esc(L.name) + '</span>') + '</button>';
        })).join('');

    ET.$$('#type-filters [data-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.type = b.getAttribute('data-type'); render();
      });
    });
    ET.$$('#lang-filters [data-lang]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.lang = b.getAttribute('data-lang'); render();
      });
    });
  }

  function render() {
    chips();
    var hits = lib.resources.filter(matches);
    ET.$('#results').innerHTML = hits.map(card).join('');
    ET.$('#count').textContent = t('lib.count', { n: hits.length, total: lib.resources.length });
    ET.$('#empty').hidden = hits.length > 0;
    ET.$('#results').hidden = hits.length === 0;
    syncUrl();
  }

  ET.header('library');
  ET.tabbar('library.html');
  ET.$('#search-ico').innerHTML = ET.icon('search');
  ET.$('#empty-art').innerHTML = ET.art.empty();

  var q = ET.$('#q');
  q.value = state.q;
  var timer;
  q.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = q.value.trim(); render(); }, 140);
  });
  ET.$('#reset').addEventListener('click', function () {
    state.q = ''; state.type = ''; state.lang = ''; q.value = ''; render();
  });

  render();
  ET.i18n.apply();
  // apply() invokes every listener, so a listener must never call apply() back.
  // render() only rewrites the dynamic regions; apply() handles [data-i18n].
  // Switching the interface language switches the shelf with it.
  ET.i18n.onChange(function () { state.lang = ET.contentLang(); render(); });
})(window.ET);
