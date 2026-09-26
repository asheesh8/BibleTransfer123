/* One resource: play it, read it, save it, share it.

   The three verbs are always in the same order and the same colours, on every
   kind of resource, because the person using this may be reading slowly and
   recognising shapes before words. Everything happens on this page — saving
   and sharing open as guided sheets rather than sending anyone elsewhere. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;
  var scope = ET.libraryScope();
  var r = ET.byId(ET.qs('id'));
  if (scope && r && r.lang !== scope.lang) r = null;

  // Set the exit before handling missing or out-of-scope IDs so even a
  // manually edited shared URL cannot lead someone into the full catalog.
  ET.$('#back-ico').innerHTML = ET.icon('back', 'flip');
  ET.$('#back').href = scope ? ET.scopeEntryUrl() : 'library.html';

  if (!r) {
    ET.header();
    ET.tabbar();                 // a dead end still needs a way out
    ET.$('#item').innerHTML =
      '<div class="card center"><h2>Not in this library</h2>' +
      '<p class="muted">That item is not here.</p>' +
      '<a class="btn" href="' + ET.esc(ET.scopeEntryUrl()) + '">' + h('home.browse') + '</a></div>';
    ET.i18n.apply();
    return;
  }

  document.title = ET.displayTitle(r);
  ET.store.set('et.last', r.id);   // Home offers this back as "Carry on"
  var lib = ET.library();
  var L = lib.languages[r.lang] || {};
  var isText = r.type === 'scripture' || r.type === 'historic';

  // Remembered per resource, so the chapter someone stopped at is where they
  // pick up — a two-hour film is rarely watched in one sitting.
  var KEY = 'et.pos.' + r.id;

  // ---------------------------------------------------------------- player
  function player() {
    var p = r.play;
    if (!p) return '';

    if (p.kind === 'chapters') {
      return '<video id="v" controls playsinline preload="metadata" class="player"></video>' +
        '<div class="picker">' +
          '<label class="flabel" for="ch">' + h('item.chapters') + '</label>' +
          '<select id="ch">' + p.items.map(function (c, i) {
            return '<option value="' + i + '">' + ET.esc(c.n + '. ' + c.title) + '</option>';
          }).join('') + '</select>' +
          '<button class="btn ghost" id="ch-next">' + h('item.next') + ET.icon('chev', 'flip') + '</button>' +
        '</div>';
    }

    if (p.kind === 'video') {
      var q = (p.hd && p.sd)
        ? '<div class="filters" role="group" style="margin-top:.7rem">' +
          '<button class="fchip" data-q="sd" aria-pressed="true">' + h('item.sd') + '</button>' +
          '<button class="fchip" data-q="hd" aria-pressed="false">' + h('item.hd') + '</button></div>'
        : '';
      return '<video id="v" controls playsinline preload="metadata" class="player" src="' +
        ET.esc(p.file) + '"></video>' + q;
    }

    if (p.kind === 'audio') {
      return '<audio id="a" controls preload="metadata" src="' + ET.esc(p.file) +
        '" style="width:100%"></audio>';
    }

    if (p.kind === 'audio-bible') {
      var books = [];
      p.testaments.forEach(function (tt) {
        ET.BOOKS[tt].forEach(function (b) { books.push([tt, b[0], b[1], b[2]]); });
      });
      return '<audio id="a" controls preload="none" style="width:100%"></audio>' +
        '<div class="picker two">' +
          '<div><label class="flabel" for="bk">' + h('item.book') + '</label>' +
          '<select id="bk">' + books.map(function (b, i) {
            return '<option value="' + i + '">' + ET.esc(ET.bookName(b[2])) + '</option>';
          }).join('') + '</select></div>' +
          '<div><label class="flabel" for="bc">' + h('item.chapter.pick') + '</label>' +
          '<select id="bc"></select></div>' +
        '</div>';
    }
    return '';
  }

  // PDFs read inside the page wherever the browser can draw one, which covers
  // computers and iPhones. Android Chrome cannot render a PDF in a frame, so it
  // also gets a plain Open button that hands the file to the phone's reader.
  function reader() {
    if (!r.read) return '';
    var android = /Android/i.test(navigator.userAgent);
    return (android ? '' :
        '<iframe class="pdf" src="' + ET.esc(r.read.file) + '#view=FitH" title="' +
        ET.esc(r.title) + '" loading="lazy"></iframe>') +
      '<a class="btn sky block" style="margin-top:.7rem" href="' + ET.esc(r.read.file) +
      '" target="_blank" rel="noopener">' + ET.icon('book') + h('item.read') + '</a>';
  }

  function hero() {
    // A film's player replaces its poster; everything else keeps its artwork.
    if (r.play && (r.play.kind === 'chapters' || r.play.kind === 'video')) return '';
    return ET.thumb(r, 'aspect-ratio:16/9;border-radius:var(--r-lg);border:2px solid var(--line)');
  }

  function render() {
    var where = r.offline
      ? '<span class="chip offline">' + ET.icon('check') + h('item.offline') + '</span>'
      : (r.play || r.read)
        ? '<span class="chip stream">' + ET.icon('wifi') + h(r.play ? 'item.stream' : 'item.stream.read') + '</span>'
        : r.cardOnly
          ? '<span class="chip online">' + ET.icon('card') + h('item.cardonly') + '</span>'
          : '<span class="chip online">' + ET.icon('warn') + h('ui.needsnet') + '</span>';

    // What language this is actually in, before anyone presses play.
    var tongue = '<span class="chip lang">' + ET.icon('globe') +
      h(isText ? 'item.written' : 'item.spoken', { lang: L.native && L.native !== L.name
        ? L.native + ' · ' + L.name : (L.name || r.langName || '') }) + '</span>';

    var html = hero() + '<div id="media">' + player() + '</div>' +
      '<div class="stack" style="margin-top:1rem">' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' + tongue + where +
          '<span class="chip">' + h('type.' + r.type) + '</span></div>' +
        '<h1 dir="auto" style="margin:.3rem 0 0">' + ET.esc(ET.displayTitle(r)) + '</h1>' +
        (r.native ? '<p class="latin" style="font-size:1rem;margin:0">' +
          ET.esc(ET.displayTitle(r) === r.native ? r.title : r.native) + '</p>' : '') +
        '<p class="muted latin" style="margin:0">' + ET.esc([r.org, r.year, r.duration, r.stats]
          .filter(Boolean).join(' · ')) + '</p>' +
        (r.desc ? '<p class="latin">' + ET.esc(r.desc) + '</p>' : '') +
      '</div>';

    if (!r.offline && !r.play && !r.read) {
      // A file that only exists on a card is not waiting for a connection.
      html += '<div class="note" style="margin-top:1rem"><strong>' +
        h(r.cardOnly ? 'item.cardonly' : 'item.online') + '</strong>' +
        '<p style="margin:.2rem 0 0">' +
        h(r.cardOnly ? 'item.cardonly.why' : 'item.online.why') + '</p></div>';
    }

    html += reader();

    // The verbs.
    var canSave = (r.files || []).some(function (f) { return f.file || f.chapters; });
    html += '<div class="btn-row" style="margin-top:1.3rem">' +
      (canSave ? '<button class="btn green" id="save">' + ET.icon('save') + h('item.save') + '</button>' : '') +
      '<button class="btn sky" id="share">' + ET.icon('share') + h('item.share') + '</button></div>';

    var links = (r.links || []).slice();
    if (r.source && !links.some(function (l) { return l.url === r.source; })) {
      links.push({ label: 'dbs.org', url: r.source });
    }
    if (links.length) {
      html += '<p class="flabel" style="margin-top:1.6rem">' + h('item.more') + '</p>' +
        '<div class="stack">' + links.map(function (l) {
          return '<a class="tile" href="' + ET.esc(ET.safeUrl(l.url)) + '" target="_blank" rel="noopener">' +
            '<span class="ico">' + ET.icon('link') + '</span>' +
            '<span><span class="t latin">' + ET.esc(l.label) + '</span></span>' +
            '<span class="chev flip">' + ET.icon('chev') + '</span></a>';
        }).join('') + '</div>';
    }

    ET.$('#item').innerHTML = html;
    wirePlayer();
    var sv = ET.$('#save');
    if (sv) sv.addEventListener('click', function () { ET.save.open(r); });
    ET.$('#share').addEventListener('click', shareSheet);
  }

  // -------------------------------------------------------- player wiring
  function wirePlayer() {
    var p = r.play;
    if (!p) return;

    if (p.kind === 'chapters') {
      var v = ET.$('#v'), ch = ET.$('#ch');
      var at = Math.min(+ET.store.get(KEY, 0) || 0, p.items.length - 1);
      ch.value = String(at);
      var load = function (autoplay) {
        v.src = p.items[+ch.value].file;
        ET.store.set(KEY, ch.value);
        if (autoplay) v.play().catch(function () {});
      };
      load(false);
      ch.addEventListener('change', function () { load(true); });
      ET.$('#ch-next').addEventListener('click', function () {
        if (+ch.value < p.items.length - 1) { ch.value = String(+ch.value + 1); load(true); }
      });
      // 61 chapters is one film, not 61 decisions.
      v.addEventListener('ended', function () {
        if (+ch.value < p.items.length - 1) { ch.value = String(+ch.value + 1); load(true); }
      });
    }

    if (p.kind === 'video' && p.hd && p.sd) {
      var vid = ET.$('#v');
      ET.$$('[data-q]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t0 = vid.currentTime, playing = !vid.paused;
          vid.src = p[b.getAttribute('data-q')];
          vid.currentTime = t0;
          if (playing) vid.play().catch(function () {});
          ET.$$('[data-q]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        });
      });
    }

    if (p.kind === 'audio-bible') {
      var a = ET.$('#a'), bk = ET.$('#bk'), bc = ET.$('#bc');
      var books = [];
      p.testaments.forEach(function (tt) {
        ET.BOOKS[tt].forEach(function (b) { books.push([tt, b[0], b[1], b[2]]); });
      });
      var saved = (ET.store.get(KEY, '0:1') || '0:1').split(':');
      function fill(sel) {
        var n = books[+bk.value][3], out = '';
        for (var i = 1; i <= n; i++) out += '<option value="' + i + '">' + i + '</option>';
        bc.innerHTML = out;
        bc.value = String(Math.min(sel || 1, n));
      }
      function load(autoplay) {
        var b = books[+bk.value];
        a.src = ET.audioBibleUrl(p, b[0], b[1], b[2], +bc.value);
        ET.store.set(KEY, bk.value + ':' + bc.value);
        if (autoplay) a.play().catch(function () {});
      }
      bk.value = String(Math.min(+saved[0] || 0, books.length - 1));
      fill(+saved[1] || 1);
      load(false);
      bk.addEventListener('change', function () { fill(1); load(true); });
      bc.addEventListener('change', function () { load(true); });
      // Carry on into the next chapter, and the next book after that.
      a.addEventListener('ended', function () {
        if (+bc.value < books[+bk.value][3]) { bc.value = String(+bc.value + 1); }
        else if (+bk.value < books.length - 1) { bk.value = String(+bk.value + 1); fill(1); }
        else return;
        load(true);
      });
    }
  }

  // ------------------------------------------------------------------ share
  function shareSheet() {
    var url = location.href.split('#')[0];
    var web = /^https?:$/.test(location.protocol);
    var canNative = web && typeof navigator.share === 'function';

    var rows = [];
    if (canNative) rows.push(['native', 'share', 'share.native', 'share.native.sub']);
    if (web) rows.push(['copy', 'link', 'share.copy', '']);
    // Sending a file lives in one place: Send. It falls back to the printed
    // routes itself when two phones cannot pair, so listing them here too was
    // the same door twice.
    rows.push(['nearby', 'wifi', 'share.nearby', 'share.nearby.sub']);

    var s = ET.sheet(
      '<h2>' + h('share.sheet') + '</h2>' +
      '<p class="latin muted" style="margin-top:-.3rem">' + ET.esc(r.title) + '</p>' +
      '<div class="stack">' + rows.map(function (x) {
        return '<button class="tile" data-s="' + x[0] + '" style="width:100%;text-align:start">' +
          '<span class="ico">' + ET.icon(x[1]) + '</span>' +
          '<span><span class="t">' + h(x[2]) + '</span>' +
          (x[3] ? '<span class="s">' + h(x[3]) + '</span>' : '') + '</span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
      }).join('') + '</div>' +
      '<button class="btn ghost block" id="sh-x" style="margin-top:1rem">' + h('ui.close') + '</button>');

    ET.$('#sh-x', s.el).addEventListener('click', s.close);
    ET.$$('[data-s]', s.el).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-s');
        if (k === 'native') {
          navigator.share({ title: r.title, text: r.title + ' — ' + (L.name || ''), url: url })
            .catch(function () {});
        } else if (k === 'copy') {
          copy(url, b);
        } else if (k === 'nearby') {
          location.href = ET.scopedUrl('nearby.html', { id: r.id });
        }
      });
    });
  }

  function copy(text, btn) {
    var ok = function () {
      var tt = btn.querySelector('.t');
      if (tt) tt.innerHTML = h('share.copied');
      btn.querySelector('.ico').innerHTML = ET.icon('check');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      ta.remove();
    }
  }

  ET.header();
  ET.tabbar();
  ET.$('#back').href = scope ? ET.scopeEntryUrl()
                            : 'library.html?type=' + r.type + '&lang=' + r.lang;
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
})(window.ET);
