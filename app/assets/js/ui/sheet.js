/* ============================================================================
   ET.ui.sheet: a bottom sheet (a centred dialog on wide screens).

   Depends on: ui/icons.js; css/components/sheet.css.

     var s = ET.ui.sheet.open({
       title: 'Share this',              // already translated
       body: '<p>…</p>' | Element,
       closeLabel: 'Close',              // already translated
       onClose: function () {}
     });
     s.close();

   Behaviour a shared phone needs:
   · Focus moves into the sheet and is trapped there; Escape closes it and
     focus returns to whatever opened it.
   · A tap on the dimmed page, the close button, or a drag down on the
     handle (past a quarter of its height, or a quick flick) closes it.
   · The page behind does not scroll.
   ========================================================================= */

window.ET.module('ui/sheet', ['core', 'ui/icons'], function (ET) {
  'use strict';

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
  var seq = 0;

  function open(opts) {
    opts = opts || {};
    var id = 'et-sheet-' + (++seq);
    var before = document.activeElement;
    var root = document.createElement('div');
    root.className = 'et-sheet';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', id);
    root.innerHTML =
      '<div class="et-sheet__scrim"></div>' +
      '<div class="et-sheet__panel">' +
        '<div class="et-sheet__handle" aria-hidden="true"></div>' +
        '<header class="et-sheet__head"><h2 id="' + id + '"></h2>' +
          '<button type="button" class="et-sheet__close">' + ET.ui.icon('close') +
          '<span class="et-sr"></span></button></header>' +
        '<div class="et-sheet__body"></div>' +
      '</div>';
    root.querySelector('h2').textContent = opts.title || '';
    root.querySelector('.et-sheet__close .et-sr').textContent = opts.closeLabel || 'Close';
    var body = root.querySelector('.et-sheet__body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    document.body.appendChild(root);
    document.documentElement.classList.add('et-has-sheet');
    // A frame later, so the slide-up transition has a start point.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('is-open'); });
    });
    var first = body.querySelector(FOCUSABLE) || root.querySelector('.et-sheet__close');
    first.focus({ preventScroll: true });

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      root.classList.add('is-closing');
      root.classList.remove('is-open');
      root.style.removeProperty('--drag');
      document.removeEventListener('keydown', onKey, true);
      var done = function () {
        root.remove();
        if (!document.querySelector('.et-sheet')) document.documentElement.classList.remove('et-has-sheet');
        if (before && before.focus) before.focus({ preventScroll: true });
        if (opts.onClose) opts.onClose();
      };
      var panel = root.querySelector('.et-sheet__panel');
      var t = setTimeout(done, 500);            // in case transitionend never fires
      panel.addEventListener('transitionend', function () { clearTimeout(t); done(); }, { once: true });
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = root.querySelectorAll(FOCUSABLE);
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    root.querySelector('.et-sheet__scrim').addEventListener('click', close);
    root.querySelector('.et-sheet__close').addEventListener('click', close);
    dragToClose(root, close);

    return { el: root, body: body, close: close };
  }

  // Drag the handle down to dismiss, like every native sheet.
  function dragToClose(root, close) {
    var handle = root.querySelector('.et-sheet__handle');
    var panel = root.querySelector('.et-sheet__panel');
    var y0 = 0, t0 = 0, dy = 0, active = false;
    handle.addEventListener('pointerdown', function (e) {
      active = true; y0 = e.clientY; t0 = Date.now(); dy = 0;
      handle.setPointerCapture(e.pointerId);
      root.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (!active) return;
      dy = Math.max(0, e.clientY - y0);
      root.style.setProperty('--drag', dy + 'px');
    });
    var end = function () {
      if (!active) return;
      active = false;
      root.classList.remove('is-dragging');
      var flick = dy / Math.max(1, Date.now() - t0) > .6;
      if (dy > panel.offsetHeight / 4 || (flick && dy > 24)) close();
      else root.style.setProperty('--drag', '0px');
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  ET.ui = ET.ui || {};
  ET.ui.sheet = { open: open };
  return ET.ui.sheet;
});
