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
      '<div class="card center"><h2>' + h('item.missing') + '</h2>' +
      '<p class="muted">' + h('item.missing.sub') + '</p>' +
      '<a class="btn" href="' + ET.esc(ET.scopeEntryUrl()) + '">' + h('home.browse') + '</a></div>';
    ET.i18n.apply();
    return;
  }

  // Keep translated titles consistent in the reader, save flow and share sheet.
  if ((r.lang === 'mlg' && ET.i18n.current() === 'mg') || (r.lang === 'lin' && ET.i18n.current() === 'ln') || (r.lang === 'yor' && ET.i18n.current() === 'yo') || (r.lang === 'pcm' && ET.i18n.current() === 'pcm')) {
    r = Object.assign({}, r, { title: ET.displayTitle(r) });
  }
  document.title = ET.displayTitle(r);
  ET.store.set('et.last', r.id);   // Home offers this back as "Carry on"
  var lib = ET.library();
  var L = lib.languages[r.lang] || {};
  var isText = r.type === 'scripture' || r.type === 'historic' || r.type === 'book';

  function phoneScreen() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(max-width: 680px)').matches);
  }

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
        '" style="width:100%"></audio>' + (p.items && p.items.length ?
        '<div class="picker"><label class="flabel" for="track">' + h('item.recordings') +
        '</label><select id="track">' + p.items.map(function (c, i) {
          return '<option value="' + i + '">' + ET.esc(c.title) + '</option>';
        }).join('') + '</select><button class="btn ghost" id="track-next">' +
        h('item.next.recording') + ET.icon('chev', 'flip') + '</button></div>' : '');
    }

    if (p.kind === 'audio-bible') {
      var books = [];
      p.testaments.forEach(function (tt) {
        ET.BOOKS[tt].forEach(function (b) {
          if (!p.books || p.books.indexOf(b[1]) !== -1) books.push([tt, b[0], b[1],
            (p.chapterCounts && p.chapterCounts[b[1]]) || b[2]]);
        });
      });
      return '<audio id="a" controls preload="none" style="width:100%"></audio>' +
        '<div class="picker two">' +
          '<div><label class="flabel" for="bk">' + h('item.book') + '</label>' +
          '<select id="bk">' + books.map(function (b, i) {
            return '<option value="' + i + '">' + ET.esc((p.bookNames && p.bookNames[b[2]]) || ET.bookName(b[2])) + '</option>';
          }).join('') + '</select></div>' +
          '<div><label class="flabel" for="bc">' + h('item.chapter.pick') + '</label>' +
          '<select id="bc"></select></div>' +
        '</div>';
    }
    return '';
  }

  // A framed PDF is hard to scroll or zoom on a phone, and some mobile browsers
  // show only its first page. Give the whole screen to the phone's PDF reader.
  // On wider screens the inline preview remains useful as well.
  function reader() {
    if (!r.read) return '';
    var phone = phoneScreen();
    var companion = (r.links || []).filter(function (link) {
      return /^Read .+\(PDF\)$/i.test(link.label || '');
    });
    var original = '<a class="btn ' + (phone && companion.length ? 'ghost' : 'sky') +
      ' block" style="margin-top:.7rem" href="' + ET.esc(r.read.file) +
      '" target="_blank" rel="noopener">' + ET.icon('book') +
      h(phone && companion.length ? 'item.read.original' : 'item.read.full') + '</a>';
    var alternatives = companion.map(function (link) {
      var label = link.label === 'Read Wycliffe in modern spelling (PDF)'
        ? h('item.read.modern') : ET.esc(link.label);
      return '<a class="btn ' + (phone ? 'sky' : 'ghost') +
        ' block" style="margin-top:.7rem" href="' +
        ET.esc(ET.safeUrl(link.url)) + '" target="_blank" rel="noopener">' +
        ET.icon('book') + label + '</a>';
    }).join('');
    return (phone ? '' :
        '<iframe class="pdf" src="' + ET.esc(r.read.file) + '#view=FitH" title="' +
        ET.esc(r.title) + '" loading="lazy"></iframe>') +
      (phone ? alternatives + original : original + alternatives) +
      (phone ? '<p class="muted pdf-note">' + h('item.read.phone') + '</p>' : '');
  }

  function hero() {
    // A film's player replaces its poster; everything else keeps its artwork.
    if (r.play && (r.play.kind === 'chapters' || r.play.kind === 'video')) return '';
    // On a phone the Read action matters more than a decorative scan cover.
    if (isText && phoneScreen()) return '';
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
      h(isText ? 'item.written' : 'item.spoken', { lang: (r.lang === 'ibo' && r.scope && r.scope !== 'Igbo') || r.lang === 'fra' || r.lang === 'amh' || r.lang === 'por' || r.lang === 'yor' || r.lang === 'pcm' || r.lang === 'lin' || r.lang === 'mlg'
        ? r.langName : L.native && L.native !== L.name
        ? L.native + ' · ' + L.name : (L.name || r.langName || '') }) + '</span>';

    var html = hero() + '<div id="media">' + player() + '</div>' +
      '<div class="stack" style="margin-top:1rem">' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' + tongue + where +
          '<span class="chip">' + h('type.' + r.type) + '</span></div>' +
        '<h1 dir="auto" style="margin:.3rem 0 0">' + ET.esc(ET.displayTitle(r)) + '</h1>' +
        (r.native && r.native !== r.title && !((r.lang === 'amh' && ET.i18n.current() === 'am') || (r.lang === 'por' && ET.i18n.current() === 'pt') || (r.lang === 'yor' && ET.i18n.current() === 'yo') || (r.lang === 'pcm' && ET.i18n.current() === 'pcm') || (r.lang === 'mlg' && ET.i18n.current() === 'mg') || (r.lang === 'lin' && ET.i18n.current() === 'ln')) ? '<p class="latin" style="font-size:1rem;margin:0">' +
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
    var canSaveChapter = r.play && r.play.kind === 'audio-bible' && r.play.saveChapter;
    var canSave = canSaveChapter || (r.files || []).some(function (f) { return f.file || f.chapters; });
    html += '<div class="btn-row" style="margin-top:1.3rem">' +
      (canSave ? '<button class="btn green" id="save">' + ET.icon('save') + h('item.save') + '</button>' : '') +
      '<button class="btn sky" id="share">' + ET.icon('share') + h('item.share') + '</button></div>';

    if (canSave) {
      html += '<a class="save-guide-entry" href="' + ET.esc(ET.scopedUrl('save-guide.html', { id: r.id })) +
        '" lang="en" dir="ltr">' + ET.icon('laptop') +
        '<span>Save to your computer — screenshot guide <small>(English)</small></span></a>';
    }

    var links = (r.links || []).filter(function (link) {
      return !/^Read .+\(PDF\)$/i.test(link.label || '');
    });
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
    if (sv) sv.addEventListener('click', function () {
      if (!canSaveChapter) return ET.save.open(r);
      var book = ET.$('#bk'), chapter = ET.$('#bc');
      var currentFile = { label: book.options[book.selectedIndex].text + ' — ' +
        t('item.chapter', { n: chapter.value }) + ' (MP3)',
        file: ET.$('#a').src, remote: true, bytes: 0 };
      ET.save.open(Object.assign({}, r, { title: ET.displayTitle(r), files: [currentFile].concat(r.files || []) }));
    });
    ET.$('#share').addEventListener('click', shareSheet);
  }

  // -------------------------------------------------------- player wiring
  function wirePlayer() {
    var p = r.play;
    if (!p) return;

    if (p.kind === 'audio' && p.items && p.items.length) {
      var audio = ET.$('#a'), track = ET.$('#track');
      track.value = String(Math.max(0, Math.min(+ET.store.get(KEY, 0) || 0, p.items.length - 1)));
      function loadTrack(autoplay) {
        audio.src = p.items[+track.value].file;
        ET.store.set(KEY, track.value);
        if (autoplay) audio.play().catch(function () {});
      }
      function nextTrack() {
        if (+track.value < p.items.length - 1) {
          track.value = String(+track.value + 1); loadTrack(true);
        }
      }
      loadTrack(false);
      track.addEventListener('change', function () { loadTrack(true); });
      ET.$('#track-next').addEventListener('click', nextTrack);
      audio.addEventListener('ended', nextTrack);
    }

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
        ET.BOOKS[tt].forEach(function (b) {
          if (!p.books || p.books.indexOf(b[1]) !== -1) books.push([tt, b[0], b[1],
            (p.chapterCounts && p.chapterCounts[b[1]]) || b[2]]);
        });
      });
      var saved = (ET.store.get(KEY, '0:1') || '0:1').split(':');
      function unavailable(chapter) {
        var missing = (p.missingChapters || {})[books[+bk.value][2]] || [];
        return missing.indexOf(chapter) !== -1;
      }
      function fill(sel) {
        var n = books[+bk.value][3], out = '';
        for (var i = 1; i <= n; i++) out += '<option value="' + i + '"' +
          (unavailable(i) ? ' disabled' : '') + '>' + i +
          (unavailable(i) ? ' · ' + h('item.chapter.unavailable') : '') + '</option>';
        bc.innerHTML = out;
        var choice = Math.max(1, Math.min(sel || 1, n));
        if (unavailable(choice)) {
          choice = 1;
          while (choice <= n && unavailable(choice)) choice++;
        }
        bc.value = choice <= n ? String(choice) : '';
      }
      function load(autoplay) {
        if (!bc.value || unavailable(+bc.value)) return;
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
        if (+bc.value < books[+bk.value][3]) {
          if (unavailable(+bc.value + 1)) {
            ET.toast(t('item.chapter.unavailable.notice', { n: +bc.value + 1 }));
            return;
          }
          bc.value = String(+bc.value + 1);
        }
        else if (+bk.value < books.length - 1) { bk.value = String(+bk.value + 1); fill(1); }
        else return;
        load(true);
      });
    }
  }

  // ------------------------------------------------------------------ share
  function composerUrl(channel, url) {
    return channel === 'whatsapp'
      ? 'https://wa.me/?text=' + encodeURIComponent(r.title + '\n' + url)
      : 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(r.title);
  }

  function shareSheet() {
    var url = location.href.split('#')[0];
    var web = /^https?:$/.test(location.protocol);
    var canNative = web && typeof navigator.share === 'function';

    var rows = [];
    if (canNative) rows.push(['native', 'share', 'share.native', 'share.native.sub']);
    if (web) rows.push(['copy', 'link', 'share.copy', '']);
    if (web) {
      rows.push(['whatsapp', 'share', 'WhatsApp', '', true]);
      rows.push(['telegram', 'share', 'Telegram', '', true]);
    }
    // Sending a file lives in one place: Send. It falls back to the printed
    // routes itself when two phones cannot pair, so listing them here too was
    // the same door twice.
    rows.push(['nearby', 'wifi', 'share.nearby', 'share.nearby.sub']);

    var s = ET.sheet(
      '<h2>' + h('share.sheet') + '</h2>' +
      '<p class="latin muted" style="margin-top:-.3rem">' + ET.esc(r.title) + '</p>' +
      '<div class="stack">' + rows.map(function (x) {
        var tag = x[4] ? 'a' : 'button';
        var link = x[4] ? ' href="' + ET.esc(composerUrl(x[0], url)) + '" target="_blank" rel="noopener noreferrer"' : '';
        return '<' + tag + ' class="tile" data-s="' + x[0] + '"' + link + ' style="width:100%;text-align:start">' +
          '<span class="ico">' + ET.icon(x[1]) + '</span>' +
          '<span><span class="t">' + (x[4] ? ET.esc(x[2]) : h(x[2])) + '</span>' +
          (x[3] ? '<span class="s">' + h(x[3]) + '</span>' : '') + '</span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></' + tag + '>';
      }).join('') + '</div>' +
      '<button class="btn ghost block" id="sh-x" style="margin-top:1rem">' + h('ui.close') + '</button>');

    ET.$('#sh-x', s.el).addEventListener('click', s.close);
    ET.$$('[data-s]', s.el).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-s');
        if (k === 'native') {
          var nativeIntent = ET.analytics.shareIntent(url, 'native_share', { resource: r.id, language: r.lang });
          navigator.share({ title: r.title, text: r.title + ' — ' + ((r.lang === 'yor' || r.lang === 'pcm' || r.lang === 'lin' || r.lang === 'mlg') ? L.native || L.name : L.name || ''), url: nativeIntent.url })
            .then(function () {
              // The browser handed this to its share sheet; the recipient and
              // delivery result are not available to the page.
              ET.analytics.track('share_complete', {
                resource: r.id, language: r.lang, channel: 'native_share',
                shareId: nativeIntent.shareId, status: 'handed_off'
              });
            }, function (err) {
              ET.analytics.track('share_cancel', {
                resource: r.id, language: r.lang, channel: 'native_share',
                shareId: nativeIntent.shareId, status: err && err.name === 'AbortError' ? 'cancelled' : 'failed'
              });
            });
        } else if (k === 'copy') {
          var copyIntent = ET.analytics.shareIntent(url, 'copy_link', { resource: r.id, language: r.lang });
          copy(copyIntent.url, b, copyIntent.shareId);
        } else if (k === 'whatsapp' || k === 'telegram') {
          var composerIntent = ET.analytics.shareIntent(url, k, { resource: r.id, language: r.lang, status: 'opened' });
          b.href = composerUrl(k, composerIntent.url);
        } else if (k === 'nearby') {
          ET.analytics.track('share_intent', { resource: r.id, language: r.lang, channel: 'nearby', status: 'started' });
          location.href = ET.scopedUrl('nearby.html', { id: r.id });
        }
      });
    });
  }

  function copy(text, btn, shareId) {
    var ok = function () {
      ET.analytics.track('share_complete', {
        resource: r.id, language: r.lang, channel: 'copy_link', shareId: shareId, status: 'copied'
      });
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
      try { if (document.execCommand('copy')) ok(); } catch (e) {}
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
