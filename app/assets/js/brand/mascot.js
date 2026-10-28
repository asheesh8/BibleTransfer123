/* ============================================================================
   ET.mascot: Kandili, the lantern, drawn and brought to life.

   Depends on: core.js (the module registry) and css/components/mascot.css for the
   looping moods. Classic script on window.ET, runs on file://.

   HOW IT IS BUILT
   The flat art is cut into parts (body, glass, flame, eyes, mouth, arms,
   prop) and each part is its own SVG group. A pose swaps parts; a move
   animates parts with the Web Animations API; a mood is a CSS loop keyed off
   data-mood. Only transform and opacity ever animate, so it stays smooth on
   a cheap Android phone, and nothing is downloaded: there is no Lottie or
   Rive runtime. See docs/decisions/0003-mascot-cutout-svg.md.

   Features never animate parts themselves. They call one of:

     var k = ET.mascot.create(el, { pose: 'hello', mood: 'idle', size: '8rem' });
     k.moment('saved');        // pose + move + mood for a moment in the app
     k.play('hop');            // one move; returns a Promise
     k.pose('offline');        // swap the drawing, no motion
     k.mood('doze');           // change the loop
     k.destroy();

     ET.mascot.markup('share', { size: 48 })   // a still SVG string
     ET.mascot.mount(document)                  // upgrade every [data-kandili]

   The parts are traced from Ashish's final ChatGPT art (brand/mascot in the
   project files). New art changes only the PART strings below; the API,
   poses, moves and moods stay.
   ========================================================================= */

