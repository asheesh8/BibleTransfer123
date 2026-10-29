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

     ET.hotspot.receive(root, back)   the other side, when that phone has
                            the app too: scan the first code, join the Wi-Fi
                            (Android does it for you; iPhone in Settings),
                            pick, and the films save into the app, where
                            they play with no internet like any kept film

   nearby.js loads this file when someone taps "Share with no internet" or
   "Receive with no internet".
   ========================================================================= */

window.ET.module('features/hotspot', ['core', 'ui/shell'], function (ET) {
  'use strict';

  var t = ET.i18n.t, h = ET.i18n.h;
  var CAP = (window.Capacitor && window.Capacitor.Plugins) || {};
  var PLUGIN = CAP.Hotspot;
  var POLL = 3000;

  var S = { picked: {}, on: false, timer: null, step: 1 };

  function kept() {
    var k = ET.keptFiles ? ET.keptFiles() : {};
    return Object.keys(k).map(function (url) {
      return { url: url, uri: k[url].uri, name: k[url].name, bytes: k[url].bytes || 0,
               at: k[url].at || 0, id: k[url].id || '' };
    }).sort(function (a, b) { return b.at - a.at; });
  }

  // The other phone's app reads this list (HotspotServer /list.json): it
  // keeps each film under its own address, so it plays like one saved here.
  function listFor(files) {
    return JSON.stringify(files.map(function (f, i) {
      return { n: i, name: f.name, bytes: f.bytes || 0, id: f.id || '', url: f.url };
    }));
  }

  function parseWifi(text) {
    if (!/^WIFI:/i.test(text || '')) return null;
    var out = {}, body = text.slice(5), key = '', val = '', inKey = true;
    for (var i = 0; i < body.length; i++) {
      var c = body[i];
      if (c === '\\' && i + 1 < body.length) { val += body[++i]; continue; }
      if (inKey && c === ':') { inKey = false; continue; }
      if (c === ';') { if (key) out[key.toUpperCase()] = val; key = val = ''; inKey = true; continue; }
      if (inKey) key += c; else val += c;
    }
    return out.S ? { ssid: out.S, password: out.P || '' } : null;
  }

  // The sharing phone's own address, from its second code.
  function baseFrom(text) {
    var u;
    try { u = new URL(text); } catch (e) { return null; }
    if (u.protocol !== 'http:' || !/^(10|172|192)\./.test(u.hostname)) return null;
    return u.origin + '/';
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

  function open(root, back, opts) {
    var files = kept();
    var item = opts && opts.item;
    if (item) files.forEach(function (f, i) { if (f.id === item.id) S.picked[i] = true; });
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
        page: page(chosen),
        list: listFor(chosen)
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
        (one ? '<p class="muted center">' + h('hotspot.applink') + '</p>' : '') +
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


  // ------------------------------------------------------------- receive
  function receive(root, back) {
    var R = { ctrl: null, joined: false };
    function paint(html) {
      root.innerHTML = '<h2>' + h('recv.title') + '</h2>' + html;
      if (ET.mascots) ET.mascots(root);
    }
    function on(id, fn) { var el = ET.$('#' + id, root); if (el) el.addEventListener('click', fn); }
    function btn(id, cls, icon, label) {
      return '<button class="btn ' + cls + ' block" id="' + id + '">' + (icon ? ET.icon(icon) : '') + label + '</button>';
    }
    function leaveNet() {
      if (R.joined && PLUGIN && PLUGIN.leave) PLUGIN.leave().catch(function () {});
      R.joined = false;
    }
    function leave() { if (R.ctrl) R.ctrl.abort(); leaveNet(); back(); }

    // 1. Scan the first code (or the second, if already on its Wi-Fi)
    function intro(msg, second) {
      paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(72, 'waiting') + '</div>' +
        (msg ? '<div class="note" style="margin-bottom:.8rem"><strong>' + msg + '</strong></div>' : '') +
        '<p class="muted">' + (second || h('recv.lead')) + '</p>' +
        '<div class="stack" style="margin-top:1rem">' + btn('rc-scan', '', 'scan', h(second ? 'recv.scan2' : 'recv.scan')) +
        btn('rc-back', 'ghost', 'back', h('save.back')) + '</div>');
      on('rc-scan', scan);
      on('rc-back', leave);
    }

    function scan() {
      ET.scanCode().then(function (text) {
        var wifi = parseWifi(text), base = baseFrom(text);
        if (base) return list(base);
        if (wifi) return join(wifi);
        intro(h('scan.other'));
      }, function () {});
    }

    // 2. Join its Wi-Fi: the app does it on Android 10+, Settings elsewhere
    function join(wifi) {
      function manual(msg) {
        intro(msg, h('recv.manual', { ssid: wifi.ssid, password: wifi.password }));
      }
      if (!PLUGIN || !PLUGIN.join) return manual('');
      paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(72, 'waiting') + '</div>' +
        '<p class="muted center"><span class="spin"></span>' + h('recv.joining', { ssid: wifi.ssid }) + '</p>');
      PLUGIN.join(wifi).then(function (r) {
        R.joined = true;
        list('http://' + (r.gateway || '192.168.43.1') + ':8080/');
      }, function () { manual(h('recv.err.join')); });
    }

    // 3. What it shares
    function list(base) {
      paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(72, 'waiting') + '</div>' +
        '<p class="muted center"><span class="spin"></span>' + h('recv.loading') + '</p>');
      getJson(base + 'list.json').then(function (files) {
        if (!files || !files.length) throw new Error('empty');
        pick(base, files);
      }).catch(function () { intro(h('recv.err.list')); });
    }

    function pick(base, files) {
      var on_ = {};
      files.forEach(function (f, i) { on_[i] = true; });
      paint('<p class="flabel">' + h('recv.pick') + '</p>' +
        '<div class="stack" role="group" aria-label="' + ET.esc(t('recv.pick')) + '">' +
        files.map(function (f, i) {
          var r = f.id && ET.byId && ET.byId(f.id);
          return '<label class="tile" style="width:100%;text-align:start">' +
            '<input type="checkbox" data-i="' + i + '" checked style="width:1.4rem;height:1.4rem;flex:none">' +
            '<span><span class="t" dir="auto">' + ET.esc(r ? ET.displayTitle(r) : f.name) + '</span>' +
            '<span class="s">' + ET.esc([r ? f.name : '', f.bytes ? ET.human(f.bytes) : ''].filter(Boolean).join(' · ')) +
            '</span></span></label>';
        }).join('') + '</div>' +
        '<div class="stack" style="margin-top:1rem">' + btn('rc-save', '', 'save', h('recv.save')) +
        btn('rc-back', 'ghost', 'back', h('save.back')) + '</div>');
      [].forEach.call(root.querySelectorAll('input[data-i]'), function (box) {
        box.addEventListener('change', function () {
          if (box.checked) on_[box.getAttribute('data-i')] = true; else delete on_[box.getAttribute('data-i')];
          ET.$('#rc-save', root).disabled = !Object.keys(on_).length;
        });
      });
      on('rc-save', function () { save(base, files.filter(function (f, i) { return on_[i]; })); });
      on('rc-back', leave);
    }

    // 4. Into the app, one after another
    function save(base, files) {
      var ctrl = R.ctrl = new AbortController(), i = 0;
      function next() {
        if (i >= files.length) return done(files.length);
        var f = files[i];
        var from = base + 'f/' + f.n + '/' + encodeURIComponent(f.name);
        paint('<p class="flabel">' + h('recv.saving', { i: i + 1, n: files.length }) + '</p>' +
          '<p class="latin" dir="auto"><strong>' + ET.esc(f.name) + '</strong></p>' +
          '<progress id="rc-bar" max="1" value="0" style="width:100%"></progress>' +
          '<p class="muted center num" id="rc-pct" aria-live="polite"></p>' +
          '<div class="stack" style="margin-top:1rem">' + btn('rc-stop', 'ghost', 'x', h('hotspot.stop')) + '</div>');
        on('rc-stop', function () { ctrl.abort(); });
        ET.save.keep({ name: f.name, bytes: f.bytes || 0, resource: f.id || '', from: from },
          f.url || from, ctrl.signal, function (got, total) {
            var bar = ET.$('#rc-bar', root), pct = ET.$('#rc-pct', root);
            if (bar && total) bar.value = got / total;
            if (pct) pct.textContent = total ? Math.floor(got * 100 / total) + '%' : ET.human(got);
          }).then(function () { i++; next(); }, function (err) {
            leaveNet();
            if (err && err.name === 'AbortError') return leave();
            intro(h('recv.err.save'));
          });
      }
      next();
    }

    function done(n) {
      leaveNet();
      if (ET.analytics) ET.analytics.track('hotspot_receive', { files: n });
      paint('<div class="nearby-wait nearby-wait--big">' + ET.lantern(84, 'saved') + '</div>' +
        '<h3 class="center">' + h('recv.done') + '</h3>' +
        '<div class="stack" style="margin-top:1rem">' +
        '<a class="btn block" href="' + ET.esc(ET.scopedUrl('index.html')) + '">' + ET.icon('home') + h('recv.home') + '</a>' +
        btn('rc-more', 'ghost', 'save', h('recv.more')) + '</div>');
      on('rc-more', function () { intro(); });
    }

    intro();
  }

  // Inside the app, native HTTP: the page itself may not fetch plain http
  // from an https origin, and the other phone has no certificate.
  function getJson(url) {
    var http = CAP.CapacitorHttp;
    if (http) {
      return http.request({ url: url, method: 'GET', responseType: 'json', connectTimeout: 8000, readTimeout: 8000 })
        .then(function (r) {
          if (r.status !== 200) throw new Error('HTTP ' + r.status);
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        });
    }
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); });
  }

  function stop() {
    clearTimeout(S.timer);
    if (S.on && PLUGIN) PLUGIN.stop().catch(function () {});
    S.on = false;
    S.served = 0;
  }

  window.addEventListener('pagehide', stop);

  ET.hotspot = { ok: !!(ET.native && PLUGIN), canReceive: !!ET.native, open: open, receive: receive, stop: stop,
                 wifiCode: wifiCode, parseWifi: parseWifi, baseFrom: baseFrom, listFor: listFor, page: page };
  return ET.hotspot;
});
