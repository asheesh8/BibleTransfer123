/* ============================================================================
   features/launch.js: the app opening, Kandili's first moment of the day.

   The phone's splash screen shows Kandili asleep on cream (or, on a phone
   set to dark, near-black: docs/design/color.md), drawn from this
   same SVG by mobile/scripts/make-icons.js. This page draws him again on the
   very same spot, the splash steps aside unseen, and then he wakes: the
   flame catches, his eyes open, a stretch and a hop, a wave, and the library
   fades in behind him. About two seconds; a tap skips it.

   Loaded by ui/shell.js once per app start (or with ?launch on the website).
   Depends on: core.js, ui/shell.js, brand/mascot.js (fetched here). Under
   reduced motion the splash simply goes and the library shows.
   ========================================================================= */

window.ET.module('features/launch', ['core', 'ui/shell'], function (ET) {
  'use strict';

  // Where the splash screens draw him: keep equal to mobile/scripts/make-icons.js.
  var SPLASH_DP = 190, IOS_SHARE = 0.2;
  // The splash follows the phone's own light or dark setting, not the app's.
  var dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  function boxHeight() {
    var ios = window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios';
    return ios ? IOS_SHARE * Math.max(innerWidth, innerHeight) : SPLASH_DP;
  }

  var el, k, gone = false;

  function done() {
    if (gone) return;
    gone = true;
    ET.splashHide();
    if (!el) return;
    var host = el.firstChild;
    if (!el.animate || ET.motion.reduced()) return el.remove();
    host.animate([{ transform: 'scale(1)' }, { transform: 'scale(.82)' }], { duration: 420, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' });
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'forwards' })
      .finished.then(function () {
        if (k) k.destroy();
        el.remove();
      }, function () { el.remove(); });
  }

  if (ET.motion.reduced()) { done(); return {}; }

  el = document.createElement('div');
  el.id = 'et-launch';
  if (dark) el.className = 'et-on-dark';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:' + (dark ? '#1A1316' : '#FBF7F1');
  var h = boxHeight();
  el.innerHTML = '<div style="width:' + (h * 320 / 340) + 'px;height:' + h + 'px;line-height:0"></div>';
  el.addEventListener('click', done);
  document.body.appendChild(el);
  setTimeout(done, 5000);   // never in the way, whatever fails to load

  ET.loadMascot(function () {
    if (gone) return;
    var M = ET.mascot, x = M.kit;
    // The wake-up. He starts as the splash drew him, asleep on his ember:
    // a sleepy settle, then the flame catches with a whoosh, the eyes open
    // (a blink to clear them), a stretch, a hop, and he lands with a squash.
    var up = function (a) {
      return a.map(function (v) { return x.k(v[0], 'translateY(' + v[1] + 'px) scale(' + v[2] + ',' + v[3] + ')'); });
    };
    M.addMove('wake', [
      ['.k-flame', x.sc([[0, .15, .15], [.24, .15, .15], [.36, 1.4, 1.8], [.46, .85, 1.1], [.56, 1.08, .94], [.66, 1, 1], [1, 1, 1]]), x.T(1500)],
      ['.k-glowwrap', [x.k(0, 'scale(.5)', .15), x.k(.26, 'scale(.5)', .15), x.k(.44, 'scale(1.35)', 1), x.k(.64, 'scale(1)', 1), x.k(1, 'scale(1)', 1)], x.T(1500)],
      ['.k-eyes', x.sc([[0, 1, .08], [.4, 1, .08], [.46, 1, 1], [.54, 1, .08], [.6, 1, 1], [1, 1, 1]]), x.T(1500)],
      ['.k-body', up([[0, 0, 1, 1], [.14, 0, 1.04, .95], [.3, 0, 1.04, .95], [.42, 0, .9, 1.12], [.5, 0, 1, 1],
                      [.58, -30, .94, 1.07], [.68, 0, 1.16, .84], [.8, 0, .96, 1.04], [.9, 0, 1.02, .98], [1, 0, 1, 1]]), x.T(1500)],
      ['.k-handle', x.lag(18), x.T(1600)],
      ['.k-arm--l', x.lag(-24), x.T(1600)],
      ['.k-arm--r', x.lag(24), x.T(1600)],
      ['.k-shadow', [x.k(0, 'scale(1)', 1), x.k(.5, 'scale(1)', 1), x.k(.58, 'scale(.7)', .6), x.k(.68, 'scale(1.12)', 1), x.k(1, 'scale(1)', 1)], x.T(1500)]
    ]);

    k = M.create(el.firstChild, { pose: 'sleeping', mood: 'still', size: el.firstChild.style.width, tappable: false });
    // Two frames so the drawing is on screen before the splash leaves.
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      ET.splashHide();
      setTimeout(function () {
        if (gone) return;
        k.pose('neutral', false);
        k.play('wake').then(function () {
          if (gone) return;
          k.moment('welcome');
          setTimeout(done, 650);
        });
      }, 300);
    }); });
  });

  return { done: done };
});