window.ET.module('brand/mascot', ['core'], function (ET) {
  'use strict';

  /* Fixed palette: Kandili looks the same in light and dark. Mirrors the
     --et-k-* tokens in css/tokens.css (a test keeps them equal). */
  var C = {
    brass: '#E8A317', mid: '#D4920F', shade: '#B87D06', glass: '#FDF3DC',
    shine: '#FFFBF2', face: '#3A1650', glow: '#FFE7A3', blush: '#F4A38C',
    tongue: '#E8664F', go: '#3FA65C', sky: '#2E86AB', card: '#6B2E86'
  };

  // ------------------------------------------------------------------ parts
  // Traced from the final ChatGPT art (brand/mascot/png/poses): a ring
  // handle, a cap with three vents, a trapezoid glass between two frame bars,
  // a banded base on two feet, and chunky mitten arms in front of the body.
  // The body is drawn in the art's own 200 x 250 frame (centre x = 100,
  // ground y = 236) and ART places it in the stage frame, where the lantern
  // stands on (0, 120) with the glass near the origin. Effects, the glow and
  // the shadow are drawn in the stage frame.
  var ART = 'matrix(1.25 0 0 1.25 -125 -175)';
  var f = function (c) { return ' fill="' + c + '"'; };
  var line = function (c, w) { return ' stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"'; };

  var FLAME_PATHS = '<path d="M100,30 C88,42 84,52 88,62 C90,68 96,70 100,70 C104,70 110,68 112,62 C116,52 112,42 100,30z"' + f(C.brass) + '/>' +
                    '<path d="M100,44 C94,52 93,58 95,63 C96,66 98,67 100,67 C102,67 104,66 105,63 C107,58 106,52 100,44z"' + f(C.glow) + '/>';
  var sized = function (k) { return '<g transform="translate(100,70) scale(' + k + ') translate(-100,-70)">' + FLAME_PATHS + '</g>'; };
  var FLAME = {
    normal: FLAME_PATHS,
    tall:   sized(1.3),
    small:  sized(.6),
    ember:  '<ellipse cx="100" cy="66" rx="6" ry="4.5"' + f(C.shade) + '/>'
  };

  var HANDLE = '<circle cx="100" cy="16" r="12"' + line(C.mid, 7) + '/>';
  var CAP = '<rect x="78" y="62" width="44" height="10" rx="5"' + f(C.brass) + '/>' +
            '<rect x="70" y="70" width="60" height="20" rx="7"' + f(C.brass) + '/>' +
            '<rect x="80" y="75" width="6" height="10" rx="3"' + f(C.shade) + '/>' +
            '<rect x="97" y="75" width="6" height="10" rx="3"' + f(C.shade) + '/>' +
            '<rect x="114" y="75" width="6" height="10" rx="3"' + f(C.shade) + '/>' +
            '<rect x="60" y="88" width="80" height="11" rx="5.5"' + f(C.mid) + '/>';
  var GLASS = '<path d="M72,99 H128 Q136,99 138,108 L146,176 Q148,190 134,190 H66 Q52,190 54,176 L62,108 Q64,99 72,99z"' + f(C.glass) + '/>' +
              '<path d="M68,108 L62,170"' + line(C.shine, 6) + '/>' +
              '<path d="M64,96 Q52,140 50,186 M136,96 Q148,140 150,186"' + line(C.brass, 9) + '/>' +
              '<circle cx="51" cy="144" r="6"' + f(C.mid) + '/><circle cx="149" cy="144" r="6"' + f(C.mid) + '/>';
  var BASE = '<rect x="48" y="184" width="104" height="14" rx="7"' + f(C.brass) + '/>' +
             '<rect x="54" y="196" width="92" height="11" rx="5.5"' + f(C.mid) + '/>' +
             '<rect x="60" y="205" width="80" height="10" rx="5"' + f(C.brass) + '/>' +
             '<ellipse cx="80" cy="222" rx="15" ry="9"' + f(C.mid) + '/><ellipse cx="120" cy="222" rx="15" ry="9"' + f(C.mid) + '/>';
  var CHEEKS = '<ellipse cx="78" cy="160" rx="8" ry="5"' + f(C.blush) + ' opacity=".75"/>' +
               '<ellipse cx="122" cy="160" rx="8" ry="5"' + f(C.blush) + ' opacity=".75"/>';

  // The little flame left on the ground when Kandili flies off to a friend
  // (stage frame).
  var EMBER = '<path d="M0,88 C-9,100 -8,108 0,113 C8,108 9,100 0,88z"' + f(C.brass) + '/>' +
              '<path d="M0,99 C-3,104 -3,108 0,110 C3,108 3,104 0,99z"' + f(C.glow) + '/>';

  // Eyes blink (the first string); brows (the second) stay put.
  var pupils = function (dy, hx, hy, rx, ry) {
    return '<ellipse cx="85" cy="' + (142 + dy) + '" rx="' + rx + '" ry="' + ry + '"' + f(C.face) + '/>' +
           '<ellipse cx="115" cy="' + (142 + dy) + '" rx="' + rx + '" ry="' + ry + '"' + f(C.face) + '/>' +
           '<circle cx="' + (88 + hx) + '" cy="' + (138 + dy + hy) + '" r="3.2" fill="#fff"/>' +
           '<circle cx="' + (118 + hx) + '" cy="' + (138 + dy + hy) + '" r="3.2" fill="#fff"/>';
  };
  var brows = function (d) { return '<path d="' + d + '"' + line(C.face, 2.6) + '/>'; };
  var EYES = {
    open:    [pupils(0, 0, 0, 8, 10), brows('M78,124 Q85,119 92,123 M108,123 Q115,119 122,124')],
    up:      [pupils(-2, 0, -3, 8, 10), brows('M78,122 Q85,116 92,121 M108,121 Q115,116 122,122')],
    side:    [pupils(0, 2, 0, 8, 10), brows('M78,126 Q85,122 92,126 M108,123 Q115,118 122,122')],
    happy:   ['<path d="M77,144 Q85,132 93,144 M107,144 Q115,132 123,144"' + line(C.face, 4.5) + '/>', ''],
    sleepy:  ['<path d="M77,140 H93 M107,140 H123"' + line(C.face, 3) + '/>' +
              '<path d="M78,141 Q85,149 92,141 M108,141 Q115,149 122,141"' + f(C.face) + '/>', ''],
    closed:  ['<path d="M77,142 Q85,150 93,142 M107,142 Q115,150 123,142"' + line(C.face, 4) + '/>', ''],
    worried: [pupils(2, -1, 0, 7.5, 9), '<path d="M77,130 L92,125 M123,130 L108,125"' + line(C.face, 2.8) + '/>']
  };

  var MOUTH = {
    smile:  '<path d="M92,160 Q100,168 108,160"' + line(C.face, 3.4) + '/>',
    open:   '<path d="M90,157 H110 Q109,172 100,172 Q91,172 90,157z"' + f(C.face) + '/>' +
            '<path d="M94,167 Q100,163 106,167 Q104,171 100,171 Q96,171 94,167z"' + f(C.tongue) + '/>',
    o:      '<ellipse cx="100" cy="164" rx="4.5" ry="5.5"' + f(C.face) + '/>',
    wobble: '<path d="M90,165 Q95,159 100,164 Q105,169 110,163"' + line(C.face, 3) + '/>',
    flat:   '<path d="M93,163 H107"' + line(C.face, 3.2) + '/>',
    tiny:   '<ellipse cx="100" cy="164" rx="3" ry="2.5"' + f(C.face) + '/>'
  };

  // A mitten hanging from the shoulder at (0, 0); the pose turns it. The
  // .k-arm group pivots on the shoulder, so the wave swings from there.
  // k-arm--r is the arm on the viewer's right, the one that waves.
  var arm = function (side, deg) {
    var s = side === 'r' ? 1 : -1;
    return '<g transform="translate(' + (100 + s * 50) + ',156)"><g class="k-arm k-arm--' + side + '">' +
      '<g transform="rotate(' + (s * deg) + ') scale(1.35)">' +
      '<path d="M' + (s * -2) + ',-4 C' + (s * 10) + ',-2 ' + (s * 18) + ',14 ' + (s * 16) + ',30 C' + (s * 14) + ',42 ' +
        (s * 2) + ',44 ' + (s * -4) + ',36 C' + (s * -8) + ',28 ' + (s * -8) + ',8 ' + (s * -2) + ',-4z"' + f(C.brass) + '/>' +
      '<ellipse cx="' + (s * 15) + '" cy="20" rx="5" ry="7"' + f(C.mid) + '/></g></g></g>';
  };
  // Degrees each arm turns from hanging down: [viewer's left, viewer's right].
  var ARMS = {
    none:  [0, 0],
    rest:  [0, 0],
    wave:  [0, -150],
    cheer: [-150, -150],
    think: [0, -165],
    hold:  [55, 55]
  };

  // Props are held in both hands, centred low on the base, so a mirrored
  // pose still offers with both hands and nothing points one way.
  var PROP = {
    none: '',
    play: '<circle cx="100" cy="200" r="18"' + f(C.go) + '/><path d="M94,191 L109,200 L94,209z" fill="#fff"/>',
    card: '<rect x="78" y="184" width="44" height="32" rx="7"' + f(C.card) + '/>' +
          '<path d="M100,190 V206 M93,199 L100,206 L107,199" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    flame: '<circle cx="100" cy="200" r="16"' + f(C.glow) + ' opacity=".8"/>' +
           '<path d="M100,184 C92,193 91,200 93,205 C95,210 105,210 107,205 C109,200 108,193 100,184z"' + f(C.brass) + '/>' +
           '<path d="M100,195 C97,199 97,202 98,204 C99,206 101,206 102,204 C103,202 103,199 100,195z"' + f(C.glow) + '/>'
  };

  var SPARK = 'M0,-14 L4,-4 14,0 4,4 0,14 -4,4 -14,0 -4,-4z';
  var sparkle = function (x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')"><g class="k-spark">' +
           '<path d="' + SPARK + '"' + f(C.brass) + '/></g></g>';
  };
  var FX = {
    none: '',
    sparkles: sparkle(-112, -132, 1) + sparkle(122, -142, .8) + sparkle(-134, 34, .6) + sparkle(140, 26, .7),
    bubbles: '<circle class="k-bubble" cx="56" cy="-118" r="7"' + f(C.sky) + '/>' +
             '<circle class="k-bubble" cx="70" cy="-132" r="5"' + f(C.sky) + '/>' +
             '<circle class="k-bubble" cx="62" cy="-146" r="4"' + f(C.sky) + '/>'
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
  // Each returns the list of [selector, keyframes, options] it plays. Under
  // 1.2 s each, as the brief requires, and none ever blocks a tap.
  var MOVES = {
    hop: [
      ['.k-body', [
        { transform: 'translateY(0) scale(1, 1)' },
        { transform: 'translateY(0) scale(1.1, .86)', offset: .18 },
        { transform: 'translateY(-38px) scale(.94, 1.08)', offset: .45 },
        { transform: 'translateY(0) scale(1.08, .9)', offset: .72 },
        { transform: 'translateY(0) scale(1, 1)' }
      ], { duration: 600, easing: 'ease-in-out' }],
      ['.k-shadow', [
        { transform: 'scale(1)' }, { transform: 'scale(.6)', opacity: .5, offset: .45 }, { transform: 'scale(1)' }
      ], { duration: 600, easing: 'ease-in-out' }]
    ],
    twirl: [
      ['.k-body', [
        { transform: 'translateY(0) scaleX(1)' },
        { transform: 'translateY(-18px) scaleX(.04)', offset: .25 },
        { transform: 'translateY(-22px) scaleX(-1)', offset: .5 },
        { transform: 'translateY(-18px) scaleX(.04)', offset: .75 },
        { transform: 'translateY(0) scaleX(1)' }
      ], { duration: 900, easing: 'ease-in-out' }],
      // The back view: the face is gone while the lantern faces away.
      ['.k-face', [
        { opacity: 1 }, { opacity: 1, offset: .24 }, { opacity: 0, offset: .26 },
        { opacity: 0, offset: .74 }, { opacity: 1, offset: .76 }, { opacity: 1 }
      ], { duration: 900 }],
      ['.k-spark', [
        { transform: 'scale(0)', opacity: 0 }, { transform: 'scale(0)', opacity: 0, offset: .55 },
        { transform: 'scale(1.4)', opacity: 1, offset: .8 }, { transform: 'scale(1)', opacity: 1 }
      ], { duration: 900, easing: 'ease-out' }]
    ],
    fly: [
      ['.k-fly', [
        { transform: 'translateY(0) rotate(0)', opacity: 1 },
        { transform: 'translateY(8px) rotate(0)', opacity: 1, offset: .12 },
        { transform: 'translateY(-90px) rotate(-6deg)', opacity: 1, offset: .45 },
        { transform: 'translateY(-200px) rotate(5deg)', opacity: 0, offset: .8 },
        { transform: 'translateY(30px) rotate(0)', opacity: 0, offset: .81 },
        { transform: 'translateY(0) rotate(0)', opacity: 1 }
      ], { duration: 1200, easing: 'ease-in-out' }],
      ['.k-shadow', [
        { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.2)', opacity: 0, offset: .6 },
        { transform: 'scale(.2)', opacity: 0, offset: .82 }, { transform: 'scale(1)', opacity: 1 }
      ], { duration: 1200 }],
      // The little flame left behind on the ground.
      ['.k-ember', [
        { opacity: 0, transform: 'translateY(0) scale(.4)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', offset: .35 },
        { opacity: 1, transform: 'translateY(-6px) scale(1)', offset: .75 },
        { opacity: 0, transform: 'translateY(-12px) scale(.6)' }
      ], { duration: 1200, easing: 'ease-out' }]
    ],
    wave: [
      ['.k-arm--r', [
        { transform: 'rotate(0)' }, { transform: 'rotate(22deg)' }, { transform: 'rotate(-14deg)' },
        { transform: 'rotate(22deg)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(22deg)' },
        { transform: 'rotate(0)' }
      ], { duration: 1000, easing: 'ease-in-out' }]
    ],
    glow: [
      ['.k-glowwrap', [
        { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0, offset: .7 },
        { transform: 'scale(1)', opacity: 1 }
      ], { duration: 800, easing: 'ease-out' }],
      ['.k-prop', [
        { transform: 'translateY(-46px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: .6 },
        { transform: 'translateY(0)', opacity: 1 }
      ], { duration: 800, easing: 'cubic-bezier(.34,1.56,.64,1)' }]
    ],
    nod: [
      ['.k-body', [
        { transform: 'scale(1, 1)' }, { transform: 'scale(1.06, .94)', offset: .4 }, { transform: 'scale(1, 1)' }
      ], { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' }]
    ],
    dim: [
      ['.k-flame', [{ transform: 'scale(1.4)', opacity: 1 }, { transform: 'scale(1)', opacity: .8 }], { duration: 400, easing: 'ease-out' }],
      ['.k-glowwrap', [{ opacity: 1 }, { opacity: .4 }], { duration: 400, easing: 'ease-out' }]
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
    var tilt = p.tilt ? ' transform="rotate(' + p.tilt + ')"' : '';
    return '<g class="k-mirror">' +
      '<ellipse class="k-shadow" cx="0" cy="120" rx="66" ry="9"' + f(C.face) + ' opacity=".15"/>' +
      '<g class="k-ember" opacity="0">' + EMBER + '</g>' +
      '<g class="k-fly"><g class="k-float">' +
        '<g class="k-glowwrap"><circle class="k-glow" cx="0" cy="0" r="' + Math.round(120 * p.glow) + '"' + f(C.glow) + ' opacity=".35"/></g>' +
        '<g class="k-tilt"><g' + tilt + '><g class="k-body"><g transform="' + ART + '">' +
          HANDLE +
          '<g class="k-flame">' + FLAME[p.flame] + '</g>' +
          CAP + GLASS +
          '<g class="k-face">' + CHEEKS +
            '<g class="k-eyes">' + eyes[0] + '</g>' + eyes[1] +
            '<g class="k-mouth">' + MOUTH[p.mouth] + '</g>' +
          '</g>' +
          BASE +
          '<g class="k-prop">' + PROP[p.prop] + '</g>' +
          arm('l', arms[0]) + arm('r', arms[1]) +
        '</g></g></g></g>' +
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
    // The wave needs the waving arm; other moves work on any pose.
    return m.move ? this.play(m.move) : Promise.resolve(this);
  };

  Kandili.prototype.destroy = function () {
    this._cancel();
    clearTimeout(this._blink);
    if (this._io) this._io.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    this.host.innerHTML = '';
  };

  Kandili.prototype._cancel = function () {
    this._running.forEach(function (p) { try { p.cancel(); } catch (e) { /* already gone */ } });
    this._running = [];
  };

  // Blinks at a random 3 to 6 s, as the brief says; never under reduced
  // motion, never while paused.
  Kandili.prototype._scheduleBlink = function (on) {
    var self = this;
    clearTimeout(this._blink);
    if (!on) return;
    this._blink = setTimeout(function () {
      var eyes = self.svg.querySelector('.k-eyes');
      if (eyes && eyes.animate && !ET.motion.reduced() && !self._paused) {
        eyes.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.1)' }, { transform: 'scaleY(1)' }],
                     { duration: 150, easing: 'ease-in-out' });
      }
      self._scheduleBlink(true);
    }, 3000 + Math.random() * 3000);
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
      var k = new Kandili(el, {
        pose: el.getAttribute('data-pose') || 'neutral',
        mood: el.getAttribute('data-mood') || 'idle',
        size: el.getAttribute('data-size') || null,
        label: el.getAttribute('data-label') || '',
        tappable: el.hasAttribute('data-tappable')
      });
      el.kandili = k;
      if (el.getAttribute('data-moment')) k.moment(el.getAttribute('data-moment'));
      made.push(k);
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
