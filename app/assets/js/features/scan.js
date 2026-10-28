/* ============================================================================
   ET.scan: read a QR code with the phone's camera, inside the page.

   Depends on: core.js, ui/shell.js; assets/vendor/jsqr.min.js (fetched only
   when the browser cannot read codes itself); css/components/qr.css.

     ET.scan.start().then(function (text) { ... }, function (err) { ... });
     ET.scan.go(text)    opens what a code points at, if it is ours

   Why the app needs its own scanner: on the web, the phone's camera app
   opens our QR codes in the browser, which is where the library is. Inside
   the phone app, the camera app would still open the browser, so the app
   reads codes itself and stays in the app.

   The camera shows full screen with a frame and a Close button. Frames are
   read with BarcodeDetector where the browser has it (Android) and with
   jsQR everywhere else (iPhone), so it works with no internet.

   shell.js loads this file the first time someone taps Scan (ET.scanCode);
   pages that never scan never pay for it.
   ========================================================================= */

window.ET.module('features/scan', ['core', 'ui/shell'], function (ET) {
  'use strict';

  var t = ET.i18n.t, h = ET.i18n.h;
  var ASSETS = ((document.currentScript && document.currentScript.src) || '')
    .replace(/js\/features\/scan\.js(\?.*)?$/, '');
  var ROOT = ASSETS.replace(/assets\/$/, '');
  var OURS = /(^|\.)bibletransfer123\.org$/i;
  var EVERY = 120;                       // ms between reads
  var WIDTH = 640;                       // frames are read at this width

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise(function (ok, no) {
      var sc = document.createElement('script');
      sc.src = ASSETS + 'vendor/jsqr.min.js';
      sc.onload = function () { window.jsQR ? ok(window.jsQR) : no(new Error('jsQR did not load')); };
      sc.onerror = function () { no(new Error('jsQR did not load')); };
      document.head.appendChild(sc);
    });
  }

  // The kit's et-scanner and its full-screen wrapper, both in qr.css.
  function css() {
    ['css/tokens.css', 'css/components/qr.css'].forEach(function (href) {
      var have = [].some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
        return l.href.indexOf(href, l.href.length - href.length) !== -1;
      });
      if (have) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = ASSETS + href;
      document.head.appendChild(l);
    });
  }

  // One reader per scan: BarcodeDetector first, jsQR if it is missing or fails.
  function reader() {
    var detector = null, canvas, ctx;
    try {
      if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    } catch (e) { detector = null; }
    function withJsQR(video) {
      return loadJsQR().then(function (jsQR) {
        var w = video.videoWidth, hh = video.videoHeight;
        if (!w || !hh) return null;
        var s = Math.min(1, WIDTH / w);
        canvas = canvas || document.createElement('canvas');
        canvas.width = Math.round(w * s); canvas.height = Math.round(hh * s);
        ctx = ctx || canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
        return code && code.data ? code.data : null;
      });
    }
    return function read(video) {
      if (!detector) return withJsQR(video);
      return detector.detect(video).then(function (found) {
        return found && found.length ? found[0].rawValue : null;
      }, function () { detector = null; return withJsQR(video); });
    };
  }

  var open = null;   // the scan on screen, if any

  function start() {
    if (open) return open.promise;
    css();
    var S = {}, last = document.activeElement;
    S.promise = new Promise(function (ok, no) { S.ok = ok; S.no = no; });
    open = S;

    var el = document.createElement('div');
    el.className = 'et-scan';
    el.id = 'et-scan';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', t('scan.open'));
    el.innerHTML =
      '<div class="et-scanner">' +
        '<video class="et-scanner__video" playsinline muted autoplay></video>' +
        '<span class="et-scanner__frame" aria-hidden="true"></span>' +
        '<p class="et-scanner__hint" aria-live="polite">' + h('scan.point') + '</p>' +
      '</div>' +
      '<div class="et-scan__bar">' +
        '<button class="btn block" id="et-scan-close">' + ET.icon('x') + h('scan.close') + '</button>' +
      '</div>';
    document.body.appendChild(el);
    document.body.classList.add('is-scanning');
    var video = el.querySelector('video');
    var say = el.querySelector('.et-scanner__hint');
    var close = el.querySelector('#et-scan-close');
    close.focus();

    function end(text, err) {
      if (S.done) return;
      S.done = true;
      clearTimeout(S.timer);
      if (S.stream) S.stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
      document.removeEventListener('keydown', onKey);
      el.remove();
      document.body.classList.remove('is-scanning');
      open = null;
      if (last && last.focus) { try { last.focus(); } catch (e) {} }
      if (text != null) S.ok(text);
      else S.no(err || abort());
    }
    function onKey(e) { if (e.key === 'Escape') end(null); }
    document.addEventListener('keydown', onKey);
    close.addEventListener('click', function () { end(null); });
    S.cancel = function () { end(null); };

    var md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) { noCamera(new Error('No camera')); return S.promise; }
    md.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(function (stream) {
      if (S.done) { stream.getTracks().forEach(function (tr) { tr.stop(); }); return; }
      S.stream = stream;
      video.srcObject = stream;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      var read = reader();
      (function tick() {
        if (S.done || S.found) return;
        var ready = video.readyState >= 2 ? read(video) : Promise.resolve(null);
        ready.then(function (text) {
          if (S.done || S.found) return;
          if (text) { el.classList.add('is-found'); S.timer = setTimeout(function () { end(text); }, 250); S.found = true; }
          else S.timer = setTimeout(tick, EVERY);
        }, function (err) { noCamera(err); });
      })();
    }, noCamera);

    // The camera was refused or is missing: say how to fix it, keep Close.
    function noCamera(err) {
      if (S.done) return;
      S.err = err;
      el.classList.add('is-blocked');
      say.innerHTML = '<strong>' + h('scan.nocam') + '</strong>';
    }
    return S.promise;
  }

  function abort() {
    var e = new Error('Scan closed');
    e.name = 'AbortError';
    return e;
  }

  /* Where a scanned code should go. Our own links open inside this app (or
     this site); anything else is not opened, because a code on a wall can
     point anywhere. Returns null when the code is not ours. */
  var routes = null;
  function loadRoutes() {
    if (routes || !ET.native) return Promise.resolve(routes || {});
    return fetch(ROOT + 'routes.json').then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (r) { routes = r || {}; return routes; });
  }

  function target(text) {
    text = String(text || '').trim();
    var digits = text.replace(/\s/g, '');
    if (/^\d{6}$/.test(digits)) return Promise.resolve(ROOT + 'nearby.html?join=' + digits);
    var u;
    try { u = new URL(text); } catch (e) { return Promise.resolve(null); }
    if (!/^https?:$/.test(u.protocol)) return Promise.resolve(null);
    var same = u.host === location.host && /^https?:$/.test(location.protocol);
    if (!OURS.test(u.hostname) && !same) return Promise.resolve(null);
    if (!ET.native) return Promise.resolve(u.href);
    // In the app the pages are files: /kikuyu -> kikuyu/index.html.
    return loadRoutes().then(function (map) {
      var path = u.pathname.replace(/^\/+|\/+$/g, '');
      var page;
      if (!path) page = 'index.html';
      else if (/^admin(\/|$)/.test(path)) return u.href;           // not in the app
      else if (map[path]) page = map[path];
      else if (/\.[a-z0-9]+$/i.test(path)) page = path;
      else page = path + '/index.html';
      return ROOT + page + u.search + u.hash;
    });
  }

  function go(text) {
    return target(text).then(function (where) {
      if (!where) { ET.toast(h('scan.other')); return false; }
      location.href = where;
      return true;
    });
  }

  ET.scan = { start: start, go: go, target: target, cancel: function () { if (open) open.cancel(); } };
  return ET.scan;
});
