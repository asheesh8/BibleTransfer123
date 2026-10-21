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
  if ((r.lang === 'mlg' && ET.i18n.current() === 'mg') || (r.lang === 'nya' && ET.i18n.current() === 'ny') || (r.lang === 'run' && ET.i18n.current() === 'rn') || (r.lang === 'aka' && ET.i18n.current() === 'ak') || (r.lang === 'tir' && ET.i18n.current() === 'ti') || (r.lang === 'hat' && ET.i18n.current() === 'ht') || (r.lang === 'spa' && ET.i18n.current() === 'es') || (r.lang === 'kuj' && ET.i18n.current() === 'swh') || (r.lang === 'lsm' && ET.i18n.current() === 'swh') || (r.lang === 'luy' && ET.i18n.current() === 'swh') || (r.lang === 'bxk' && ET.i18n.current() === 'swh') || (r.lang === 'rag' && ET.i18n.current() === 'swh') || (r.lang === 'ida' && ET.i18n.current() === 'swh') || (r.lang === 'ara' && ET.i18n.current() === 'ar') || (r.lang === 'kin' && ET.i18n.current() === 'rw') || (r.lang === 'xho' && ET.i18n.current() === 'xh') || (r.lang === 'sna' && ET.i18n.current() === 'sn') || (r.lang === 'lin' && ET.i18n.current() === 'ln') || (r.lang === 'yor' && ET.i18n.current() === 'yo') || (r.lang === 'pcm' && ET.i18n.current() === 'pcm')) {
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

  // ---------------------------------------------------------- sharing chain
  // A passed-on link says who sent it (et_from) and how many times it has
  // been passed on (et_hop). The chain lives only in links and this tab's
  // session, so it works with analytics declined; with analytics accepted,
  // each new share also records the share it grew from.
  var web = /^https?:$/.test(location.protocol);
  var NAME_JUNK = (function () {
    try { return new RegExp("[^\\p{L}\\p{M} '’-]", 'gu'); }
    catch (e) { return /[0-9_.,:;\/\\@<>"(){}\[\]#%&*+=?!|~^$`\u0000-\u001f]/g; }
  })();
  function cleanName(value) {
    var name = String(value || '').replace(NAME_JUNK, '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
    return /[^\s'’-]/.test(name) ? name : '';
  }
  var chain = (function () {
    var from = cleanName(ET.qs('et_from')), hop = parseInt(ET.qs('et_hop'), 10), parent = ET.qs('et_share'), c;
    if (from || hop > 0) {
      c = { from: from, hop: Math.max(1, Math.min(hop || 1, 999)),
            parent: /^[A-Za-z0-9_-]{8,80}$/.test(parent) ? parent : '' };
      try { sessionStorage.setItem('et.chain', JSON.stringify(c)); } catch (e) {}
      c.arrived = true;
      return c;
    }
    try { c = JSON.parse(sessionStorage.getItem('et.chain') || 'null'); } catch (e) { c = null; }
    return c && c.hop > 0 ? c : { from: '', hop: 0, parent: '' };
  })();
  var nextHop = Math.min(chain.hop + 1, 999);
  var pass = { to: '', email: '' };     // kept across re-renders on a language switch

  function senderName() { return cleanName(ET.store.get('et.share.from', '')); }
  function chainFields(fields) {
    fields.depth = nextHop;
    if (chain.parent) fields.parentShareId = chain.parent;
    return fields;
  }
  // This page's address, carrying the sender and the next step of the chain.
  function passUrl(name) {
    try {
      var u = new URL(location.href);
      u.hash = '';
      ['et_from', 'et_hop', 'et_share', 'et_channel'].forEach(function (k) { u.searchParams.delete(k); });
      if (name) u.searchParams.set('et_from', name);
      u.searchParams.set('et_hop', String(nextHop));
      return u.href;
    } catch (e) { return location.href.split('#')[0]; }
  }
  function passMessage(name, to, url) {
    var v = { from: name, to: to, title: ET.displayTitle(r) };
    return [t(to ? 'itemshare.mail.hello' : 'itemshare.mail.hello.anon', v),
      name ? t('itemshare.mail.line', v) : v.title,
      name ? t(to ? 'itemshare.mail.fromto' : 'itemshare.mail.from', v) : '',
      url, t('itemshare.mail.pass')].filter(Boolean).join('\n');
  }

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
      h(isText ? 'item.written' : 'item.spoken', { lang: (r.lang === 'ibo' && r.scope && r.scope !== 'Igbo') || r.lang === 'fra' || r.lang === 'amh' || r.lang === 'por' || r.lang === 'yor' || r.lang === 'pcm' || r.lang === 'lin' || r.lang === 'mlg' || r.lang === 'nya' || r.lang === 'run' || r.lang === 'aka' || r.lang === 'tir' || r.lang === 'hat' || r.lang === 'spa' || r.lang === 'kuj' || r.lang === 'lsm' || r.lang === 'luy' || r.lang === 'bxk' || r.lang === 'rag' || r.lang === 'ida' || r.lang === 'ara' || r.lang === 'kin' || r.lang === 'xho' || r.lang === 'sna'
        ? r.langName : L.native && L.native !== L.name
        ? L.native + ' · ' + L.name : (L.name || r.langName || '') }) + '</span>';

    var banner = chain.arrived && chain.from
      ? '<section class="card chain-banner" aria-labelledby="chain-h">' +
          '<span class="ico">' + ET.icon('share') + '</span><div>' +
          '<h2 id="chain-h" dir="auto">' + h('chain.title', { from: chain.from }) + '</h2>' +
          '<p>' + h('chain.sub', { n: chain.hop + 1 }) + '</p>' +
          (web ? '<button class="btn green" id="chain-pass" type="button">' + ET.icon('share') + h('chain.pass') + '</button>' : '') +
        '</div></section>'
      : '';
    var html = banner + hero() + '<div id="media">' + player() + '</div>' +
      '<div class="stack" style="margin-top:1rem">' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' + tongue + where +
          '<span class="chip">' + h('type.' + r.type) + '</span></div>' +
        '<h1 dir="auto" style="margin:.3rem 0 0">' + ET.esc(ET.displayTitle(r)) + '</h1>' +
        (r.native && r.native !== r.title && !((r.lang === 'amh' && ET.i18n.current() === 'am') || (r.lang === 'por' && ET.i18n.current() === 'pt') || (r.lang === 'yor' && ET.i18n.current() === 'yo') || (r.lang === 'pcm' && ET.i18n.current() === 'pcm') || (r.lang === 'mlg' && ET.i18n.current() === 'mg') || (r.lang === 'nya' && ET.i18n.current() === 'ny') || (r.lang === 'run' && ET.i18n.current() === 'rn') || (r.lang === 'aka' && ET.i18n.current() === 'ak') || (r.lang === 'tir' && ET.i18n.current() === 'ti') || (r.lang === 'hat' && ET.i18n.current() === 'ht') || (r.lang === 'spa' && ET.i18n.current() === 'es') || (r.lang === 'kuj' && ET.i18n.current() === 'swh') || (r.lang === 'lsm' && ET.i18n.current() === 'swh') || (r.lang === 'luy' && ET.i18n.current() === 'swh') || (r.lang === 'bxk' && ET.i18n.current() === 'swh') || (r.lang === 'rag' && ET.i18n.current() === 'swh') || (r.lang === 'ida' && ET.i18n.current() === 'swh') || (r.lang === 'ara' && ET.i18n.current() === 'ar') || (r.lang === 'kin' && ET.i18n.current() === 'rw') || (r.lang === 'xho' && ET.i18n.current() === 'xh') || (r.lang === 'sna' && ET.i18n.current() === 'sn') || (r.lang === 'lin' && ET.i18n.current() === 'ln')) ? '<p class="latin" style="font-size:1rem;margin:0">' +
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

    if (web) html += passCard();

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
    if (web) wirePassCard();
  }

  // ------------------------------------------------- pass it on (inline)
  // Always on the page, never a pop-up: whoever just chose this is the
  // person most likely to know who else needs it.
  function passCard() {
    return '<section class="card pass-on" id="pass-on" aria-labelledby="pass-on-h">' +
      '<h2 id="pass-on-h">' + ET.icon('share') + h(chain.hop ? 'itemshare.title.chain' : 'itemshare.title') + '</h2>' +
      '<p class="muted">' + h('itemshare.sub') + '</p>' +
      '<div class="pass-names">' +
        '<div><label class="flabel" for="ps-from">' + h('itemshare.from') + '</label>' +
        '<input type="text" id="ps-from" maxlength="40" autocomplete="given-name" dir="auto" value="' + ET.esc(senderName()) + '"></div>' +
        '<div><label class="flabel" for="ps-to">' + h('itemshare.to') + '</label>' +
        '<input type="text" id="ps-to" maxlength="40" autocomplete="off" dir="auto" value="' + ET.esc(pass.to) + '"></div>' +
      '</div>' +
      '<a class="btn green block" id="ps-wa" target="_blank" rel="noopener noreferrer" href="#">' +
        ET.icon('share') + h('itemshare.whatsapp') + '</a>' +
      '<label class="flabel" for="ps-email">' + h('itemshare.email') + '</label>' +
      '<div class="send-library-row"><input type="email" id="ps-email" maxlength="254" autocomplete="email" ' +
        'inputmode="email" dir="ltr" placeholder="name@example.com" value="' + ET.esc(pass.email) + '">' +
        '<button class="btn sky" type="button" id="ps-send">' + ET.icon('mail') + h('itemshare.send') + '</button></div>' +
      '<p class="send-library-status" id="ps-status" role="status" aria-live="polite"></p>' +
      '<p class="muted pass-privacy">' + h('itemshare.privacy') + '</p>' +
    '</section>';
  }

  function wirePassCard() {
    var from = ET.$('#ps-from'), to = ET.$('#ps-to'), mail = ET.$('#ps-email'),
      wa = ET.$('#ps-wa'), send = ET.$('#ps-send'), status = ET.$('#ps-status');
    function say(key, vars) { status.innerHTML = key ? h(key, vars) : ''; }
    function names() {
      var name = cleanName(from.value);
      ET.store.set('et.share.from', name);
      pass.to = cleanName(to.value);
      return name;
    }
    function waHref(url) {
      return 'https://wa.me/?text=' + encodeURIComponent(passMessage(cleanName(from.value), cleanName(to.value), url));
    }
    function refresh() { wa.href = waHref(passUrl(cleanName(from.value))); }
    refresh();
    [from, to].forEach(function (input) { input.addEventListener('input', refresh); });
    from.addEventListener('change', names);
    mail.addEventListener('input', function () { pass.email = mail.value; });
    var jump = ET.$('#chain-pass');
    if (jump) jump.addEventListener('click', function () {
      ET.$('#pass-on').scrollIntoView({ behavior: 'smooth', block: 'start' });
      (from.value ? to : from).focus({ preventScroll: true });
    });

    wa.addEventListener('click', function () {
      var name = names();
      var intent = ET.analytics.shareIntent(passUrl(name), 'whatsapp',
        chainFields({ resource: r.id, language: r.lang, status: 'opened' }));
      wa.href = waHref(intent.url);
      say('');
    });

    send.addEventListener('click', function () {
      var name = names(), address = mail.value.trim();
      if (!name) { say('itemshare.needname'); from.focus(); return; }
      if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[A-Za-z]{2,}$/.test(address)) { say('itemshare.invalid'); mail.focus(); return; }
      var intent = ET.analytics.shareIntent(passUrl(name), 'email', chainFields({ resource: r.id, language: r.lang }));
      var scope = ET.libraryScope();
      var body = { to: address, item: r.id, from: name, lang: ET.i18n.current(), hop: nextHop };
      if (pass.to) body.toName = pass.to;
      if (scope && scope.slug) body.library = scope.slug;
      if (intent.shareId) body.shareId = intent.shareId;
      function openMailApp() {
        var v = { from: name, to: pass.to, title: ET.displayTitle(r) };
        location.href = 'mailto:' + encodeURIComponent(address) + '?subject=' +
          encodeURIComponent(t('itemshare.mail.subject', v)) + '&body=' +
          encodeURIComponent(passMessage(name, pass.to, intent.url));
        say('itemshare.fallback');
      }
      send.disabled = true; say('itemshare.sending');
      fetch('/api/send-item', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(body)
      }).then(function (res) {
        send.disabled = false;
        if (res.ok) {
          ET.analytics.track('share_complete', { resource: r.id, language: r.lang, channel: 'email', shareId: intent.shareId, status: 'sent' });
          say('itemshare.sent', { to: pass.to || address });
          mail.value = pass.email = '';
        } else if (res.status === 400) say('itemshare.invalid');
        else if (res.status === 429) say('itemshare.limit');
        else openMailApp();
      }, function () { send.disabled = false; openMailApp(); });
    });
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
    var url = passUrl(senderName());
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
          var nativeIntent = ET.analytics.shareIntent(url, 'native_share', chainFields({ resource: r.id, language: r.lang }));
          navigator.share({ title: r.title, text: r.title + ' — ' + ((r.lang === 'yor' || r.lang === 'pcm' || r.lang === 'lin' || r.lang === 'mlg' || r.lang === 'nya' || r.lang === 'run' || r.lang === 'aka' || r.lang === 'tir' || r.lang === 'hat' || r.lang === 'spa' || r.lang === 'kuj' || r.lang === 'lsm' || r.lang === 'luy' || r.lang === 'bxk' || r.lang === 'rag' || r.lang === 'ida' || r.lang === 'ara' || r.lang === 'kin' || r.lang === 'xho' || r.lang === 'sna') ? L.native || L.name : L.name || ''), url: nativeIntent.url })
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
          var copyIntent = ET.analytics.shareIntent(url, 'copy_link', chainFields({ resource: r.id, language: r.lang }));
          copy(copyIntent.url, b, copyIntent.shareId);
        } else if (k === 'whatsapp' || k === 'telegram') {
          var composerIntent = ET.analytics.shareIntent(url, k, chainFields({ resource: r.id, language: r.lang, status: 'opened' }));
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
