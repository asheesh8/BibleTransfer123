/* ============================================================================
   ET.mascot: Kandili, the lantern, drawn and brought to life.

   Depends on: core.js (the module registry) and css/components/mascot.css for the
   looping moods. Classic script on window.ET, runs on file://.

   HOW IT IS BUILT
   Flat art cut into SVG groups, nested like a puppet rig: the body carries
   cap, glass, face and base; handle, flame and arms hang off it on their own
   pivots. A pose swaps parts, a move is Web Animations, a mood is a CSS loop
   on data-mood. Only transform and opacity animate, and there is no Lottie
   or Rive runtime. See docs/decisions/0003-mascot-cutout-svg.md.

   HOW IT MOVES
   Every move uses the classic principles: anticipation (a crouch before a
   jump), squash and stretch that keeps volume, follow-through (handle,
   flame and arms lag and settle after the body), overshoot, and an idle
   whose layers never line up the same way twice, with blinks and glances.

   Features never animate parts themselves. They call one of:

     var k = ET.mascot.create(el, { pose: 'hello', mood: 'idle', size: '8rem' });
     k.moment('saved');        // pose + move + mood for a moment in the app
     k.play('hop');            // one move; returns a Promise
     k.pose('offline');        // swap the drawing, no motion
     k.mood('doze');           // change the loop
     k.destroy();

     ET.mascot.markup('share', { size: 48 })   // a still SVG string
     ET.mascot.mount(document)                  // upgrade every [data-kandili]

   The drawing follows Ashish's final ChatGPT art (brand/mascot in the
   project files).
   ========================================================================= */

