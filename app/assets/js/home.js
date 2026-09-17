/* Home — what to open now, in the language this person chose.

   Shaped after the reference recording: pick up where you left off, then
   shelves you can swipe along. No grid of identical tiles, and no second copy
   of what the tab bar already offers. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;

  var ORDER = ['film', 'scripture', 'audio-bible', 'audio', 'historic', 'link'];

  function lastOpened() {
    // Resume beats browse: the film someone stopped halfway through is almost
    // always the thing they came back for.
    var id = ET.store.get('et.last', '');
    if (!id) return null;
    var r = ET.byId(id);
    return r && r.lang === ET.contentLang() ? r : null;
  }

  function render() {
    var lib = ET.library();
    var mine = ET.contentLang();
    var R = lib.resources.filter(ET.inMyLanguage);
    var L = lib.languages[mine] || {};
    var onCard = (lib.counts && lib.counts.offline) > 0;
    var offline = R.filter(function (r) { return r.offline; }).length;

    var out = '';

    // ---- greeting
    out += '<header class="greet">' +
      '<p class="eyebrow">' + h('home.greet') + '</p>' +
      '<h1>' + ET.esc(L.native || L.name || '') + '</h1>' +
      '<p class="muted">' + (onCard
        ? h('home.offline', { n: offline, total: R.length })
        : h('home.ready', { n: R.filter(function (r) { return r.play || r.read; }).length,
                            lang: L.name || '' })) + '</p></header>';

    // ---- carry on
    var last = lastOpened();
    if (last) {
      var art = last.cover || last.coverOnline;
      out += '<a class="hero-card' + (art ? ' shot' : '') + '" href="item.html?id=' +
        encodeURIComponent(last.id) + '">' +
        (art ? '<img src="' + ET.esc(art) + '" alt="" onerror="this.remove()"><span class="veil"></span>' : '') +
        '<span class="kicker">' + h('home.continue') + '</span>' +
        '<h2 class="latin">' + ET.esc(last.title) + '</h2>' +
        '<span class="sub latin">' + ET.esc(last.typeLabel || '') + '</span></a>';
    }

    // ---- shelves, one per kind, swipeable
    var byType = {};
    R.forEach(function (r) { (byType[r.type] = byType[r.type] || []).push(r); });

    ORDER.forEach(function (ty) {
      var list = byType[ty];
      if (!list || !list.length) return;
      // Things that play come before things that only link out.
      list.sort(function (a, b) {
        return (b.offline ? 2 : 0) + (b.play || b.read ? 1 : 0) -
               ((a.offline ? 2 : 0) + (a.play || a.read ? 1 : 0));
      });
      out += '<section class="shelf"><div class="shelf-head">' +
        '<h2>' + h('type.' + ty) + '</h2>' +
        (list.length > 4 ? '<a href="library.html?type=' + ty + '&lang=' + mine + '">' +
          h('home.seeall', { n: list.length }) + '</a>' : '') +
        '</div><div class="rail-x">' +
        list.slice(0, 12).map(function (r) {
          return ET.poster(r, r.duration || (r.offline ? t('item.offline') : ''));
        }).join('') + '</div></section>';
    });

    ET.$('#home').innerHTML = out;
  }

  ET.header();
  ET.tabbar('index.html');
  render();
  ET.i18n.apply();
  // apply() runs every listener, so a listener must never call it back.
  ET.i18n.onChange(render);

  // First run: nobody has chosen a language yet, so ask before anything else.
  if (!ET.i18n.chosen()) { ET.i18n.picker(true); }
})(window.ET);
