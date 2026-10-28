/* ============================================================================
   ET.hotspot: share films kept in the Android app with phones nearby, with
   no internet at all.

   Depends on: core.js, ui/shell.js, save.js (the kept files),
   assets/vendor/qrcode.js (the codes); the app's Hotspot plugin
   (mobile/android/.../HotspotPlugin.java), so Android app only.

     ET.hotspot.ok          true where it can work (the Android app)
     ET.hotspot.open(root, back)   draws the whole flow into root; back()
                            is called when the person leaves it

   The phone opens its own small Wi-Fi network and a tiny web server on it.
   Two QR codes, one after the other:
     1  join the Wi-Fi     every phone camera knows WIFI: codes
     2  open the list      the browser shows the files; tap one to save it
   So the other phone needs no app and no internet, iPhone or Android. An
   iPhone app cannot open a network like this, so in a mixed pair the
   Android phone is the one that shares.

   nearby.js loads this file when someone taps "Share with no internet".
   ========================================================================= */

window.ET.module('features/hotspot', ['core', 'ui/shell'], function (ET) {
  'use strict';

  var t = ET.i18n.t, h = ET.i18n.h;
  var CAP = (window.Capacitor && window.Capacitor.Plugins) || {};
  var PLUGIN = CAP.Hotspot;
  var POLL = 3000;

  var S = { picked: {}, on: false, timer: null, step: 1 };

  function kept() {
    var k = (ET.save && ET.save.kept) ? ET.save.kept() : {};
    return Object.keys(k).map(function (url) {
      return { url: url, uri: k[url].uri, name: k[url].name, bytes: k[url].bytes || 0, at: k[url].at || 0 };
    }).sort(function (a, b) { return b.at - a.at; });
  }

  // A Wi-Fi code's special characters are escaped with a backslash.
  function wifiCode(ssid, pass) {
    function q(s) { return String(s || '').replace(/([\\;,:"])/g, '\\$1'); }
    return 'WIFI:T:WPA;S:' + q(ssid) + ';P:' + q(pass) + ';;';
  }

  function qrSvg(text, label) {
    if (typeof window.qrcode !== 'function') return '';
    var q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    var n = q.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    return '<svg viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="' +
      ET.esc(label) + '"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/>' +
      '<path fill="#000" d="' + d + '"/></svg>';
  }

  /* The page the other phone sees, in this reader's language. Plain HTML
     with its own small style: it is served from this phone, so it cannot
     load anything else. */
  function page(files) {
    var lang = (ET.i18n.current && ET.i18n.current()) || 'en';
    var rows = files.map(function (f, i) {
      return '<li><a href="/f/' + i + '/' + encodeURIComponent(f.name) + '" download="' + ET.esc(f.name) + '">' +
        '<b>' + ET.esc(f.name) + '</b><span>' + ET.esc(ET.human ? ET.human(f.bytes) : '') + '</span></a></li>';
    }).join('');
    return '<!doctype html><html lang="' + ET.esc(lang) + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + ET.esc(t('app.name')) + '</title><style>' +
      'body{margin:0;font:17px/1.45 system-ui,sans-serif;background:#FFFBF2;color:#2A1338;padding:20px}' +
      'h1{font-size:24px;margin:0 0 6px}p{margin:0 0 18px;color:#5F4E75}ul{list-style:none;margin:0;padding:0}' +
      'li{margin:0 0 12px}a{display:flex;flex-direction:column;gap:2px;padding:16px;border-radius:16px;' +
      'background:#fff;border:2px solid #D9CCE8;color:#4E1F64;text-decoration:none}' +
      'a span{font-size:14px;color:#5F4E75}' +
      '</style></head><body><h1>' + ET.esc(t('app.name')) + '</h1>' +
      '<p>' + ET.esc(t('hotspot.page.lead')) + '</p><ul>' + rows + '</ul></body></html>';
  }

  function open(root, back) {
    var files = kept();
    function paint(html) {
      root.innerHTML = '<h2>' + h('hotspot.title') + '</h2>' + html;
      if (ET.mascots) ET.mascots(root);
    }
    function on(id, fn) { var el = ET.$('#' + id, root); if (el) el.addEventListener('click', fn); }
    function btn(id, cls, icon, label) {
      return '<button class="btn ' + cls + ' block" id="' + id + '">' + (icon ? ET.icon(icon) : '') + label + '</button>';
    }
    function leave() { stop(); back(); }

    // 1. Which files
    function choose(msg) {
      stop();
      if (!files.length) {
        paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(72, 'thinking') + '</div>' +
          '<p>' + h('hotspot.none') + '</p>' +
          '<div class="stack" style="margin-top:1rem">' +
          '<a class="btn block" href="' + ET.esc(ET.scopeEntryUrl()) + '">' + ET.icon('search') + h('tab.library') + '</a>' +
          btn('hs-back', 'ghost', 'back', h('save.back')) + '</div>');
        on('hs-back', leave);
        return;
      }
      if (!Object.keys(S.picked).length) S.picked[0] = true;
      paint('<p class="muted">' + h('hotspot.lead') + '</p>' +
        (msg ? '<div class="note" style="margin:.8rem 0"><strong>' + msg + '</strong></div>' : '') +
        '<div class="stack" role="group" aria-label="' + ET.esc(t('hotspot.pick')) + '">' +
        files.map(function (f, i) {
          return '<label class="tile" style="width:100%;text-align:start">' +
            '<input type="checkbox" data-i="' + i + '"' + (S.picked[i] ? ' checked' : '') +
            ' style="width:1.4rem;height:1.4rem;flex:none">' +
            '<span><span class="t latin">' + ET.esc(f.name) + '</span>' +
            '<span class="s">' + ET.esc(ET.human ? ET.human(f.bytes) : '') + '</span></span></label>';
        }).join('') + '</div>' +
        '<div class="stack" style="margin-top:1rem">' + btn('hs-go', '', 'wifi', h('hotspot.start')) +
        btn('hs-back', 'ghost', 'back', h('save.back')) + '</div>');
      [].forEach.call(root.querySelectorAll('input[data-i]'), function (box) {
        box.addEventListener('change', function () {
          if (box.checked) S.picked[box.getAttribute('data-i')] = true;
          else delete S.picked[box.getAttribute('data-i')];
          ET.$('#hs-go', root).disabled = !Object.keys(S.picked).length;
        });
      });
      on('hs-go', start);
      on('hs-back', leave);
    }

    // 2. Open the network
    function start() {
      var chosen = files.filter(function (f, i) { return S.picked[i]; });
      if (!chosen.length) return;
      paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(72, 'waiting') + '</div>' +
        '<p class="muted center"><span class="spin"></span>' + h('hotspot.opening') + '</p>');
      PLUGIN.start({
        files: chosen.map(function (f) { return { uri: f.uri, name: f.name }; }),
        page: page(chosen)
      }).then(function (net) {
        S.on = true; S.net = net; S.step = 1; S.files = chosen;
        if (ET.analytics) ET.analytics.track('hotspot_start', { files: chosen.length });
        show();
        poll();
      }, function (err) {
        var code = err && err.code;
        choose(h(code === 'PERMISSION' ? 'hotspot.err.permission'
          : code === 'INCOMPATIBLE_MODE' || code === 'BUSY' ? 'hotspot.err.busy' : 'hotspot.err.other'));
      });
    }

    // 3. The two codes, one at a time
    function show() {
      var net = S.net, one = S.step === 1;
      var code = one ? wifiCode(net.ssid, net.password) : net.url;
      paint('<p class="flabel">' + h(one ? 'hotspot.step1' : 'hotspot.step2') + '</p>' +
        '<figure class="et-qr is-live nearby-qr"><div class="et-qr__code">' +
        qrSvg(code, t(one ? 'hotspot.step1' : 'hotspot.step2')) + '</div>' +
        '<figcaption class="et-qr__caption"><strong>' + h(one ? 'hotspot.scan1' : 'hotspot.scan2') + '</strong>' +
        '<span class="et-qr__hint latin" dir="ltr">' + (one
          ? ET.esc(t('hotspot.wifi')) + ': ' + ET.esc(net.ssid || '') + '<br>' + ET.esc(t('hotspot.password')) + ': ' + ET.esc(net.password || '')
          : ET.esc(net.url)) + '</span></figcaption></figure>' +
        '<p class="muted center" id="hs-served" aria-live="polite"></p>' +
        '<div class="stack" style="margin-top:1rem">' +
        (one ? btn('hs-next', '', 'chev', h('hotspot.next')) : btn('hs-prev', 'ghost', 'back', h('hotspot.prev'))) +
        btn('hs-stop', 'ghost', 'x', h('hotspot.stop')) + '</div>');
      on('hs-next', function () { S.step = 2; show(); });
      on('hs-prev', function () { S.step = 1; show(); });
      on('hs-stop', function () { stop(); choose(); });
      served(S.served || 0);
    }

    function served(n) {
      S.served = n;
      var el = ET.$('#hs-served', root);
      if (el) el.textContent = n ? t('hotspot.served', { n: n }) : '';
    }

    function poll() {
      clearTimeout(S.timer);
      if (!S.on) return;
      S.timer = setTimeout(function () {
        PLUGIN.status().then(function (st) {
          if (!st.on) { S.on = false; choose(h('hotspot.err.closed')); return; }
          if (st.served !== S.served) served(st.served);
          poll();
        }, poll);
      }, POLL);
    }

    choose();
  }

  function stop() {
    clearTimeout(S.timer);
    if (S.on && PLUGIN) PLUGIN.stop().catch(function () {});
    S.on = false;
    S.served = 0;
  }

  window.addEventListener('pagehide', stop);

  ET.hotspot = { ok: !!(ET.native && PLUGIN), open: open, stop: stop, wifiCode: wifiCode, page: page };
  return ET.hotspot;
});
