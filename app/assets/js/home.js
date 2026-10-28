/* Home — what to open now, in the language this person chose.

   Shaped after the reference recording: pick up where you left off, then
   shelves you can swipe along. No grid of identical tiles, and no second copy
   of what the tab bar already offers. */
window.ET.module('home', ['core', 'ui/shell', 'ui/covers', 'i18n'], function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;

  var ORDER = ['film', 'scripture', 'book', 'audio-bible', 'audio', 'historic', 'link'];

  // What Kandili's first-run questions said this person came for
  // (features/onboarding.js), shelved first. Reading brings its books along.
  function order() {
    var want = ET.store.get('et.want', '');
    if (ORDER.indexOf(want) < 0) return ORDER;
    var first = want === 'scripture' ? ['scripture', 'book'] : [want];
    return first.concat(ORDER.filter(function (ty) { return first.indexOf(ty) < 0; }));
  }

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
    var ready = R.filter(function (r) { return r.play || r.read; }).length;
    var onlyCard = R.filter(function (r) { return r.cardOnly; }).length;
    // A language whose files exist only on a card has nothing to stream, and
    // saying "0 to watch" above a full shelf is worse than saying where it is.
    var line = onCard ? h('home.offline', { n: offline, total: R.length })
      : (ready === 0 && onlyCard)
        ? h('home.oncard', { n: R.length })
        : h('home.ready', { n: ready, lang: L.native || L.name || '' });
    // Kandili says hello beside the question, the way a friendly app opens.
    out += '<header class="greet">' +
      (ET.lantern ? '<span class="greet-mascot" aria-hidden="true">' + ET.lantern(72, 'hello') + '</span>' : '') +
      '<span class="greet-text"><p class="eyebrow">' + h('home.greet') + '</p>' +
      '<h1>' + ET.esc(L.native || L.name || '') + '</h1>' +
      '<p class="muted">' + line + '</p></span></header>';

    // ---- quick picks: one big bright button per kind of thing, so the first
    // tap answers "what would you like today?" without reading a shelf.
    var picks = [['film', 'film', 'purple'], ['scripture', 'book', 'sky'], ['audio-bible', 'wave', 'green'], ['audio', 'wave', 'gold']];
    var quick = picks.filter(function (p) {
      return R.some(function (r) { return r.type === p[0]; });
    }).slice(0, 3);
    if (quick.length > 1) {
      out += '<nav class="quick" aria-label="' + ET.esc(t('home.greet')) + '">' + quick.map(function (p) {
        return '<a class="quick-pick ' + p[2] + '" href="library.html?type=' + p[0] + '&lang=' + mine + '">' +
          '<span class="quick-ico">' + ET.icon(p[1]) + '</span>' +
          '<span class="quick-t">' + h('type.' + p[0]) + '</span></a>';
      }).join('') + '</nav>';
    }

    // ---- headline: the VillageServer deployment film, the first thing on Home, in
    // every language. It lives in the app folder, so a card plays it offline.
    out += '<section class="hero-card headline" lang="en" dir="ltr">' +
      '<video controls playsinline preload="none" poster="assets/media/village-server-deployment.jpg">' +
      '<source src="assets/media/village-server-deployment.mp4" type="video/mp4"></video>' +
      '<span class="cap"><span class="kicker">VillageServer Initiative</span>' +
      '<h2>Village Server deployment</h2>' +
      '<span class="sub">Film · 6 min</span></span></section>';

    out += '<a class="et-tile" href="' + ET.esc(ET.scopedUrl('save-guide.html')) + '" lang="en" dir="ltr">' +
      '<span class="et-tile__icon">' + ET.icon('laptop') + '</span>' +
      '<span class="et-tile__text"><span class="et-tile__title">Save to your computer</span>' +
      '<span class="et-tile__sub">Screenshot guide · English · Mac + Windows</span></span>' +
      '<span class="et-tile__end">' + ET.icon('chev') + '</span></a>';

    // ---- carry on
    var last = lastOpened();
    if (last) {
      var art = last.cover || last.coverOnline;
      out += '<a class="hero-card' + (art ? ' shot' : '') + '" href="item.html?id=' +
        encodeURIComponent(last.id) + '">' +
        (art ? '<img src="' + ET.esc(art) + '" alt="" onerror="this.remove()"><span class="veil"></span>' : '') +
        '<span class="kicker">' + h('home.continue') + '</span>' +
        '<h2 dir="auto">' + ET.esc(ET.displayTitle(last)) + '</h2>' +
        '<span class="sub latin">' + ET.esc(last.typeLabel || '') + '</span></a>';
    }

    // ---- shelves, one per kind, swipeable
    var byType = {};
    R.forEach(function (r) { (byType[r.type] = byType[r.type] || []).push(r); });

    order().forEach(function (ty) {
      var list = byType[ty];
      if (!list || !list.length) return;
      // Things that play come before things that only link out.
      list.sort(function (a, b) {
        return (b.offline ? 2 : 0) + (b.play || b.read ? 1 : 0) -
               ((a.offline ? 2 : 0) + (a.play || a.read ? 1 : 0));
      });
      // Dialect dubs share one cover. Six identical JESUS posters in a row
      // hide everything after them, so repeats of a picture go to the end.
      var seenArt = {}, first = [], again = [];
      list.forEach(function (r) {
        var art = r.cover || r.coverOnline;
        if (art && seenArt[art]) again.push(r); else { if (art) seenArt[art] = 1; first.push(r); }
      });
      list = first.concat(again);
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
    if (ET.loadMascot) ET.loadMascot();
  }

  ET.header();
  ET.tabbar('index.html');
  render();
  ET.i18n.apply();
  // apply() runs every listener, so a listener must never call it back.
  ET.i18n.onChange(render);
});