window.ET.module('brand/mascot', ['core'], function (ET) {
  'use strict';

  /* Fixed palette: Kandili looks the same in light and dark. Mirrors the
     --et-k-* tokens in css/tokens.css (a test keeps them equal). */
  var C = {
    brass: '#E8A317', mid: '#D4920F', shade: '#B87D06', glass: '#FDF3DC',
    shine: '#FFFBF2', face: '#3A1650', glow: '#FFE7A3', blush: '#F4A38C',
    tongue: '#E8664F', go: '#3FA65C', sky: '#2E86AB', card: '#6B2E86',
    fire: '#F28C1C', gold: '#FFC93C', warm: '#F6DFAE'
  };

  // ------------------------------------------------------------------ parts
  // Stage frame: the lantern stands on y = 120, the glass is centred on the
  // origin, and the viewer's right is +x. Flat fills with one darker tone
  // per part for volume, no outlines, no gradients.
  var f = function (c) { return ' fill="' + c + '"'; };
  var line = function (c, w) { return ' stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" fill="none"'; };
  var W = '#fff';

  // The ring swings from its neck, which sits on the cap.
  var HANDLE = '<g class="k-handle">' +
    '<rect x="-5" y="-142" width="10" height="30" rx="5"' + f(C.mid) + '/>' +
    '<circle cx="0" cy="-160" r="19"' + line(C.mid, 9) + '/>' +
    '<path d="M-13,-172 A17,17 0 0 1 4,-177"' + line(C.brass, 3) + '/></g>';

  // Three tongues of fire, each flickering on its own beat (see the CSS).
  var FLAME_OUT = 'M0,-180 C-6,-164 -26,-152 -25,-133 C-24,-117 -13,-110 0,-110 C13,-110 24,-117 25,-133 C26,-148 15,-154 13,-166 C8,-158 6,-152 4,-150 C4,-162 2,-172 0,-180z';
  var FLAME_MID = 'M0,-160 C-5,-150 -17,-142 -16,-130 C-15,-120 -8,-115 0,-115 C8,-115 15,-120 16,-130 C17,-142 6,-148 0,-160z';
  var FLAME_IN = 'M0,-144 C-4,-137 -9,-132 -8,-125 C-7,-120 -4,-118 0,-118 C4,-118 7,-120 8,-125 C9,-132 4,-137 0,-144z';
  var flame = function (k) {
    var body = '<path class="k-fire" d="' + FLAME_OUT + '"' + f(C.fire) + '/>' +
               '<path class="k-fire-mid" d="' + FLAME_MID + '"' + f(C.gold) + '/>' +
               '<path class="k-fire-in" d="' + FLAME_IN + '"' + f(C.shine) + '/>';
    return k === 1 ? body : '<g transform="translate(0,-110) scale(' + k + ') translate(0,110)">' + body + '</g>';
  };
  var FLAME = {
    normal: flame(1),
    tall:   flame(1.25),
    small:  flame(.62),
    ember:  '<ellipse cx="0" cy="-116" rx="8" ry="6"' + f(C.fire) + '/><ellipse cx="0" cy="-117" rx="4" ry="3"' + f(C.gold) + '/>'
  };

  var CAP =
    '<rect x="-34" y="-118" width="68" height="14" rx="7"' + f(C.mid) + '/>' +
    '<path d="M-48,-74 V-94 Q-48,-106 -36,-106 H36 Q48,-106 48,-94 V-74z"' + f(C.brass) + '/>' +
    '<path d="M30,-106 H36 Q48,-106 48,-94 V-74 H32z"' + f(C.mid) + '/>' +
    '<rect x="-26" y="-99" width="9" height="17" rx="4.5"' + f(C.shade) + '/>' +
    '<rect x="-4.5" y="-99" width="9" height="17" rx="4.5"' + f(C.shade) + '/>' +
    '<rect x="17" y="-99" width="9" height="17" rx="4.5"' + f(C.shade) + '/>' +
    '<rect x="-74" y="-78" width="148" height="20" rx="10"' + f(C.mid) + '/>' +
    '<rect x="-66" y="-76" width="118" height="6" rx="3"' + f(C.brass) + '/>';

  // A rounded barrel of glass between two bowed brass guards.
  var GLASS =
    '<path d="M-38,-62 H38 Q52,-62 56,-48 Q66,-12 66,22 Q66,60 58,70 Q54,76 44,76 H-44 Q-54,76 -58,70 Q-66,60 -66,22 Q-66,-12 -56,-48 Q-52,-62 -38,-62z"' + f(C.glass) + '/>' +
    '<path d="M-65,42 Q0,58 65,42 Q64,62 58,70 Q54,76 44,76 H-44 Q-54,76 -58,70 Q-64,62 -65,42z"' + f(C.warm) + '/>' +
    '<path d="M-42,-50 Q-52,-16 -54,24"' + line(C.shine, 8) + '/>' +
    '<circle cx="-52" cy="40" r="4"' + f(C.shine) + '/>' +
    '<path d="M-56,-66 Q-92,2 -76,80 M56,-66 Q92,2 76,80"' + line(C.brass, 14) + '/>' +
    '<path d="M70,-36 Q86,8 80,64"' + line(C.mid, 5) + '/>' +
    '<circle cx="-84" cy="0" r="10"' + f(C.mid) + '/><circle cx="84" cy="0" r="10"' + f(C.mid) + '/>' +
    '<circle cx="-85" cy="-2" r="4.5"' + f(C.brass) + '/><circle cx="83" cy="-2" r="4.5"' + f(C.brass) + '/>';

  // What shows through the glass when Kandili turns its back (twirl).
  var BACK = '<g class="k-back" opacity="0"><path d="M0,-34 C-14,-12 -26,2 -24,22 C-22,40 -10,48 0,48 C10,48 22,40 24,22 C26,2 14,-12 0,-34z"' + f(C.warm) + '/>' +
             '<path d="M0,-6 C-6,6 -11,14 -10,24 C-9,32 -4,36 0,36 C4,36 9,32 10,24 C11,14 6,6 0,-6z"' + f(C.glow) + '/></g>';

  var BASE =
    '<ellipse cx="-31" cy="114" rx="25" ry="13"' + f(C.mid) + '/><ellipse cx="31" cy="114" rx="25" ry="13"' + f(C.mid) + '/>' +
    '<ellipse cx="-33" cy="109" rx="14" ry="5"' + f(C.brass) + '/><ellipse cx="29" cy="109" rx="14" ry="5"' + f(C.brass) + '/>' +
    '<rect x="-67" y="88" width="134" height="20" rx="10"' + f(C.mid) + '/>' +
    '<rect x="-82" y="68" width="164" height="25" rx="12.5"' + f(C.brass) + '/>' +
    '<path d="M46,68 H69.5 Q82,68 82,80.5 Q82,93 69.5,93 H46z"' + f(C.mid) + '/>' +
    '<path d="M-68,76 H32"' + line(C.shine, 3.5) + ' opacity=".55"/>';

  var CHEEKS = '<ellipse cx="-47" cy="30" rx="10" ry="6"' + f(C.blush) + ' opacity=".8"/>' +
               '<ellipse cx="47" cy="30" rx="10" ry="6"' + f(C.blush) + ' opacity=".8"/>';

  // The little flame left on the ground when Kandili flies off to a friend.
  var EMBER = '<path d="M0,86 C-10,100 -9,110 0,115 C9,110 10,100 0,86z"' + f(C.fire) + '/>' +
              '<path d="M0,98 C-4,104 -4,109 0,112 C4,109 4,104 0,98z"' + f(C.gold) + '/>';

  // Big glossy eyes: a pupil, a large catch-light and a small bounce light.
  // EYES[name] = [the part that blinks, brows that stay put].
  var pupils = function (dx, dy, rx, ry) {
    var e = function (x) {
      return '<ellipse cx="' + (x + dx) + '" cy="' + (8 + dy) + '" rx="' + rx + '" ry="' + ry + '"' + f(C.face) + '/>' +
             '<circle cx="' + (x + dx + 5) + '" cy="' + (dy) + '" r="5.8"' + f(W) + '/>' +
             '<circle cx="' + (x + dx - 4.5) + '" cy="' + (dy + 16) + '" r="2.5"' + f(W) + '/>';
    };
    return e(-26) + e(26);
  };
  var brows = function (d) { return '<path d="' + d + '"' + line(C.face, 3.2) + '/>'; };
  var EYES = {
    open:    [pupils(0, 0, 14, 18), brows('M-38,-17 Q-27,-25 -15,-18 M15,-18 Q27,-25 38,-17')],
    up:      [pupils(0, -3, 14, 18), brows('M-38,-22 Q-27,-31 -15,-24 M15,-24 Q27,-31 38,-22')],
    side:    [pupils(6, 0, 14, 18), brows('M-38,-15 Q-27,-22 -15,-16 M15,-21 Q27,-29 38,-21')],
    happy:   ['<path d="M-40,14 Q-26,-6 -12,14 M12,14 Q26,-6 40,14"' + line(C.face, 6.5) + '/>', ''],
    sleepy:  ['<path d="M-40,7 H-12 M12,7 H40"' + line(C.face, 4.5) + '/>' +
              '<path d="M-39,8 Q-26,26 -13,8z M13,8 Q26,26 39,8z"' + f(C.face) + '/>', ''],
    closed:  ['<path d="M-40,9 Q-26,22 -12,9 M12,9 Q26,22 40,9"' + line(C.face, 5.5) + '/>', ''],
    worried: [pupils(0, 3, 13, 16.5), brows('M-40,-9 L-16,-21 M40,-9 L16,-21')]
  };

  var MOUTH = {
    smile:  '<path d="M-10,33 Q0,43 10,33"' + line(C.face, 4.6) + '/>',
    open:   '<path d="M-13,30 H13 Q12,50 0,50 Q-12,50 -13,30z"' + f(C.face) + '/>' +
            '<path d="M-7,43 Q0,38 7,43 Q5,49 0,49 Q-5,49 -7,43z"' + f(C.tongue) + '/>',
    o:      '<ellipse cx="0" cy="39" rx="5.5" ry="7"' + f(C.face) + '/>',
    wobble: '<path d="M-13,39 Q-7,32 0,38 Q7,44 13,37"' + line(C.face, 4) + '/>',
    flat:   '<path d="M-9,38 H9"' + line(C.face, 4.2) + '/>',
    tiny:   '<ellipse cx="0" cy="39" rx="3.6" ry="3"' + f(C.face) + '/>'
  };

  // A mitten hanging from the shoulder at (0, 0); the pose turns it. The
  // .k-arm group pivots on the shoulder, so swings and follow-through act
  // from there. k-arm--r is the arm on the viewer's right, the one that waves.
  var arm = function (side, deg) {
    var s = side === 'r' ? 1 : -1, n = function (v) { return s * v; };
    return '<g transform="translate(' + n(82) + ',30)"><g class="k-arm k-arm--' + side + '">' +
      '<g transform="rotate(' + n(deg) + ')">' +
      '<path d="M' + n(-9) + ',-6 C' + n(10) + ',-10 ' + n(24) + ',8 ' + n(23) + ',30 C' + n(22) + ',48 ' + n(6) + ',54 ' +
        n(-4) + ',46 C' + n(-14) + ',38 ' + n(-18) + ',10 ' + n(-9) + ',-6z"' + f(C.brass) + ' stroke="' + C.mid + '" stroke-width="3"/>' +
      '<path d="M' + n(22) + ',22 C' + n(24) + ',40 ' + n(12) + ',52 ' + n(0) + ',48"' + line(C.mid, 6) + '/>' +
      '<ellipse cx="' + n(-10) + '" cy="32" rx="7" ry="9.5"' + f(C.mid) + '/></g></g></g>';
  };
  // Degrees each arm turns from hanging down: [viewer's left, viewer's right].
  var ARMS = {
    none:  [14, 14],
    rest:  [14, 14],
    wave:  [14, -150],
    cheer: [-160, -160],
    think: [14, -172],
    hold:  [50, 50]
  };

  // Props are held in both hands, centred low on the glass, so a mirrored
  // pose still offers with both hands and nothing points one way.
  var PROP = {
    none: '',
    play: '<circle cx="0" cy="62" r="23"' + f(C.go) + '/><path d="M-7,51 L12,62 L-7,73z"' + f(W) + '/>',
    card: '<rect x="-27" y="42" width="54" height="40" rx="9"' + f(C.card) + '/>' +
          '<path d="M0,50 V70 M-9,61 L0,70 L9,61"' + line(W, 4.4) + '/>',
    flame: '<circle cx="0" cy="62" r="22"' + f(C.glow) + ' opacity=".85"/>' +
           '<path d="M0,40 C-11,52 -13,62 -10,69 C-7,76 7,76 10,69 C13,62 11,52 0,40z"' + f(C.fire) + '/>' +
           '<path d="M0,54 C-5,60 -6,65 -4,69 C-2,72 2,72 4,69 C6,65 5,60 0,54z"' + f(C.gold) + '/>'
  };

  var SPARK = 'M0,-14 Q1.5,-1.5 14,0 Q1.5,1.5 0,14 Q-1.5,1.5 -14,0 Q-1.5,-1.5 0,-14z';
  var sparkle = function (x, y, s, c) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')"><g class="k-spark">' +
           '<path d="' + SPARK + '"' + f(c || C.gold) + '/></g></g>';
  };
  var FX = {
    none: '',
    sparkles: sparkle(-118, -128, 1.1) + sparkle(124, -146, .85, C.brass) + sparkle(-136, 30, .65, C.brass) +
              sparkle(140, 20, .8) + sparkle(-96, -176, .55),
    bubbles: '<circle class="k-bubble" cx="62" cy="-120" r="7"' + f(C.sky) + '/>' +
             '<circle class="k-bubble" cx="76" cy="-136" r="5"' + f(C.sky) + '/>' +
             '<circle class="k-bubble" cx="68" cy="-150" r="4"' + f(C.sky) + '/>'
  };

  // ------------------------------------------------------------------ poses
  // One row per moment in the Kandili brief, section 5.
  var POSES = {
    neutral:  { eyes: 'open',    mouth: 'smile',  flame: 'normal', arms: 'none',  prop: 'none',  fx: 'none',     glow: 1 },
    hello:    { eyes: 'up',      mouth: 'open',   flame: 'normal', arms: 'wave',  prop: 'none',  fx: 'none',     glow: 1 },
    play:     { eyes: 'happy',   mouth: 'open',   flame: 'tall',   arms: 'hold',  prop: 'play',  fx: 'none',     glow: 1.1 },
    saved:    { eyes: 'happy',   mouth: 'smile',  flame: 'normal', arms: 'hold',  prop: 'card',  fx: 'none',     glow: 1.15 },
    share:    { eyes: 'open',    mouth: 'smile',  flame: 'normal', arms: 'hold',  prop: 'flame', fx: 'none',     glow: 1 },
    waiting:  { eyes: 'sleepy',  mouth: 'o',      flame: 'small',  arms: 'none',  prop: 'none',  fx: 'bubbles',  glow: .7,  tilt: -4 },
    offline:  { eyes: 'worried', mouth: 'wobble', flame: 'small',  arms: 'none',  prop: 'none',  fx: 'none',     glow: .55 },
    hooray:   { eyes: 'happy',   mouth: 'open',   flame: 'tall',   arms: 'cheer', prop: 'none',  fx: 'sparkles', glow: 1.2 },
    thinking: { eyes: 'side',    mouth: 'flat',   flame: 'normal', arms: 'think', prop: 'none',  fx: 'none',     glow: .9 },
    sleeping: { eyes: 'closed',  mouth: 'tiny',   flame: 'ember',  arms: 'none',  prop: 'none',  fx: 'bubbles',  glow: .4 }
  };

  // ------------------------------------------------------------------ moves
  // Each is a list of [selector, keyframes, options], under 1.4 s, never
  // blocking a tap. k(offset, transform[, opacity]) builds one keyframe.
  var k = function (o, t, op) { var r = { offset: o, transform: t }; if (op != null) r.opacity = op; return r; };
  var E = {
    out: 'cubic-bezier(.2,.8,.2,1)',          // fast start, soft landing
    inout: 'cubic-bezier(.65,0,.35,1)',
    spring: 'cubic-bezier(.34,1.56,.64,1)'   // overshoots, then settles
  };
  var rs = function (a) { return a.map(function (x) { return k(x[0], 'rotate(' + x[1] + 'deg) scale(' + x[2] + ',' + x[3] + ')'); }); };
  var sc = function (a) { return a.map(function (x) { return k(x[0], 'scale(' + x[1] + ',' + x[2] + ')'); }); };
  var fall = function (fr) { fr.easing = 'cubic-bezier(.5,0,.8,.4)'; return fr; };   // gravity
  var T = function (d, e) { return { duration: d, easing: e || 'linear' }; };

  // The body's squash-and-stretch jump, shared by hop and twirl. Volume is
  // kept: when it is wider it is shorter.
  var jump = function (h, spin) {
    var t = function (o, y, sx, sy) { return k(o, 'translateY(' + y + 'px) scale(' + sx + ',' + sy + ')'); };
    // With spin, x scale runs through -1: a flat flip, the back shown midway.
    return [t(0, 0, 1, 1), t(.16, 0, 1.14, .84), t(.32, -h * .7, .88, 1.14), t(.46, -h, spin ? -1 : 1, 1),
            t(.66, -4, .94, 1.08), t(.74, 0, 1.18, .8), t(.86, 0, .95, 1.05), t(.94, 0, 1.02, .98), t(1, 0, 1, 1)];
  };
  // Parts that hang off the body lag it: they swing up as it falls and
  // settle a beat after it lands.
  var lag = function (amp) {
    var at = [0, .18, .34, .5, .7, .82, .92, 1], by = [0, -.4, 1, -.3, -1, .6, -.25, 0];
    return at.map(function (o, i) { return k(o, 'rotate(' + by[i] * amp + 'deg)'); });
  };
  var flameTrail = sc([[0, 1, 1], [.16, 1.15, .85], [.32, .8, 1.25], [.48, 1.1, .9], [.68, .85, 1.3], [.76, 1.25, .75], [.9, .95, 1.06], [1, 1, 1]]);
  // The face hides while the lantern faces away mid-spin; the back shows.
  var turn = function (a) {
    return [[0, a], [.38, a], [.4, 1 - a], [.54, 1 - a], [.56, a], [1, a]].map(function (x) { return { offset: x[0], opacity: x[1] }; });
  };
  var shadowJump = [
    k(0, 'scale(1)', 1), k(.16, 'scale(1.1)', 1), k(.46, 'scale(.55)', .45),
    k(.74, 'scale(1.12)', 1), k(1, 'scale(1)', 1)
  ];

  var MOVES = {
    hop: [
      ['.k-body', jump(46), T(760)],
      ['.k-handle', lag(16), T(900)],
      ['.k-flame', flameTrail, T(760)],
      ['.k-arm--l', lag(-22), T(860)],
      ['.k-arm--r', lag(22), T(860)],
      ['.k-shadow', shadowJump, T(760)]
    ],
    twirl: [
      ['.k-body', jump(64, true), T(1100)],
      // The back view: the face goes while the lantern faces away.
      ['.k-face', turn(1), T(1100)],
      ['.k-back', turn(0), T(1100)],
      ['.k-handle', lag(20), T(1250)],
      ['.k-flame', flameTrail, T(1100)],
      ['.k-arm--l', lag(-26), T(1200)],
      ['.k-arm--r', lag(26), T(1200)],
      ['.k-shadow', shadowJump, T(1100)],
      ['.k-spark', [
        k(0, 'scale(0) rotate(0)', 0), k(.62, 'scale(0) rotate(0)', 0),
        k(.8, 'scale(1.5) rotate(90deg)', 1), k(1, 'scale(1) rotate(180deg)', 1)
      ], T(1100)]
    ],
    fly: [
      // Crouch, launch like a sky lantern, sway up and away, then drop back
      // in from above and land with a squash.
      ['.k-fly', [[0, 0, 0, 0, 1], [.1, 0, 6, 0, 1], [.3, -8, -80, -7, 1], [.46, 10, -170, 6, 1],
                  [.56, 0, -240, -3, 0], [.66, 0, -160, 0, 0], [.8, 0, -20, 0, 1], [.86, 0, 0, 0, 1], [1, 0, 0, 0, 1]].map(function (x) {
        return k(x[0], 'translate(' + x[1] + 'px,' + x[2] + 'px) rotate(' + x[3] + 'deg)', x[4]);
      }), T(1400)],
      ['.k-body', sc([[0, 1, 1], [.1, 1.14, .84], [.22, .88, 1.14], [.4, 1, 1], [.8, .92, 1.1], [.86, 1.18, .8], [.94, .96, 1.04], [1, 1, 1]]), T(1400)],
      ['.k-flame', sc([[0, 1, 1], [.1, 1.1, .9], [.3, .75, 1.45], [.5, .8, 1.35], [.8, .9, 1.2], [.88, 1.2, .8], [1, 1, 1]]), T(1400)],
      ['.k-arm--l', lag(-26), T(1400)],
      ['.k-arm--r', lag(26), T(1400)],
      ['.k-shadow', [
        k(0, 'scale(1)', 1), k(.12, 'scale(1.1)', 1), k(.4, 'scale(.2)', 0),
        k(.76, 'scale(.4)', .3), k(.86, 'scale(1.12)', 1), k(1, 'scale(1)', 1)
      ], T(1400)],
      // The little flame left behind on the ground, rising as it fades.
      ['.k-ember', [
        k(0, 'translateY(0) scale(.3)', 0), k(.22, 'translateY(0) scale(1.15)', 1),
        k(.3, 'translateY(0) scale(1)', 1), k(.62, 'translateY(-10px) scale(1)', 1),
        k(.76, 'translateY(-18px) scale(.5)', 0), k(1, 'translateY(0) scale(.3)', 0)
      ], T(1400)]
    ],
    wave: [
      // A small dip first, then the body leans into each swing of the arm.
      ['.k-arm--r', [
        k(0, 'rotate(0)'), k(.1, 'rotate(10deg)'), k(.24, 'rotate(-26deg)'), k(.38, 'rotate(18deg)'),
        k(.52, 'rotate(-24deg)'), k(.66, 'rotate(16deg)'), k(.8, 'rotate(-10deg)'), k(.9, 'rotate(4deg)'), k(1, 'rotate(0)')
      ], T(1200, E.inout)],
      ['.k-body', rs([[0, 0, 1, 1], [.1, 0, 1.05, .95], [.24, 3, .98, 1.03], [.38, -1.5, 1, 1], [.52, 3, .99, 1.02], [.66, -1.5, 1, 1], [.82, 1.5, 1, 1], [1, 0, 1, 1]]), T(1200, E.inout)],
      ['.k-handle', lag(8), T(1300)],
      ['.k-flame', [
        k(0, 'rotate(0)'), k(.24, 'rotate(-7deg)'), k(.38, 'rotate(5deg)'), k(.52, 'rotate(-7deg)'),
        k(.66, 'rotate(5deg)'), k(.82, 'rotate(-3deg)'), k(1, 'rotate(0)')
      ], T(1200, E.inout)]
    ],
    glow: [
      // The card drops in; Kandili catches it with a squash and a happy
      // wiggle while the light swells.
      ['.k-prop', [
        k(0, 'translateY(-150px) scale(.6)', 0), fall(k(.18, 'translateY(-150px) scale(.6)', 1)),
        k(.48, 'translateY(6px) scale(1.08,.92)', 1), k(.6, 'translateY(-4px) scale(.97,1.03)', 1),
        k(.72, 'translateY(0) scale(1)', 1), k(1, 'translateY(0) scale(1)', 1)
      ], T(1100)],
      ['.k-body', rs([[0, 0, 1, 1], [.44, 0, 1, 1], [.52, 0, 1.1, .88], [.62, -3, .97, 1.04], [.72, 3, 1, 1], [.82, -2, 1, 1], [.92, 1, 1, 1], [1, 0, 1, 1]]), T(1100)],
      ['.k-glowwrap', [
        k(0, 'scale(1)', 1), k(.5, 'scale(1)', 1), k(.7, 'scale(1.45)', .2),
        k(1, 'scale(1)', 1)
      ], T(1100)],
      ['.k-flame', [
        k(0, 'scale(1)'), k(.5, 'scale(1)'), k(.62, 'scale(1.3,1.35)'), k(.8, 'scale(.95)'), k(1, 'scale(1)')
      ], T(1100)]
    ],
    nod: [
      // A tap: squish down, spring back, a giggle of a wiggle.
      ['.k-body', rs([[0, 0, 1, 1], [.2, 0, 1.12, .86], [.42, 0, .95, 1.06], [.56, -3, 1, 1], [.7, 3, 1, 1], [.84, -1.5, 1, 1], [1, 0, 1, 1]]), T(620)],
      ['.k-handle', lag(10), T(760)],
      ['.k-flame', sc([[0, 1, 1], [.2, 1.2, .8], [.42, .88, 1.2], [.7, 1.04, .97], [1, 1, 1]]), T(620)]
    ],
    dim: [
      // The flame gutters: a shiver, a shrink, and the light drops.
      ['.k-flame', [
        k(0, 'scale(1.35) rotate(0)', 1), k(.2, 'scale(1.1) rotate(-8deg)', .9),
        k(.4, 'scale(.9) rotate(6deg)', .7), k(.6, 'scale(1) rotate(-3deg)', .85),
        k(1, 'scale(1) rotate(0)', .85)
      ], T(700, E.out)],
      ['.k-body', sc([[0, 1, 1], [.3, 1.04, .95], [1, 1, 1]]), T(700, E.out)],
      ['.k-glowwrap', [{ opacity: 1 }, { opacity: .4 }], T(500, E.out)]
    ]
  };

  var MOODS = ['idle', 'doze', 'dim', 'think', 'still'];

  // Moments: what features ask for. Pose, then the move, then the loop.
  var MOMENTS = {
    welcome:  { pose: 'hello',    move: 'wave',  mood: 'idle' },
    play:     { pose: 'play',     move: 'hop',   mood: 'idle' },
    saved:    { pose: 'saved',    move: 'glow',  mood: 'idle' },
    shared:   { pose: 'share',    move: 'fly',   mood: 'idle' },
    milestone:{ pose: 'hooray',   move: 'twirl', mood: 'idle' },
    loading:  { pose: 'waiting',  move: null,    mood: 'doze' },
    offline:  { pose: 'offline',  move: 'dim',   mood: 'dim' },
    notfound: { pose: 'thinking', move: null,    mood: 'think' },
    empty:    { pose: 'sleeping', move: null,    mood: 'doze' },
    ready:    { pose: 'saved',    move: 'hop',   mood: 'idle' },
    tap:      { pose: null,       move: 'nod',   mood: null }
  };
  // The mood names in decision record 0003, kept as aliases.
  var ALIASES = { idle: 'welcome', wave: 'welcome', cheer: 'milestone', fly: 'shared',
                  think: 'notfound', sad: 'offline', sleep: 'empty' };

  // ----------------------------------------------------------------- motion
  ET.motion = ET.motion || {
    reduced: function () {
      var forced = document.documentElement.getAttribute('data-motion');
      if (forced === 'reduce') return true;
      if (forced === 'full') return false;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  };

  // ----------------------------------------------------------------- markup
  function inner(p) {
    var arms = ARMS[p.arms] || ARMS.none;
    var eyes = EYES[p.eyes];
    var tilt = p.tilt ? ' transform="rotate(' + p.tilt + ' 0 120)"' : '';
    return '<g class="k-mirror">' +
      '<ellipse class="k-shadow" cx="0" cy="126" rx="80" ry="9"' + f(C.face) + ' fill-opacity=".14"/>' +
      '<g class="k-ember" opacity="0">' + EMBER + '</g>' +
      '<g class="k-fly"><g class="k-float">' +
        '<g class="k-glowwrap"><circle class="k-glow" cx="0" cy="-20" r="' + Math.round(124 * p.glow) + '"' + f(C.glow) + ' opacity=".24"/>' +
          '<circle cx="0" cy="-138" r="40"' + f(C.glow) + ' opacity=".5"/></g>' +
        '<g class="k-tilt"><g' + tilt + '><g class="k-body">' +
          HANDLE +
          '<g class="k-flame">' + FLAME[p.flame] + '</g>' +
          CAP + GLASS + BACK +
          '<g class="k-face">' + CHEEKS +
            '<g class="k-look"><g class="k-eyes">' + eyes[0] + '</g>' + eyes[1] + '</g>' +
            '<g class="k-mouth">' + MOUTH[p.mouth] + '</g>' +
          '</g>' +
          BASE +
          '<g class="k-prop">' + PROP[p.prop] + '</g>' +
          arm('l', arms[0]) + arm('r', arms[1]) +
        '</g></g></g>' +
      '</g></g>' +
      '<g class="k-fx">' + FX[p.fx] + '</g>' +
    '</g>';
  }

  function resolvePose(name) { return POSES[name] ? name : 'neutral'; }

  function markup(pose, opts) {
    opts = opts || {};
    var name = resolvePose(pose);
    var size = opts.size == null ? '' : (typeof opts.size === 'number' ? opts.size + 'px' : opts.size);
    var a11y = opts.label
      ? ' role="img" aria-label="' + String(opts.label).replace(/[&<>"]/g, '') + '"'
      : ' aria-hidden="true" focusable="false"';
    return '<svg class="et-kandili" viewBox="-160 -200 320 340" xmlns="http://www.w3.org/2000/svg"' +
      ' data-pose="' + name + '" data-mood="' + (opts.mood || 'still') + '"' +
      (size ? ' style="--k-size:' + size + '"' : '') + a11y + '>' +
      inner(POSES[name]) + '</svg>';
  }

  // ---------------------------------------------------------- the instance
  function Kandili(host, opts) {
    opts = opts || {};
    this.host = host;
    this.host.innerHTML = markup(opts.pose || 'neutral', { size: opts.size, label: opts.label, mood: 'still' });
    this.svg = this.host.firstChild;
    if (opts.tappable) {
      this.svg.classList.add('is-tappable');
      var self = this;
      this.svg.addEventListener('click', function () { self.play('nod'); });
    }
    this._running = [];
    this._blink = null;
    this._glance = null;
    this._watch();
    this.mood(opts.mood || 'idle');
  }

  Kandili.prototype.pose = function (name) {
    name = resolvePose(name);
    this.svg.setAttribute('data-pose', name);
    this.svg.innerHTML = inner(POSES[name]);
    return this;
  };

  Kandili.prototype.mood = function (name) {
    if (MOODS.indexOf(name) === -1) name = 'idle';
    this.svg.setAttribute('data-mood', name);
    this._scheduleBlink(name === 'idle' || name === 'think');
    this._scheduleGlance(name === 'idle');
    return this;
  };

  // Plays one move. Resolves when it ends (at once under reduced motion,
  // where the pose simply shows). A new move cancels the one before it.
  Kandili.prototype.play = function (name) {
    var steps = MOVES[name], svg = this.svg, self = this;
    this._cancel();
    if (!steps || ET.motion.reduced() || !svg.animate) return Promise.resolve(this);
    var players = [];
    steps.forEach(function (step) {
      var els = svg.querySelectorAll(step[0]);
      for (var i = 0; i < els.length; i++) players.push(els[i].animate(step[1], step[2]));
    });
    this._running = players;
    return Promise.all(players.map(function (p) {
      return p.finished ? p.finished.catch(function () {}) : new Promise(function (r) { p.onfinish = r; });
    })).then(function () { return self; });
  };

  Kandili.prototype.moment = function (name) {
    var m = MOMENTS[name] || MOMENTS[ALIASES[name]];
    if (!m) return Promise.resolve(this);
    if (m.pose) this.pose(m.pose);
    if (m.mood) this.mood(m.mood);
    return m.move ? this.play(m.move) : Promise.resolve(this);
  };

  Kandili.prototype.destroy = function () {
    this._cancel();
    clearTimeout(this._blink);
    clearTimeout(this._glance);
    if (this._io) this._io.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this.host.innerHTML = '';
  };

  Kandili.prototype._cancel = function () {
    this._running.forEach(function (p) { try { p.cancel(); } catch (e) { /* already gone */ } });
    this._running = [];
  };

  Kandili.prototype._idle = function () { return !ET.motion.reduced() && !this._paused && !this._running.length; };

  // Blinks at a random 2.5 to 6 s, one time in four a double blink; never
  // under reduced motion, never while paused.
  Kandili.prototype._scheduleBlink = function (on) {
    var self = this;
    clearTimeout(this._blink);
    if (!on) return;
    this._blink = setTimeout(function () {
      var eyes = self.svg.querySelector('.k-eyes');
      if (eyes && eyes.animate && !ET.motion.reduced() && !self._paused) {
        var once = [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)', offset: .45 }, { transform: 'scaleY(1)' }];
        var twice = [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)', offset: .2 }, { transform: 'scaleY(1)', offset: .42 },
                     { transform: 'scaleY(.08)', offset: .66 }, { transform: 'scaleY(1)' }];
        var double = Math.random() < .25;
        eyes.animate(double ? twice : once, { duration: double ? 380 : 170, easing: 'ease-in-out' });
      }
      self._scheduleBlink(true);
    }, 2500 + Math.random() * 3500);
  };

  // Now and then a curious look to one side, so the idle never loops.
  Kandili.prototype._scheduleGlance = function (on) {
    var self = this;
    clearTimeout(this._glance);
    if (!on) return;
    this._glance = setTimeout(function () {
      var look = self.svg.querySelector('.k-look');
      if (look && look.animate && self._idle()) {
        var dx = (Math.random() < .5 ? -1 : 1) * 5;
        look.animate([
          k(0, 'translate(0,0)'), k(.15, 'translate(' + dx + 'px,-1px)'), k(.8, 'translate(' + dx + 'px,-1px)'), k(1, 'translate(0,0)')
        ], { duration: 1600, easing: E.inout });
      }
      self._scheduleGlance(true);
    }, 5000 + Math.random() * 5000);
  };

  // Loops cost battery. Pause them off screen and in a hidden tab.
  Kandili.prototype._watch = function () {
    var self = this;
    var set = function (paused) { self._paused = paused; self.svg.classList.toggle('is-paused', paused); };
    this._onVis = function () { set(document.hidden || self._offscreen); };
    document.addEventListener('visibilitychange', this._onVis);
    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver(function (entries) {
        self._offscreen = !entries[0].isIntersecting;
        self._onVis();
      });
      this._io.observe(this.host);
    }
  };

  // ------------------------------------------------------------------ mount
  // <div data-kandili data-pose="hello" data-mood="idle" data-size="8rem"
  //      data-moment="welcome" data-label="…"></div>
  function mount(root) {
    var els = (root || document).querySelectorAll('[data-kandili]:not([data-kandili-on])');
    var made = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.setAttribute('data-kandili-on', '');
      var kd = new Kandili(el, {
        pose: el.getAttribute('data-pose') || 'neutral',
        mood: el.getAttribute('data-mood') || 'idle',
        size: el.getAttribute('data-size') || null,
        label: el.getAttribute('data-label') || '',
        tappable: el.hasAttribute('data-tappable')
      });
      el.kandili = kd;
      if (el.getAttribute('data-moment')) kd.moment(el.getAttribute('data-moment'));
      made.push(kd);
    }
    return made;
  }

  ET.mascot = {
    create: function (host, opts) { return new Kandili(host, opts); },
    markup: markup,
    mount: mount,
    POSES: Object.keys(POSES),
    MOVES: Object.keys(MOVES),
    MOODS: MOODS.slice(),
    MOMENTS: Object.keys(MOMENTS),
    COLORS: C
  };
  return ET.mascot;
});
