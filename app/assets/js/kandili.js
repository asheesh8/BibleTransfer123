/* Kandili, the lantern mascot.
   Classic script, no dependencies, works from file:// off a card.
   Usage:
     Kandili.mount(el, 'hello')      draw Kandili inside el in a pose
     Kandili.pose(el, 'saved')       change pose (plays that pose's one-shot animation)
     Kandili.play(el, 'twirl')       play one animation: hop, twirl, flyup, wave, pulse
   Poses: neutral, hello, play, saved, share, waiting, offline, hooray, thinking, sleeping
   The drawing is decorative (aria-hidden); always pair it with words. */
(function () {
  var C = {
    gold: '#E8A317', goldMid: '#D4920F', goldDeep: '#B87D06', glass: '#FDF3DC',
    shine: '#FFFBF2', glow: '#FFE7A3', face: '#3A1650', cheek: '#F4A38C',
    tongue: '#E8664F', green: '#3FA65C', purple: '#6B2E86', sky: '#2E86AB'
  };

  var POSES = {
    neutral:  { eyes: 'open',   mouth: 'smile', armL: 'down', armR: 'down', flame: 'mid', idle: 'float' },
    hello:    { eyes: 'up',     mouth: 'open',  armL: 'down', armR: 'up',   flame: 'mid', idle: 'float', once: 'wave' },
    play:     { eyes: 'happy',  mouth: 'open',  armL: 'down', armR: 'out',  flame: 'big', idle: 'float', once: 'hop', prop: 'play' },
    saved:    { eyes: 'open',   mouth: 'smile', armL: 'hold', armR: 'hold', flame: 'mid', idle: 'float', once: 'pulse', prop: 'card' },
    share:    { eyes: 'open',   mouth: 'smile', armL: 'hold', armR: 'hold', flame: 'mid', idle: 'float', prop: 'flame' },
    waiting:  { eyes: 'sleepy', mouth: 'o',     armL: 'down', armR: 'down', flame: 'small', idle: 'doze', prop: 'zz' },
    offline:  { eyes: 'worried',mouth: 'wobble',armL: 'down', armR: 'down', flame: 'small', idle: 'still', dim: true },
    hooray:   { eyes: 'happy',  mouth: 'open',  armL: 'up',   armR: 'up',   flame: 'big', idle: 'float', once: 'twirl', prop: 'sparkles' },
    thinking: { eyes: 'side',   mouth: 'flat',  armL: 'down', armR: 'head', flame: 'mid', idle: 'float' },
    sleeping: { eyes: 'closed', mouth: 'o',     armL: 'down', armR: 'down', flame: 'small', idle: 'doze', prop: 'zz', dim: true }
  };
  var ARM = { down: 0, out: -70, up: -150, hold: 30, head: -165 };

  function arm(side) {
    var s = side === 'l' ? -1 : 1;
    // Drawn hanging from the shoulder at 0,0; CSS rotates the group.
    return '<g class="k-arm k-arm-' + side + '" transform="translate(' + (100 + s * 50) + ',156)"><g class="k-arm-in"><g transform="scale(1.35)">' +
      '<path d="M' + (s * -2) + ',-4 C' + (s * 10) + ',-2 ' + (s * 18) + ',14 ' + (s * 16) + ',30 C' + (s * 14) + ',42 ' + (s * 2) + ',44 ' + (s * -4) + ',36 C' + (s * -8) + ',28 ' + (s * -8) + ',8 ' + (s * -2) + ',-4z" fill="' + C.gold + '"/>' +
      '<ellipse cx="' + (s * 15) + '" cy="20" rx="5" ry="7" fill="' + C.goldMid + '"/></g></g></g>';
  }

  var SVG =
  '<svg class="kandili-svg" viewBox="0 0 200 250" aria-hidden="true" focusable="false">' +
  '<ellipse class="k-shadow" cx="100" cy="236" rx="54" ry="7" fill="' + C.face + '" opacity=".14"/>' +
  '<g class="k-fly"><g class="k-body">' +
    '<circle class="k-glow" cx="100" cy="52" r="38" fill="' + C.glow + '" opacity=".6"/>' +
    '<circle cx="100" cy="16" r="12" fill="none" stroke="' + C.goldMid + '" stroke-width="7"/>' +
    '<g class="k-flame">' +
      '<path d="M100,30 C88,42 84,52 88,62 C90,68 96,70 100,70 C104,70 110,68 112,62 C116,52 112,42 100,30z" fill="' + C.gold + '"/>' +
      '<path d="M100,44 C94,52 93,58 95,63 C96,66 98,67 100,67 C102,67 104,66 105,63 C107,58 106,52 100,44z" fill="' + C.glow + '"/>' +
    '</g>' +
    '<rect x="78" y="62" width="44" height="10" rx="5" fill="' + C.gold + '"/>' +
    '<rect x="70" y="70" width="60" height="20" rx="7" fill="' + C.gold + '"/>' +
    '<rect x="80" y="75" width="6" height="10" rx="3" fill="' + C.goldDeep + '"/><rect x="97" y="75" width="6" height="10" rx="3" fill="' + C.goldDeep + '"/><rect x="114" y="75" width="6" height="10" rx="3" fill="' + C.goldDeep + '"/>' +
    '<rect x="60" y="88" width="80" height="11" rx="5.5" fill="' + C.goldMid + '"/>' +
    '<path d="M72,99 H128 Q136,99 138,108 L146,176 Q148,190 134,190 H66 Q52,190 54,176 L62,108 Q64,99 72,99z" fill="' + C.glass + '"/>' +
    '<path d="M68,108 L62,170" stroke="' + C.shine + '" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M64,96 Q52,140 50,186 M136,96 Q148,140 150,186" fill="none" stroke="' + C.gold + '" stroke-width="9" stroke-linecap="round"/>' +
    '<circle cx="51" cy="144" r="6" fill="' + C.goldMid + '"/><circle cx="149" cy="144" r="6" fill="' + C.goldMid + '"/>' +
    '<g class="k-face">' +
      '<ellipse cx="78" cy="160" rx="8" ry="5" fill="' + C.cheek + '" opacity=".75"/><ellipse cx="122" cy="160" rx="8" ry="5" fill="' + C.cheek + '" opacity=".75"/>' +
      '<g class="k-eyes" data-e="open"><g class="k-eye-pair"><ellipse cx="85" cy="142" rx="8" ry="10" fill="' + C.face + '"/><ellipse cx="115" cy="142" rx="8" ry="10" fill="' + C.face + '"/><circle cx="88" cy="138" r="3.2" fill="#fff"/><circle cx="118" cy="138" r="3.2" fill="#fff"/></g>' +
        '<path d="M78,124 Q85,119 92,123 M108,123 Q115,119 122,124" stroke="' + C.face + '" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-eyes" data-e="up"><ellipse cx="85" cy="140" rx="8" ry="10" fill="' + C.face + '"/><ellipse cx="115" cy="140" rx="8" ry="10" fill="' + C.face + '"/><circle cx="88" cy="135" r="3.2" fill="#fff"/><circle cx="118" cy="135" r="3.2" fill="#fff"/>' +
        '<path d="M78,122 Q85,116 92,121 M108,121 Q115,116 122,122" stroke="' + C.face + '" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-eyes" data-e="happy"><path d="M77,144 Q85,132 93,144 M107,144 Q115,132 123,144" stroke="' + C.face + '" stroke-width="4.5" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-eyes" data-e="sleepy"><path d="M77,140 H93 M107,140 H123" stroke="' + C.face + '" stroke-width="3" stroke-linecap="round"/><path d="M78,141 Q85,149 92,141 M108,141 Q115,149 122,141" fill="' + C.face + '"/></g>' +
      '<g class="k-eyes" data-e="closed"><path d="M77,142 Q85,150 93,142 M107,142 Q115,150 123,142" stroke="' + C.face + '" stroke-width="4" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-eyes" data-e="worried"><ellipse cx="85" cy="144" rx="7.5" ry="9" fill="' + C.face + '"/><ellipse cx="115" cy="144" rx="7.5" ry="9" fill="' + C.face + '"/><circle cx="87" cy="140" r="3" fill="#fff"/><circle cx="117" cy="140" r="3" fill="#fff"/>' +
        '<path d="M77,130 L92,125 M123,130 L108,125" stroke="' + C.face + '" stroke-width="2.8" stroke-linecap="round"/></g>' +
      '<g class="k-eyes" data-e="side"><ellipse cx="85" cy="142" rx="8" ry="10" fill="' + C.face + '"/><ellipse cx="115" cy="142" rx="8" ry="10" fill="' + C.face + '"/><circle cx="90" cy="138" r="3.2" fill="#fff"/><circle cx="120" cy="138" r="3.2" fill="#fff"/>' +
        '<path d="M78,126 Q85,122 92,126 M108,123 Q115,118 122,122" stroke="' + C.face + '" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-mouth" data-m="smile"><path d="M92,160 Q100,168 108,160" stroke="' + C.face + '" stroke-width="3.4" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-mouth" data-m="open"><path d="M90,157 H110 Q109,172 100,172 Q91,172 90,157z" fill="' + C.face + '"/><path d="M94,167 Q100,163 106,167 Q104,171 100,171 Q96,171 94,167z" fill="' + C.tongue + '"/></g>' +
      '<g class="k-mouth" data-m="o"><ellipse cx="100" cy="164" rx="4.5" ry="5.5" fill="' + C.face + '"/></g>' +
      '<g class="k-mouth" data-m="wobble"><path d="M90,165 Q95,159 100,164 Q105,169 110,163" stroke="' + C.face + '" stroke-width="3" stroke-linecap="round" fill="none"/></g>' +
      '<g class="k-mouth" data-m="flat"><path d="M93,163 H107" stroke="' + C.face + '" stroke-width="3.2" stroke-linecap="round"/></g>' +
    '</g>' +
    '<rect x="48" y="184" width="104" height="14" rx="7" fill="' + C.gold + '"/>' +
    '<rect x="54" y="196" width="92" height="11" rx="5.5" fill="' + C.goldMid + '"/>' +
    '<rect x="60" y="205" width="80" height="10" rx="5" fill="' + C.gold + '"/>' +
    '<ellipse cx="80" cy="222" rx="15" ry="9" fill="' + C.goldMid + '"/><ellipse cx="120" cy="222" rx="15" ry="9" fill="' + C.goldMid + '"/>' +
    '<g class="k-prop" data-p="card"><rect x="82" y="168" width="36" height="28" rx="6" fill="' + C.purple + '"/><path d="M100,174 V188 M93,182 L100,189 L107,182" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>' +
    '<g class="k-prop" data-p="flame"><circle cx="100" cy="182" r="16" fill="' + C.glow + '" opacity=".8"/><path d="M100,168 C93,176 92,182 94,187 C96,191 104,191 106,187 C108,182 107,176 100,168z" fill="' + C.gold + '"/></g>' +
    arm('l') + arm('r') +
  '</g></g>' +
  '<g class="k-prop" data-p="play"><circle cx="176" cy="104" r="20" fill="' + C.green + '"/><path d="M170,93 L188,104 L170,115z" fill="#fff"/></g>' +
  '<g class="k-prop" data-p="zz"><text x="148" y="40" font-family="sans-serif" font-weight="800" font-size="22" fill="' + C.sky + '">z</text><text x="166" y="22" font-family="sans-serif" font-weight="800" font-size="15" fill="' + C.sky + '">z</text></g>' +
  '<g class="k-prop" data-p="sparkles" fill="' + C.gold + '"><path d="M30,40 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4z"/><path d="M172,30 l3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 8,-3z"/><path d="M18,130 l2.5,6 6,2.5 -6,2.5 -2.5,6 -2.5,-6 -6,-2.5 6,-2.5z"/><path d="M182,150 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3z"/></g>' +
  '</svg>';

  var CSS =
  '.kandili{display:inline-block;width:160px;aspect-ratio:200/250;max-width:100%;line-height:0}' +
  '.kandili-svg{width:100%;height:100%;overflow:visible}' +
  '.kandili .k-eyes,.kandili .k-mouth,.kandili .k-prop{display:none}' +
  '.kandili .k-arm-in{transition:transform .35s cubic-bezier(.3,1.4,.5,1)}' +
  '.kandili .k-flame{transform-box:fill-box;transform-origin:50% 100%;animation:k-flicker 1.2s ease-in-out infinite alternate;transition:scale .3s}' +
  '.kandili .k-body,.kandili .k-fly{transform-box:view-box;transform-origin:100px 230px}' +
  '.kandili .k-shadow{transform-box:fill-box;transform-origin:50% 50%}' +
  '.kandili .k-glow{transform-box:fill-box;transform-origin:50% 50%;transition:opacity .4s}' +
  '.kandili .k-eye-pair{transform-box:fill-box;transform-origin:50% 50%}' +
  '.kandili.k-blink .k-eye-pair{transform:scaleY(.1)}' +
  '.kandili[data-flame=small] .k-flame{scale:.6}.kandili[data-flame=big] .k-flame{scale:1.25}' +
  '.kandili[data-dim] .k-glow{opacity:.15}' +
  '.kandili[data-idle=float] .k-fly{animation:k-float 2.4s ease-in-out infinite}' +
  '.kandili[data-idle=float] .k-shadow{animation:k-shadow 2.4s ease-in-out infinite}' +
  '.kandili[data-idle=doze] .k-fly{animation:k-doze 2.6s ease-in-out infinite}' +
  '.kandili[data-idle=float] .k-body,.kandili[data-idle=still] .k-body{animation:k-breathe 3s ease-in-out infinite}' +
  '.kandili[data-idle=doze] .k-prop[data-p=zz]{animation:k-zz 2.6s ease-in-out infinite}' +
  '.kandili .k-prop[data-p=sparkles]{animation:k-twinkle 1.4s ease-in-out infinite alternate}' +
  '.kandili.k-once-hop .k-body{animation:k-hop .6s cubic-bezier(.3,.7,.4,1)}' +
  '.kandili.k-once-twirl .k-body{animation:k-twirl .9s ease-in-out}' +
  '.kandili.k-once-flyup .k-fly{animation:k-flyup 1.6s ease-in-out}' +
  '.kandili.k-once-flyup .k-shadow{animation:k-shadow-away 1.6s ease-in-out}' +
  '.kandili.k-once-wave .k-arm-r .k-arm-in{animation:k-wave 1s ease-in-out}' +
  '.kandili.k-once-pulse .k-glow{animation:k-pulse .8s ease-out}' +
  '@keyframes k-flicker{0%{transform:rotate(-4deg) scaleY(.94)}100%{transform:rotate(4deg) scaleY(1.06)}}' +
  '@keyframes k-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
  '@keyframes k-shadow{0%,100%{transform:scale(1);opacity:.14}50%{transform:scale(.88);opacity:.09}}' +
  '@keyframes k-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.015,1.02)}}' +
  '@keyframes k-doze{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(3deg)}}' +
  '@keyframes k-zz{0%{transform:translate(0,6px);opacity:0}40%{opacity:1}100%{transform:translate(6px,-8px);opacity:0}}' +
  '@keyframes k-twinkle{0%{opacity:.4}100%{opacity:1}}' +
  '@keyframes k-hop{0%{transform:scale(1)}18%{transform:scale(1.1,.86)}45%{transform:translateY(-34px) scale(.94,1.08)}72%{transform:translateY(0) scale(1.08,.9)}86%{transform:scale(.97,1.03)}100%{transform:scale(1)}}' +
  '@keyframes k-twirl{0%{transform:scaleX(1)}15%{transform:translateY(-14px) scaleX(1)}40%{transform:translateY(-24px) scaleX(-1)}65%{transform:translateY(-24px) scaleX(1)}85%{transform:translateY(0) scale(1.06,.94)}100%{transform:scale(1)}}' +
  '@keyframes k-flyup{0%{transform:translateY(0)}20%{transform:translateY(6px) scale(1.04,.96)}55%{transform:translateY(-260px) rotate(-6deg);opacity:1}56%{opacity:0}57%{transform:translateY(60px);opacity:0}75%{opacity:1}100%{transform:translateY(0)}}' +
  '@keyframes k-shadow-away{0%,100%{transform:scale(1)}50%{transform:scale(.2);opacity:0}}' +
  '@keyframes k-wave{0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-30deg)}40%,80%{transform:rotate(18deg)}}' +
  '@keyframes k-pulse{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.8);opacity:0}}' +
  '@media (prefers-reduced-motion:reduce){.kandili *{animation:none!important;transition:none!important}}';

  function injectCss() {
    if (document.getElementById('kandili-css')) return;
    var s = document.createElement('style');
    s.id = 'kandili-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function show(el, sel, attr, val) {
    var nodes = el.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.display = nodes[i].getAttribute(attr) === val ? 'inline' : '';
    }
  }

  function play(el, name) {
    var cls = 'k-once-' + name;
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation if it is already running
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 1700);
  }

  function pose(el, name) {
    var p = POSES[name] || POSES.neutral;
    el.setAttribute('data-pose', name);
    el.setAttribute('data-idle', p.idle);
    el.setAttribute('data-flame', p.flame);
    if (p.dim) el.setAttribute('data-dim', ''); else el.removeAttribute('data-dim');
    show(el, '.k-eyes', 'data-e', p.eyes);
    show(el, '.k-mouth', 'data-m', p.mouth);
    var props = el.querySelectorAll('.k-prop');
    for (var i = 0; i < props.length; i++) props[i].style.display = props[i].getAttribute('data-p') === p.prop ? 'inline' : '';
    el.querySelector('.k-arm-l .k-arm-in').style.transform = 'rotate(' + (-ARM[p.armL]) + 'deg)';
    el.querySelector('.k-arm-r .k-arm-in').style.transform = 'rotate(' + ARM[p.armR] + 'deg)';
    if (p.once) play(el, p.once);
  }

  function blinkLoop(el) {
    setTimeout(function () {
      var e = el.getAttribute('data-pose');
      if (e !== 'sleeping' && e !== 'waiting') {
        el.classList.add('k-blink');
        setTimeout(function () { el.classList.remove('k-blink'); }, 140);
      }
      if (el.isConnected) blinkLoop(el);
    }, 3000 + Math.random() * 3000);
  }

  function mount(el, name) {
    injectCss();
    el.classList.add('kandili');
    el.innerHTML = SVG;
    pose(el, name || 'neutral');
    blinkLoop(el);
    return el;
  }

  window.Kandili = { mount: mount, pose: pose, play: play, poses: Object.keys(POSES) };
})();
