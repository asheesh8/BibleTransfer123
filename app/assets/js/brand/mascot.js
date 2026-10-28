/* ============================================================================
   ET.mascot: Kandili, the lantern, drawn and brought to life.

   Depends on: nothing but the browser (and css/components/mascot.css for the
   looping moods). Classic script, attaches to window.ET, runs on file://.

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

   The geometry matches the concept sheet in brand/mascot (the Kandili brief).
   When the final ChatGPT art is traced, only the PART strings below change;
   the API, poses, moves and moods stay.
   ========================================================================= */

window.ET.module('brand/mascot', ['core'], function (ET) {
  'use strict';

  /* Fixed palette: Kandili looks the same in light and dark. Mirrors the
     --et-k-* tokens in css/tokens.css (a test keeps them equal). */
  var C = {
    brass: '#E8A317', shade: '#B87D06', glass: '#FDF3DC', shine: '#FFFBF2',
    face: '#4E1F64', glow: '#FFE7A3', blush: '#F4A38C', go: '#3FA65C',
    sky: '#2E86AB', card: '#6B2E86'
  };

  // ------------------------------------------------------------------ parts
  // Coordinates: the lantern stands on (0, 110) with the glass centred near
  // the origin. The character's right hand is on the viewer's left (-x).

  var FLAME = {
    normal: '<path d="M0,-150 C-16,-128 -14,-112 0,-104 C14,-112 16,-128 0,-150z" fill="' + C.brass + '"/>' +
            '<path d="M0,-134 C-6,-124 -6,-116 0,-112 C6,-116 6,-124 0,-134z" fill="' + C.glow + '"/>',
    tall:   '<path d="M0,-178 C-26,-140 -20,-112 0,-102 C20,-112 26,-140 0,-178z" fill="' + C.brass + '"/>' +
            '<path d="M0,-152 C-10,-132 -9,-118 0,-112 C9,-118 10,-132 0,-152z" fill="' + C.glow + '"/>',
    small:  '<path d="M0,-126 C-8,-115 -7,-108 0,-104 C7,-108 8,-115 0,-126z" fill="' + C.brass + '"/>' +
            '<path d="M0,-117 C-3,-112 -3,-108 0,-106 C3,-108 3,-112 0,-117z" fill="' + C.glow + '"/>',
    ember:  '<ellipse cx="0" cy="-107" rx="5" ry="4" fill="' + C.shade + '"/>'
  };

  // The little flame left on the ground when Kandili flies off to a friend.
  var EMBER = '<path d="M0,88 C-9,100 -8,108 0,113 C8,108 9,100 0,88z" fill="' + C.brass + '"/>' +
              '<path d="M0,99 C-3,104 -3,108 0,110 C3,108 3,104 0,99z" fill="' + C.glow + '"/>';

  var eyePair = function (dx, dy, hx, hy) {
    return '<ellipse cx="' + (-20 + dx) + '" cy="' + (-4 + dy) + '" rx="11" ry="15" fill="' + C.face + '"/>' +
           '<ellipse cx="' + (20 + dx) + '" cy="' + (-4 + dy) + '" rx="11" ry="15" fill="' + C.face + '"/>' +
           '<circle cx="' + (-16 + dx + hx) + '" cy="' + (-10 + dy + hy) + '" r="4.5" fill="#fff"/>' +
           '<circle cx="' + (24 + dx + hx) + '" cy="' + (-10 + dy + hy) + '" r="4.5" fill="#fff"/>';
  };
  var arcs = function (d) {
    return '<path d="M-32,-2 Q-20,' + d + ' -8,-2" stroke="' + C.face + '" stroke-width="7" stroke-linecap="round" fill="none"/>' +
           '<path d="M8,-2 Q20,' + d + ' 32,-2" stroke="' + C.face + '" stroke-width="7" stroke-linecap="round" fill="none"/>';
  };
  var EYES = {
    open:    eyePair(0, 0, 0, 0),
    up:      eyePair(0, -3, 2, -2),
    side:    eyePair(5, -1, 3, 0),
    happy:   arcs(-18),
    sleepy:  arcs(6),
    closed:  '<path d="M-31,0 H-9 M9,0 H31" stroke="' + C.face + '" stroke-width="6" stroke-linecap="round"/>',
    worried: '<ellipse cx="-20" cy="0" rx="10" ry="13" fill="' + C.face + '"/>' +
             '<ellipse cx="20" cy="0" rx="10" ry="13" fill="' + C.face + '"/>' +
             '<circle cx="-17" cy="-5" r="4" fill="#fff"/><circle cx="23" cy="-5" r="4" fill="#fff"/>' +
             '<path d="M-32,-16 L-12,-24 M32,-16 L12,-24" stroke="' + C.face + '" stroke-width="5" stroke-linecap="round"/>'
  };

  var MOUTH = {
    smile:  '<path d="M-12,24 Q0,36 12,24" stroke="' + C.face + '" stroke-width="6" stroke-linecap="round" fill="none"/>',
    open:   '<path d="M-16,20 Q0,50 16,20z" fill="' + C.face + '"/><path d="M-8,34 Q0,42 8,34" fill="' + C.blush + '"/>',
    o:      '<ellipse cx="0" cy="28" rx="7" ry="9" fill="' + C.face + '"/>',
    wobble: '<path d="M-12,30 Q-6,24 0,30 Q6,36 12,30" stroke="' + C.face + '" stroke-width="5" stroke-linecap="round" fill="none"/>',
    flat:   '<path d="M-10,28 H10" stroke="' + C.face + '" stroke-width="5" stroke-linecap="round"/>',
    tiny:   '<ellipse cx="0" cy="28" rx="4" ry="3.5" fill="' + C.face + '"/>'
  };

  var limb = function (d) {
    return '<path d="' + d + '" stroke="' + C.shade + '" stroke-width="12" stroke-linecap="round" fill="none"/>';
  };
  var hand = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 11) + '" fill="' + C.brass + '"/>'; };
  var arm = function (side, inner) { return '<g class="k-arm k-arm--' + side + '">' + inner + '</g>'; };

  // Arms behind the body (resting, raised) or in front of it (holding).
  var ARMS = {
    none:  { back: '', front: '' },
    rest:  { back: arm('r', limb('M-66,10 Q-90,30 -86,56')) + arm('l', limb('M66,10 Q90,30 86,56')), front: '' },
    wave:  { back: arm('r', limb('M-66,-10 Q-100,-30 -104,-70') + hand(-104, -74, 12)) +
                   arm('l', limb('M66,10 Q90,30 86,56')), front: '' },
    cheer: { back: arm('r', limb('M-66,-10 Q-96,-40 -100,-84') + hand(-100, -88, 12)) +
                   arm('l', limb('M66,-10 Q96,-40 100,-84') + hand(100, -88, 12)), front: '' },
    think: { back: arm('l', limb('M66,10 Q90,30 86,56')),
             front: arm('r', limb('M-60,0 Q-96,-40 -54,-92') + hand(-52, -94, 11)) },
    hold:  { back: '', front: arm('r', limb('M-64,0 Q-74,58 -32,62') + hand(-30, 62, 10)) +
                              arm('l', limb('M64,0 Q74,58 32,62') + hand(30, 62, 10)) }
  };

  // Props are held in both hands, centred, so a mirrored pose still offers
  // with "both hands" (never the left alone) and nothing points one way.
  var PROP = {
    none: '',
    play: '<circle cx="0" cy="68" r="22" fill="' + C.go + '"/><path d="M-7,58 L11,68 L-7,78z" fill="#fff"/>',
    card: '<rect x="-30" y="40" width="60" height="42" rx="9" fill="' + C.card + '"/>' +
          '<path d="M-11,58 L0,69 L11,58 M0,69 V47" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    flame: '<circle cx="0" cy="68" r="18" fill="' + C.glow + '" opacity=".8"/>' +
           '<path d="M0,44 C-11,58 -10,71 0,78 C10,71 11,58 0,44z" fill="' + C.brass + '"/>' +
           '<path d="M0,58 C-4,64 -4,69 0,73 C4,69 4,64 0,58z" fill="' + C.glow + '"/>'
  };

  var SPARK = 'M0,-14 L4,-4 14,0 4,4 0,14 -4,4 -14,0 -4,-4z';
  var sparkle = function (x, y, s) {
    return '<g class="k-spark" transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
           '<path d="' + SPARK + '" fill="' + C.brass + '"/></g>';
  };
  var FX = {
    none: '',
    sparkles: sparkle(-112, -132, 1) + sparkle(122, -142, .8) + sparkle(-134, 34, .6) + sparkle(140, 26, .7),
    bubbles: '<circle class="k-bubble" cx="70" cy="-118" r="7" fill="' + C.sky + '"/>' +
             '<circle class="k-bubble" cx="84" cy="-132" r="5" fill="' + C.sky + '"/>' +
             '<circle class="k-bubble" cx="76" cy="-146" r="4" fill="' + C.sky + '"/>'
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
    var tilt = p.tilt ? ' transform="rotate(' + p.tilt + ')"' : '';
    return '<g class="k-mirror">' +
      '<ellipse class="k-shadow" cx="0" cy="120" rx="70" ry="10" fill="' + C.face + '" opacity=".15"/>' +
      '<g class="k-ember" opacity="0">' + EMBER + '</g>' +
      '<g class="k-fly"><g class="k-float">' +
        '<g class="k-glowwrap"><circle class="k-glow" cx="0" cy="10" r="' + Math.round(120 * p.glow) + '" fill="' + C.glow + '" opacity=".35"/></g>' +
        '<g class="k-tilt"><g' + tilt + '><g class="k-body">' +
          '<path d="M-22,-112 a22,22 0 0 1 44,0" fill="none" stroke="' + C.shade + '" stroke-width="9" stroke-linecap="round"/>' +
          '<g class="k-flame">' + FLAME[p.flame] + '</g>' +
          '<rect x="-58" y="-104" width="116" height="26" rx="13" fill="' + C.shade + '"/>' +
          arms.back +
          '<path d="M-62,-80 H62 L74,72 Q76,92 56,92 H-56 Q-76,92 -74,72z" fill="' + C.brass + '"/>' +
          '<path d="M-46,-66 H46 L56,64 Q57,78 42,78 H-42 Q-57,78 -56,64z" fill="' + C.glass + '"/>' +
          '<path d="M-40,-58 Q-44,0 -46,40" stroke="' + C.shine + '" stroke-width="8" stroke-linecap="round" fill="none" opacity=".9"/>' +
          '<g class="k-face">' +
            '<ellipse cx="-30" cy="22" rx="11" ry="7" fill="' + C.blush + '" opacity=".7"/>' +
            '<ellipse cx="30" cy="22" rx="11" ry="7" fill="' + C.blush + '" opacity=".7"/>' +
            '<g class="k-eyes">' + EYES[p.eyes] + '</g>' +
            '<g class="k-mouth">' + MOUTH[p.mouth] + '</g>' +
          '</g>' +
          '<rect x="-66" y="88" width="132" height="22" rx="11" fill="' + C.shade + '"/>' +
          '<g class="k-prop">' + PROP[p.prop] + '</g>' +
          arms.front +
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
