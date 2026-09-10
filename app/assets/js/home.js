/* Home — the first screen. Its whole job is to get someone to a useful thing in
   one tap, so it is categories and three verbs, and nothing else. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t;

  function render() {
    var lib = ET.library();
    var ALL = lib.resources;
    // Only what is spoken in the language this person chose. Everything else is
    // one tap away in the library, but it is never what they land on.
    var mine = ET.contentLang();
    var R = ALL.filter(ET.inMyLanguage);
    var L = lib.languages[mine] || {};
    var offline = R.filter(function (r) { return r.offline; }).length;
    // A card says which shelves need a signal; the web edition streams it all.
    var onCard = (lib.counts && lib.counts.offline) > 0;
    var ready = R.filter(function (r) { return r.offline || r.play || r.read; }).length;

    ET.$('#hero-art').innerHTML = ET.art.home();

    // On a card, say what works with no signal. On the web everything streams,
    // so say how much there is to watch and read in their language.
    ET.$('#hero-count').textContent = offline
      ? t('home.offline', { n: offline, total: R.length })
      : t('home.ready', { n: ready, lang: L.native || L.name || '' });

    var counts = {};
    R.forEach(function (r) { counts[r.type] = (counts[r.type] || 0) + 1; });

    var order = ['film', 'scripture', 'audio-bible', 'audio', 'historic', 'link'];
    ET.$('#types').innerHTML = order.filter(function (ty) {
      return counts[ty];
    }).map(function (ty) {
      var n = counts[ty];
      var off = R.filter(function (r) { return r.type === ty && r.offline; }).length;
      return '<a class="tile" href="library.html?type=' + ty + '&lang=' + mine + '">' +
        '<span class="ico">' + ET.icon(ET.typeIcon(ty)) + '</span>' +
        '<span><span class="t">' + ET.esc(t('type.' + ty)) + '</span>' +
        // The 'link' shelf IS the needs-internet shelf, so captioning it that
        // way again just says the same word twice.
        '<span class="s"><span class="num">' + n + '</span>' +
        (onCard && off < n && ty !== 'link' ? ' · ' + ET.esc(t('ui.needsnet')) : '') +
        '</span></span>' +
        '<span class="chev flip">' + ET.icon('chev') + '</span></a>';
    }).join('');

    ET.$('#actions').innerHTML = [
      ['library.html?lang=' + mine, 'search', 'home.browse', 'home.browse.sub', { n: R.length }],
      ['nearby.html', 'wifi', 'home.nearby', 'home.nearby.sub', null],
      ['share.html', 'share', 'home.share', 'home.share.sub', null],
      ['library.html', 'globe', 'home.other', 'home.other.sub', { n: ALL.length }],
      ['help.html', 'folder', 'home.help', 'home.help.sub', null]
    ].map(function (a) {
      return '<a class="tile" href="' + a[0] + '">' +
        '<span class="ico">' + ET.icon(a[1]) + '</span>' +
        '<span><span class="t">' + ET.esc(t(a[2])) + '</span>' +
        '<span class="s">' + ET.esc(t(a[3], a[4])) + '</span></span>' +
        '<span class="chev flip">' + ET.icon('chev') + '</span></a>';
    }).join('');

    // Only offered when Chrome has told us the page qualifies. A button that
    // does nothing on iOS would be worse than no button at all — see help.html.
    ET.onInstallable(function (yes) {
      var slot = ET.$('#install');
      if (!slot) return;
      slot.hidden = !yes || ET.standalone();
      if (!slot.hidden && !slot.innerHTML) {
        slot.innerHTML = '<button class="tile" style="width:100%;text-align:start">' +
          '<span class="ico" style="background:var(--gold-wash);color:var(--gold-deep)">' +
          ET.icon('save') + '</span>' +
          '<span><span class="t">' + ET.esc(t('home.install')) + '</span>' +
          '<span class="s">' + ET.esc(t('home.install.sub')) + '</span></span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
        slot.querySelector('button').addEventListener('click', ET.promptInstall);
      }
    });

    ET.$('#built').textContent = lib.source
      ? lib.source + ' · built ' + lib.built
      : 'built ' + lib.built;
  }

  ET.header('home');
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);

  // First run: nobody has chosen a language yet, so ask before anything else.
  if (!ET.i18n.chosen()) { ET.i18n.picker(true); }
})(window.ET);
