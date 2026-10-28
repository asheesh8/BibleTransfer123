/* ============================================================================
   The living style guide (styleguide.html): builds the swatches, scales and
   demos from the real tokens and components, so the page can never show a
   value the app does not use.

   Depends on: ui/icons.js, brand/mascot.js, ui/sheet.js, ui/toast.js.
   Page-only; nothing in the app loads this file. The demo copy is English
   because this page is for the team and the board, not for readers.
   ========================================================================= */

(function (ET) {
  'use strict';

  var root = document.documentElement;
  var $ = function (s) { return document.querySelector(s); };
  var css = function (name) { return getComputedStyle(root).getPropertyValue(name).trim(); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ----------------------------------------------------- view toggles
  function radios(name, apply) {
    var els = document.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < els.length; i++) {
      els[i].addEventListener('change', function () { apply(this.value); refresh(); });
    }
  }
  radios('sg-theme',  function (v) { if (v) root.setAttribute('data-theme', v); else root.removeAttribute('data-theme'); });
  radios('sg-dir',    function (v) { root.setAttribute('dir', v); });
  radios('sg-motion', function (v) { if (v) root.setAttribute('data-motion', v); else root.removeAttribute('data-motion'); });

  // ----------------------------------------------------------- contrast
  function rgb(color) {
    var probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    var m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    probe.remove();
    return m;
  }
  function lum(c) {
    var v = c.slice(0, 3).map(function (x) { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
  }
  function ratio(a, b) {
    var x = lum(rgb(a)), y = lum(rgb(b));
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
  }

  // ------------------------------------------------------------ palette
  var PALETTE = [
    ['Purple', '--et-p-purple-700'], ['Deep purple', '--et-p-purple-800'], ['Lilac', '--et-p-purple-300'],
    ['Gold', '--et-p-gold-500'], ['Deep gold', '--et-p-gold-700'], ['Glass cream', '--et-p-gold-100'],
    ['Green', '--et-p-green-700'], ['Leaf', '--et-p-green-400'], ['Sky', '--et-p-sky-700'],
    ['Light sky', '--et-p-sky-400'], ['Clay red', '--et-p-red-600'], ['Night', '--et-p-night'],
    ['Cream', '--et-p-cream'], ['Glow', '--et-k-glow'], ['Blush', '--et-k-blush']
  ];
  function paintPalette() {
    $('#sg-palette').innerHTML = PALETTE.map(function (p) {
      var hex = css(p[1]);
      var ink = ratio(hex, '#FFFFFF') >= ratio(hex, '#2A1B33') ? '#FFFFFF' : '#2A1B33';
      return '<div class="sg-swatch"><div class="sg-swatch__chip" style="background:' + hex + ';color:' + ink + '">Aa</div>' +
             '<div class="sg-swatch__meta"><b>' + p[0] + '</b>' + hex + '</div></div>';
    }).join('');
  }

  // Each pair is [label, text token, ground token].
  var PAIRS = [
    ['Body text', '--et-text', '--et-bg'],
    ['Soft text', '--et-text-soft', '--et-bg'],
    ['Soft text on a card', '--et-text-soft', '--et-surface'],
    ['Brand link', '--et-text-brand', '--et-bg'],
    ['Play / success text', '--et-text-go', '--et-wash-go'],
    ['Info text', '--et-text-info', '--et-wash-info'],
    ['Danger text', '--et-text-danger', '--et-wash-danger'],
    ['Brand button', '--et-on-brand', '--et-fill-brand'],
    ['Play button', '--et-on-go', '--et-fill-go'],
    ['Gold button', '--et-on-gold', '--et-fill-gold'],
    ['Info button', '--et-on-info', '--et-fill-info'],
    ['Danger button', '--et-on-danger', '--et-fill-danger']
  ];
  function paintPairs() {
    $('#sg-pairs').innerHTML = PAIRS.map(function (p) {
      var r = ratio(css(p[1]), css(p[2]));
      var grade = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : 'FAIL';
      return '<div class="sg-pair" style="color:var(' + p[1] + ');background:var(' + p[2] + ');border:1px solid var(--et-line)">' +
             '<span>' + p[0] + '</span><small>' + r.toFixed(1) + ':1 ' + grade + '</small></div>';
    }).join('');
  }

  // ------------------------------------------------ space, radius, motion
  function paintScales() {
    $('#sg-space').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) {
      return '<div class="sg-space__row"><span class="sg-space__bar" style="width:var(--et-space-' + n + ')"></span>' +
             '<span class="sg-label" style="margin:0">--et-space-' + n + ' · ' + css('--et-space-' + n) + '</span></div>';
    }).join('');
    $('#sg-radius').innerHTML = ['xs', 'sm', 'md', 'lg', 'xl', 'pill'].map(function (n) {
      return '<div><div class="sg-shape" style="border-radius:var(--et-radius-' + n + ')"></div>' +
             '<span class="sg-label">--et-radius-' + n + '</span></div>';
    }).join('');
    $('#sg-durations').innerHTML = [['instant', 'press'], ['fast', 'hover, colour'], ['base', 'toast, chip'], ['slow', 'sheet, page'], ['story', 'mascot moves']].map(function (d) {
      return '<div class="sg-box sg-box--sunk"><strong>' + d[0] + '</strong><span class="sg-label">--et-dur-' + d[0] + ' · ' + css('--et-dur-' + d[0]) + '<br>' + d[1] + '</span></div>';
    }).join('');
  }
  var CURVES = [['out', 'arriving'], ['in', 'leaving'], ['inout', 'moving across'], ['spring', 'playful press']];
  $('#sg-ease').innerHTML = CURVES.map(function (c) {
    return '<div><div class="sg-ease__track" style="--sg-ease:var(--et-ease-' + c[0] + ');--sg-dur:var(--et-dur-story)"><span class="sg-ease__dot"></span></div>' +
           '<span class="sg-label">--et-ease-' + c[0] + ' · ' + c[1] + '</span></div>';
  }).join('');
  $('#sg-ease-go').addEventListener('click', function () { $('#sg-ease').classList.toggle('is-go'); });

  // --------------------------------------------------------------- icons
  $('#sg-icons').innerHTML = ET.ui.icon.names.map(function (n) {
    return '<div class="sg-icon">' + ET.ui.icon(n) + '<span class="sg-label">' + n + '</span></div>';
  }).join('');

  // --------------------------------------------------------------- shelf
  var SHELF = [['Jesus', 'Film · 2 h 7 min', 'film', 'Top 5'], ['Gospel of John', 'Audio · 2 h 10 min', 'audio'],
               ['Biblia Takatifu', 'Scripture', 'book', 'Saved'], ['Magdalena', 'Film · 1 h 2 min', 'film'],
               ['The Story of Jesus for Children', 'Film · 1 h 1 min', 'film'], ['Psalms', 'Audio · 3 h', 'audio']];
  $('#sg-shelf').innerHTML = SHELF.map(function (s, i) {
    var badge = s[3] ? '<span class="et-poster__badge"><span class="et-badge ' + (s[3] === 'Saved' ? 'et-badge--go' : 'et-badge--gold') + '">' + s[3] + '</span></span>' : '';
    return '<a class="et-poster" href="#cards"><span class="et-poster__art" data-tone="' + (i % 6 + 1) + '">' +
           '<span class="et-poster__gen">' + esc(s[0]) + '</span>' + badge +
           '<span class="et-poster__play" aria-hidden="true">' + ET.ui.icon('play') + '</span></span>' +
           '<span class="et-poster__title">' + esc(s[0]) + '</span><span class="et-poster__meta">' + s[1] + '</span></a>';
  }).join('');

  // --------------------------------------------------------------- chips
  $('#sg-chips').addEventListener('click', function (e) {
    var chip = e.target.closest('.et-chip');
    if (!chip) return;
    var all = this.querySelectorAll('.et-chip');
    for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', String(all[i] === chip));
  });

  // ------------------------------------------------ hydrate icons + mascots
  ET.ui.icons.hydrate(document);
  ET.mascot.mount(document);

  // ---------------------------------------------------- save button demo
  var saveBtn = $('#sg-save-demo');
  saveBtn.addEventListener('click', function () {
    if (saveBtn.getAttribute('aria-busy') === 'true') return;
    if (saveBtn.classList.contains('is-done')) {
      saveBtn.classList.remove('is-done');
      saveBtn.querySelector('.sg-save-label').textContent = 'Save to my phone';
      return;
    }
    saveBtn.setAttribute('aria-busy', 'true');
    runRing(function () {
      saveBtn.removeAttribute('aria-busy');
      saveBtn.classList.add('is-done');
      saveBtn.querySelector('.sg-save-label').textContent = 'Saved';
      ET.ui.toast.show({ text: "Saved. It's on your phone now.", tone: 'go', pose: 'saved' });
    });
  });

  // The ring and bar fill together, as a save would.
  function runRing(done) {
    var ring = $('#sg-ring'), bar = $('#sg-bar'), v = 0;
    var tick = setInterval(function () {
      v = Math.min(100, v + 4 + Math.round(Math.random() * 6));
      ring.style.setProperty('--value', v);
      ring.setAttribute('aria-valuenow', v);
      ring.querySelector('.et-ring__num').textContent = v + '%';
      bar.style.setProperty('--value', v + '%');
      bar.setAttribute('aria-valuenow', v);
      if (v >= 100) { clearInterval(tick); if (done) done(); }
    }, 70);
  }

  // ----------------------------------------------------- toasts and sheet
  var TOASTS = {
    saved:   { text: "Saved. It's on your phone now.", tone: 'go', pose: 'saved' },
    offline: { text: 'No signal. Your saved items still work.', tone: 'info', pose: 'offline',
               action: { label: 'Try again', run: function () {} } }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toast]');
    if (t) ET.ui.toast.show(TOASTS[t.getAttribute('data-toast')]);
  });
  $('#sg-sheet').addEventListener('click', function () {
    var s = ET.ui.sheet.open({
      title: 'Share this with someone',
      closeLabel: 'Close',
      body:
        '<div class="et-stack">' +
          '<p class="et-soft" style="margin:0">Pick how to send it. Their phone does not need the app.</p>' +
          '<button class="et-btn et-btn--gold et-btn--block" type="button" data-sheet-pick><span>' + ET.ui.icon('qr') + '</span><span>Show a QR code</span></button>' +
          '<button class="et-btn et-btn--go et-btn--block" type="button" data-sheet-pick><span>' + ET.ui.icon('share') + '</span><span>Send on WhatsApp</span></button>' +
          '<button class="et-btn et-btn--quiet et-btn--block" type="button" data-sheet-pick><span>' + ET.ui.icon('copy') + '</span><span>Copy link</span></button>' +
        '</div>'
    });
    s.body.addEventListener('click', function (e) {
      if (!e.target.closest('[data-sheet-pick]')) return;
      s.close();
      ET.ui.toast.show({ text: 'Sent. Thank you for passing on the light.', tone: 'go', pose: 'share' });
    });
  });

  // -------------------------------------------------------------- scanner
  $('#sg-scan-found').addEventListener('click', function () {
    var sc = $('#sg-scanner');
    sc.classList.add('is-found');
    setTimeout(function () { sc.classList.remove('is-found'); }, 1400);
  });

  // ------------------------------------------------------------- mascot
  var stage = $('#sg-stage').kandili;
  var now = $('#sg-now');
  function buttons(sel, list, label, run) {
    $(sel).innerHTML = list.map(function (n) {
      return '<button class="et-btn et-btn--sm et-btn--quiet" type="button" data-v="' + n + '"><span>' + label(n) + '</span></button>';
    }).join('');
    $(sel).addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (!b) return;
      var v = b.getAttribute('data-v');
      now.textContent = run(v);
    });
  }
  buttons('#sg-moments', ET.mascot.MOMENTS, function (n) { return n; }, function (v) { stage.moment(v); return "k.moment('" + v + "')"; });
  buttons('#sg-moves', ET.mascot.MOVES, function (n) { return n; }, function (v) { stage.play(v); return "k.play('" + v + "')"; });
  buttons('#sg-moods', ET.mascot.MOODS, function (n) { return n; }, function (v) { stage.mood(v); return "k.mood('" + v + "')"; });

  var POSE_NOTES = {
    neutral: 'Default, empty space', hello: 'Home, first open', play: 'Pressing Play', saved: 'Saved to the phone',
    share: 'Passing the light on', waiting: 'Loading, slow network', offline: 'No signal, gentle',
    hooray: 'First share, milestones', thinking: 'Searching', sleeping: 'Nothing here yet'
  };
  $('#sg-poses').innerHTML = ET.mascot.POSES.map(function (p) {
    return '<button class="sg-pose" type="button" data-pose-pick="' + p + '">' +
           ET.mascot.markup(p) + '<strong>' + p + '</strong><span>' + POSE_NOTES[p] + '</span></button>';
  }).join('');
  $('#sg-poses').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pose-pick]');
    if (!b) return;
    var p = b.getAttribute('data-pose-pick');
    stage.pose(p).play('nod');
    now.textContent = "k.pose('" + p + "')";
    $('#kandili').scrollIntoView({ behavior: ET.motion.reduced() ? 'auto' : 'smooth' });
  });

  // ------------------------------------------------------- whole screen
  var phoneK = $('#sg-phone-kandili').kandili;
  var LINES = {
    play: 'Enjoy the film.',
    saved: "Saved. It's on your phone now, even with no internet.",
    shared: 'Sent. Thank you for passing on the light.'
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-react]');
    if (!b) return;
    var m = b.getAttribute('data-react');
    phoneK.moment(m);
    $('#sg-phone-line').textContent = LINES[m];
  });

  // ------------------------------------------------------------- refresh
  function refresh() { paintPalette(); paintPairs(); paintScales(); }
  refresh();
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', refresh);
  }
})(window.ET = window.ET || {});
