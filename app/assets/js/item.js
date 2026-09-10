/* One resource: play it, read it, save it, share it.

   The three verbs are always in the same order and always the same colours, on
   every kind of resource, because the person using this may be reading slowly
   and recognising shapes before words. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t;
  var r = ET.byId(ET.qs('id'));

  if (!r) {
    ET.header();
    ET.$('#item').innerHTML =
      '<div class="card center"><h2>Not on this card</h2>' +
      '<p class="muted">That item is not in this library.</p>' +
      '<a class="btn" href="library.html">' + ET.esc(t('home.browse')) + '</a></div>';
    ET.i18n.apply();
    return;
  }

  document.title = r.title;

  // ---------------------------------------------------------------- player
  function player() {
    if (r.play && r.play.kind === 'chapters') {
      return '<video id="v" controls playsinline preload="metadata" ' +
             'style="width:100%;border-radius:var(--r);background:#000"></video>' +
             '<div style="margin-top:.8rem">' +
             '<label class="muted" for="ch" style="display:block;margin-bottom:.35rem">' +
             ET.esc(t('item.chapters')) + '</label>' +
             '<select id="ch">' + r.play.items.map(function (c) {
               return '<option value="' + ET.esc(c.file) + '">' +
                 ET.esc(c.n + '. ' + c.title) + '</option>';
             }).join('') + '</select></div>';
    }
    if (r.play && r.play.kind === 'video') {
      return '<video controls playsinline preload="metadata" src="' + ET.esc(r.play.file) +
             '" style="width:100%;border-radius:var(--r);background:#000"></video>';
    }
    if (r.play && r.play.kind === 'audio') {
      return '<audio controls preload="metadata" src="' + ET.esc(r.play.file) +
             '" style="width:100%"></audio>';
    }
    return '';
  }

  // A PDF is the one thing the app cannot reliably show inline: Android Chrome
  // will not render one in an iframe, and on a card it is a file:// iframe on
  // top of that. So hand it to the device's own reader, which always works.
  function reader() {
    if (!r.read) return '';
    return '<div class="note info" style="margin-top:1rem">' +
      '<strong>' + ET.esc(t('item.openfile')) + '</strong>' +
      '<p style="margin:.2rem 0 .7rem">' + ET.esc(t('item.openfile.sub')) + '</p>' +
      '<a class="btn sky" href="' + ET.esc(r.read.file) + '" target="_blank" rel="noopener">' +
      ET.icon('book') + ET.esc(t('item.read')) + '</a></div>';
  }

  function hero() {
    var art = r.cover || r.coverOnline;
    if (art) {
      return '<div class="thumb" style="aspect-ratio:16/9;border-radius:var(--r-lg);' +
        'border:2px solid var(--line);background-image:url(\'' +
        ET.esc(art).replace(/'/g, "\\'") + '\');background-size:cover;' +
        'background-position:center"></div>';
    }
    return '<div class="thumb" style="aspect-ratio:16/9;border-radius:var(--r-lg);' +
      'border:2px solid var(--line);display:grid;place-items:center;' +
      'background:var(--sunk);color:var(--purple)">' +
      ET.icon(ET.typeIcon(r.type)) + '</div>';
  }

  function render() {
    var badge = r.offline
      ? '<span class="chip offline">' + ET.icon('check') + ET.esc(t('item.offline')) + '</span>'
      : '<span class="chip online">' + ET.icon('warn') + ET.esc(t('ui.needsnet')) + '</span>';

    var body = [
      hero(),
      '<div style="margin-top:1rem" class="stack">',
        '<div class="foot" style="display:flex;gap:.4rem;flex-wrap:wrap">' + badge +
          '<span class="chip lang">' + ET.esc(t('type.' + r.type)) + '</span>' +
          '<span class="chip">' + ET.esc(r.langName || '') + '</span></div>',
        '<h1 class="latin" style="margin:.3rem 0 0">' + ET.esc(r.title) + '</h1>',
        r.native ? '<p dir="rtl" style="font-size:1.3rem;margin:0">' + ET.esc(r.native) + '</p>' : '',
        '<p class="muted latin" style="margin:0">' + ET.esc([r.org, r.year, r.duration]
          .filter(Boolean).join(' · ')) + '</p>',
        r.desc ? '<p class="latin">' + ET.esc(r.desc) + '</p>' : '',
      '</div>'
    ].join('');

    if (!r.offline) {
      body += '<div class="note" style="margin-top:1rem">' +
        '<strong>' + ET.esc(t('item.online')) + '</strong>' +
        '<p style="margin:.2rem 0 .7rem">' + ET.esc(t('item.online.why')) + '</p>' +
        (r.online && r.online.source
          ? '<a class="btn gold" href="' + ET.esc(r.online.source) +
            '" target="_blank" rel="noopener">' + ET.icon('link') + 'Open online</a>'
          : '') + '</div>';
    }

    var p = player();
    if (p) body += '<div style="margin-top:1.2rem">' + p + '</div>';
    body += reader();

    // The three verbs.
    body += '<div class="btn-row" style="margin-top:1.4rem">';
    if (r.files && r.files.length) {
      body += '<button class="btn green" id="save">' + ET.icon('save') +
              ET.esc(t('item.save')) + '</button>';
    }
    body += '<a class="btn sky" href="share.html?id=' + encodeURIComponent(r.id) + '">' +
            ET.icon('share') + ET.esc(t('item.share')) + '</a></div>';

    ET.$('#item').innerHTML = body;

    var v = ET.$('#v'), ch = ET.$('#ch');
    if (v && ch) {
      v.src = ch.value;
      ch.addEventListener('change', function () { v.src = ch.value; v.play(); });
      // Auto-advance: 61 chapters is a film, not 61 decisions.
      v.addEventListener('ended', function () {
        if (ch.selectedIndex < ch.options.length - 1) {
          ch.selectedIndex += 1;
          v.src = ch.value;
          v.play();
        }
      });
    }
    var save = ET.$('#save');
    if (save) save.addEventListener('click', saveSheet);
  }

  // ------------------------------------------------------------------ save
  function saveSheet() {
    var rows = r.files.map(function (f) {
      var size = f.bytes ? ' · <span class="num">' + ET.human(f.bytes) + '</span>' : '';
      if (f.folder) {
        // A browser cannot hand over a directory, so say what to do instead of
        // offering a button that quietly does nothing.
        return '<div class="tile" style="cursor:default">' +
          '<span class="ico">' + ET.icon('folder') + '</span>' +
          '<span><span class="t latin">' + ET.esc(f.label) + '</span>' +
          '<span class="s">Copy the folder <code class="latin">' + ET.esc(f.file) +
          '</code> from the card' + size + '</span></span></div>';
      }
      return '<a class="tile" href="' + ET.esc(f.file) + '" download>' +
        '<span class="ico">' + ET.icon('save') + '</span>' +
        '<span><span class="t latin">' + ET.esc(f.label) + '</span>' +
        '<span class="s">' + ET.esc(t('save.go')) + size + '</span></span>' +
        '<span class="chev flip">' + ET.icon('chev') + '</span></a>';
    }).join('');

    var big = r.files.reduce(function (a, f) { return Math.max(a, f.bytes || 0); }, 0);

    ET.sheet(
      '<h2>' + ET.esc(t('save.title')) + '</h2>' +
      '<p class="muted">' + ET.esc(t('save.tap')) + '</p>' +
      (big > 200 * 1024 * 1024
        ? '<div class="note"><strong>' +
          ET.esc(t('save.big', { size: ET.human(big) })) + '</strong></div>'
        : '') +
      '<div class="stack" style="margin:1rem 0">' + rows + '</div>' +
      '<div class="note good"><strong>' + ET.esc(t('save.where')) + '</strong>' +
      '<p style="margin:.3rem 0 0">' + ET.esc(t('save.android')) + '<br>' +
      ET.esc(t('save.ios')) + '<br>' + ET.esc(t('save.computer')) + '</p></div>' +
      '<div class="note" style="margin-top:.7rem"><strong>' +
      ET.esc(t('save.check')) + '</strong></div>' +
      '<button class="btn ghost block" style="margin-top:1rem" ' +
      'onclick="this.closest(\'.sheet-back\').remove()">' +
      ET.esc(t('ui.close')) + '</button>');
  }

  ET.header();
  ET.$('#back-ico').innerHTML = ET.icon('back', 'flip');
  ET.$('#back').href = 'library.html?type=' + r.type;
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
})(window.ET);
