/* ============================================================================
   ET.ui.toast: a short confirmation that rises from the bottom and leaves.

   Depends on: ui/icons.js; brand/mascot.js (optional, for the little
   lantern); css/components/toast.css.

     ET.ui.toast.show({
       text: 'Saved. It's on your phone now.',   // already translated
       tone: 'go',                                 // go | info | danger
       pose: 'saved',                              // a Kandili pose, or
       icon: 'check',                              // an icon instead
       action: { label: 'Undo', run: fn },
       ms: 4000
     });

   One polite live region per page, so screen readers announce each toast
   without moving focus. At most two show at once; the oldest leaves first.
   ========================================================================= */

window.ET.module('ui/toast', ['core', 'ui/icons'], function (ET) {
  'use strict';

  var region = null;
  var MAX = 2;

  function host() {
    if (region && document.body.contains(region)) return region;
    region = document.createElement('div');
    region.className = 'et-toasts';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    document.body.appendChild(region);
    return region;
  }

  function show(opts) {
    opts = typeof opts === 'string' ? { text: opts } : (opts || {});
    var box = host();
    while (box.children.length >= MAX) leave(box.firstChild, true);

    var el = document.createElement('div');
    el.className = 'et-toast' + (opts.tone ? ' et-toast--' + opts.tone : '');
    var art = '';
    if (opts.pose && ET.mascot) art = ET.mascot.markup(opts.pose, { size: '2.75rem' });
    else if (opts.icon && ET.ui.icon) art = ET.ui.icon(opts.icon);
    el.innerHTML = (art ? '<span class="et-toast__art">' + art + '</span>' : '') +
                   '<span class="et-toast__text"></span>';
    el.querySelector('.et-toast__text').textContent = opts.text || '';
    if (opts.action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'et-toast__action';
      b.textContent = opts.action.label;
      b.addEventListener('click', function () { opts.action.run(); leave(el); });
      el.appendChild(b);
    }
    box.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('is-in'); });
    });

    // Paused while a finger or the mouse is on it, so it can be read.
    var left = opts.ms || 4000, started = Date.now(), timer;
    var arm = function () { started = Date.now(); timer = setTimeout(function () { leave(el); }, left); };
    el.addEventListener('pointerenter', function () { clearTimeout(timer); left -= Date.now() - started; });
    el.addEventListener('pointerleave', arm);
    arm();
    return { el: el, close: function () { leave(el); } };
  }

  function leave(el, now) {
    if (!el || el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    if (now) { el.remove(); return; }
    var t = setTimeout(function () { el.remove(); }, 400);
    el.addEventListener('transitionend', function () { clearTimeout(t); el.remove(); }, { once: true });
  }

  ET.ui = ET.ui || {};
  ET.ui.toast = { show: show };
  return ET.ui.toast;
});
