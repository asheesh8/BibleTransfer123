/* ============================================================================
   features/onboarding.js: Kandili walks a first-time visitor into the right
   library, one question at a time, the way a language course app does.

     1  Which language?           the language list on the welcome screen
     2  What would you like to learn today?   films, listen, read, stories, all
     3  How do you usually get online?        tailors Kandili's sharing tip
     4  Your library is ready!     Home opens with the chosen shelf first

   Depends on: core.js, i18n.js, data/onboarding-strings.js, and
   brand/mascot.js (ET.mascot), which core.js loads after paint. This
   file is itself loaded on demand by i18n.js welcome(), only on a first
   visit; until it arrives a language tap simply opens the library, so a slow
   phone is never stuck behind it.

   Step 1 stays the Lantern Night welcome screen (village hero, language
   list, then the partner pages). This module only adds the progress bar and
   Kandili's hello there, then takes over once a language is chosen.

   Answers are kept on the phone (ET.store): et.want orders the shelves on
   Home (home.js), et.net is kept for the sharing prompts. Nothing is sent.
   ========================================================================= */

window.ET.module('features/onboarding', ['core', 'data/onboarding-strings'], function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;

  var TOTAL = 3;   // questions; the ready screen fills the bar

  // What someone came for, and the shelves that answer it. Only choices the
  // chosen language actually has are offered.
  var WANTS = [
    { key: 'film',        types: ['film'],              icon: 'film', tone: 'gold',   pose: 'play' },
    { key: 'audio-bible', types: ['audio-bible'],       icon: 'wave', tone: 'green',  pose: 'hello' },
    { key: 'scripture',   types: ['scripture', 'book'], icon: 'book', tone: 'sky',    pose: 'saved' },
    { key: 'audio',       types: ['audio'],             icon: 'wave', tone: 'purple', pose: 'hello' },
    { key: 'all',         types: null,                  icon: 'globe', tone: 'night', pose: 'hooray' }
  ];
  var NETS = [
    { key: 'wifi',   icon: 'wifi',  pose: 'hooray' },
    { key: 'little', icon: 'phone', pose: 'share' },
    { key: 'none',   icon: 'share', pose: 'share' }
  ];

  // ------------------------------------------------------------ the library
  function counts() {
    var n = {}, all = 0;
    try {
      var mine = ET.contentLang();
      ET.library().resources.forEach(function (r) {
        if (r.lang !== mine) return;
        n[r.type] = (n[r.type] || 0) + 1;
        all++;
      });
    } catch (e) { /* no catalogue on this page: offer everything */ }
    n.all = all;
    return n;
  }
  function countFor(want, n) {
    if (!want.types) return n.all;
    return want.types.reduce(function (s, ty) { return s + (n[ty] || 0); }, 0);
  }

  // ---------------------------------------------------------------- Kandili
  /* The funnel keeps its own ET.mascot so it can change pose at each answer.
     Until brand/mascot.js has loaded (core.js fetches it after paint) the
     still drawing stands in, and the first pose after it arrives brings
     Kandili to life. ET.mascot skips the motion under reduced motion. */
  function pose(f, name, move) {
    var host = ET.$('.ob-k', f.el);
    if (!host || !ET.mascot) return;
    if (!f.k) f.k = ET.mascot.create(host, { pose: name, size: '104px', tappable: true });
    else f.k.pose(name);
    if (move) f.k.play(move);
  }

  // ------------------------------------------------------------- the shell
  function bar(step, label) {
    var now = Math.min(step, TOTAL);
    return '<div class="ob-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + TOTAL +
      '" aria-valuenow="' + now + '" aria-label="' + ET.esc(label || t('ob.step', { n: now, total: TOTAL })) +
      '"><i style="width:' + Math.round(step / (TOTAL + 1) * 100) + '%"></i></div>';
  }

  /* Step 1 is the welcome screen itself. Add the progress bar and Kandili's
     hello in the reader's likely language, and leave the rest alone. */
  function decorate(root) {
    var pick = ET.$('#et-welcome-pick', root);
    if (!pick || ET.$('.ob-step1', pick)) return;
    var guess = ET.i18n.suggested() || 'en';
    var top = document.createElement('div');
    top.className = 'ob-step1';
    top.innerHTML = bar(1, ET.i18n.say('ob.step', guess, { n: 1, total: TOTAL }));
    pick.insertBefore(top, pick.firstChild);
    var h1 = ET.$('#et-welcome-h', pick);
    if (h1) {
      var hi = document.createElement('p');
      hi.className = 'ob-hello';
      hi.setAttribute('dir', 'auto');
      hi.setAttribute('lang', guess);
      hi.textContent = ET.i18n.say('ob.hello', guess);
      h1.parentNode.insertBefore(hi, h1);
    }
  }

  function Funnel(root, done) {
    this.root = root;
    this.done = done;
    this.want = '';
    this.net = '';
    this.n = counts();
    this.wants = WANTS.filter(function (w) { return w.key === 'all' || countFor(w, this.n) > 0; }, this);
    // A library with one kind of thing, or none here, has nothing to ask.
    if (this.wants.length < 3) this.wants = [];
  }

  Funnel.prototype.mount = function () {
    var root = this.root, self = this;
    var el = ET.$('#et-funnel', root);
    if (el) el.remove();
    el = document.createElement('section');
    el.id = 'et-funnel';
    el.className = 'ob';
    el.innerHTML =
      '<div class="ob-in">' +
        '<div class="ob-top">' +
          '<button type="button" class="ob-icon ob-back">' + ET.icon('back', 'flip') +
            '<span class="sr">' + h('ob.back') + '</span></button>' +
          '<div class="ob-barwrap"></div>' +
          '<button type="button" class="ob-skip">' + h('ob.skip') + '</button>' +
        '</div>' +
        '<div class="ob-talk">' +
          '<div class="ob-k" aria-hidden="true">' + ET.lantern(104) + '</div>' +
          '<div class="ob-bubble"><h1 class="ob-q" id="ob-q" tabindex="-1" dir="auto"></h1>' +
            '<p class="ob-say" dir="auto" aria-live="polite"></p></div>' +
        '</div>' +
        '<div class="ob-body"></div>' +
        '<div class="ob-foot"><button type="button" class="btn big block ob-go"></button></div>' +
      '</div>';
    root.appendChild(el);
    root.classList.add('ob-on');
    this.el = el;
    if (ET.loadMascot) ET.loadMascot();

    ET.$('.ob-back', el).addEventListener('click', function () { self.back(); });
    ET.$('.ob-skip', el).addEventListener('click', function () { self.finish(); });
    ET.$('.ob-go', el).addEventListener('click', function () { self.next(); });
    root.scrollTop = 0;
  };

  Funnel.prototype.show = function (step) {
    this.step = step;
    var el = this.el;
    ET.$('.ob-barwrap', el).innerHTML = bar(step === 'want' ? 2 : step === 'net' ? 3 : TOTAL + 1);
    ET.$('.ob-skip', el).hidden = step === 'ready';
    var body = ET.$('.ob-body', el);
    var say = ET.$('.ob-say', el);
    say.textContent = '';
    if (step === 'want') this.renderWant(body);
    else if (step === 'net') this.renderNet(body);
    else this.renderReady(body);
    // Each question slides in; the heading takes focus so a screen reader
    // reads the new question, not the button that was pressed.
    el.classList.remove('ob-enter');
    void el.offsetWidth;
    el.classList.add('ob-enter');
    var q = ET.$('#ob-q', el);
    try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); }
  };

  function option(group, key, icon, tone, label, sub, on) {
    return '<button type="button" class="ob-opt ob-' + tone + '" role="radio" aria-checked="' + !!on + '" ' +
      'data-' + group + '="' + key + '">' +
      '<span class="ob-ico">' + ET.icon(icon) + '</span>' +
      '<span class="ob-txt"><span class="ob-t">' + label + '</span>' +
      (sub ? '<span class="ob-s">' + sub + '</span>' : '') + '</span>' +
      '<span class="ob-tick" aria-hidden="true">' + ET.icon('check') + '</span></button>';
  }

  Funnel.prototype.choose = function (group, render) {
    var self = this, el = this.el;
    ET.$$('[data-' + group + ']', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-' + group);
        self[group] = key;
        ET.$$('[data-' + group + ']', el).forEach(function (o) {
          o.setAttribute('aria-checked', String(o === b));
        });
        render(key);
        self.go(true);
      });
    });
  };

  Funnel.prototype.go = function (on) {
    var b = ET.$('.ob-go', this.el);
    b.disabled = !on;
    b.classList.toggle('gold', on);
  };

  Funnel.prototype.renderWant = function (body) {
    var self = this, n = this.n;
    ET.$('#ob-q', this.el).innerHTML = h('ob.want.q');
    body.innerHTML = '<div class="ob-opts" role="radiogroup" aria-labelledby="ob-q">' +
      this.wants.map(function (w) {
        var c = countFor(w, n);
        return option('want', w.key, w.icon, w.tone, h('ob.want.' + w.key),
          c ? h('ob.want.n', { n: c }) : '', self.want === w.key);
      }).join('') + '</div>';
    ET.$('.ob-go', this.el).innerHTML = h('ob.continue');
    this.go(!!this.want);
    pose(this, 'thinking');
    this.choose('want', function (key) {
      var w = WANTS.filter(function (x) { return x.key === key; })[0];
      ET.$('.ob-say', self.el).innerHTML = h('ob.nice');
      pose(self, w.pose, 'hop');
    });
  };

  Funnel.prototype.renderNet = function (body) {
    var self = this;
    ET.$('#ob-q', this.el).innerHTML = h('ob.net.q');
    body.innerHTML = '<div class="ob-opts" role="radiogroup" aria-labelledby="ob-q">' +
      NETS.map(function (x) {
        return option('net', x.key, x.icon, 'night', h('ob.net.' + x.key), '', self.net === x.key);
      }).join('') + '</div>';
    ET.$('.ob-go', this.el).innerHTML = h('ob.continue');
    this.go(!!this.net);
    pose(this, 'neutral');
    if (this.net) ET.$('.ob-say', this.el).innerHTML = h('ob.net.' + this.net + '.say');
    this.choose('net', function (key) {
      var x = NETS.filter(function (y) { return y.key === key; })[0];
      ET.$('.ob-say', self.el).innerHTML = h('ob.net.' + key + '.say');
      pose(self, x.pose, key === 'wifi' ? 'hop' : 'nod');
    });
  };

  Funnel.prototype.renderReady = function (body) {
    var lang = ET.i18n.meta(ET.i18n.current());
    var w = WANTS.filter(function (x) { return x.key === this.want; }, this)[0];
    var c = w ? countFor(w, this.n) : this.n.all;
    ET.$('#ob-q', this.el).innerHTML = h('ob.ready');
    if (this.net) ET.$('.ob-say', this.el).innerHTML = h('ob.net.' + this.net + '.say');
    body.innerHTML = '<div class="ob-card">' +
      '<span class="ob-chip"><span class="ob-ico">' + ET.icon('globe') + '</span>' +
        '<span dir="' + lang.dir + '" lang="' + lang.code + '">' + ET.esc(lang.native) + '</span></span>' +
      (w ? '<span class="ob-chip ob-' + w.tone + '"><span class="ob-ico">' + ET.icon(w.icon) + '</span>' +
        '<span class="ob-txt"><span>' + h('ob.want.' + w.key) + '</span>' +
        (c ? '<span class="ob-s">' + h('ob.want.n', { n: c }) + '</span>' : '') + '</span></span>' : '') +
      (!w && c ? '<p class="ob-count">' + h('welcome.count', { n: c }) + '</p>' : '') +
      '</div>';
    var go = ET.$('.ob-go', this.el);
    go.innerHTML = ET.icon('book') + '<span>' + h('ob.open') + '</span>';
    this.go(true);
    pose(this, 'hooray', 'twirl');
  };

  Funnel.prototype.next = function () {
    if (this.step === 'want' && this.want) this.show('net');
    else if (this.step === 'net' && this.net) this.show('ready');
    else if (this.step === 'ready') this.finish();
  };

  Funnel.prototype.back = function () {
    if (this.step === 'ready') return this.show('net');
    if (this.step === 'net' && this.wants.length) return this.show('want');
    // Back to the language list, as it was.
    this.el.remove();
    this.root.classList.remove('ob-on');
    var pick = ET.$('#et-welcome-pick', this.root);
    if (pick) pick.scrollIntoView({ block: 'start' });
    var first = ET.$('.welcome-lang.guess', this.root) || ET.$('.welcome-lang', this.root);
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  };

  Funnel.prototype.finish = function () {
    ET.store.set('et.want', this.want && this.want !== 'all' ? this.want : '');
    if (this.net) ET.store.set('et.net', this.net);
    ET.store.set('et.onboarded', '1');
    this.done();
    // apply() re-runs every page's render, so Home redraws with the chosen
    // shelf first.
    ET.i18n.apply();
  };

  /* Called by i18n.js welcome() once a language is chosen. */
  function start(root, done) {
    var f = new Funnel(root, done);
    f.mount();
    f.show(f.wants.length ? 'want' : 'net');
    return f;
  }

  ET.onboarding = { start: start, decorate: decorate, WANTS: WANTS, NETS: NETS };
  return ET.onboarding;
});
