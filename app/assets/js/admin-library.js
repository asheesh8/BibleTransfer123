/* Library switches: the admin chooses what every visitor sees.
   Only differences from the built-in defaults (visibility.js) are stored. */
(function () {
  'use strict';

  var V = window.ET_VISIBILITY;
  var LIB = window.LIBRARY;
  var KINDS = [
    ['film', 'Films'],
    ['audio-bible', 'Audio Bibles'],
    ['scripture', 'Scripture text'],
    ['audio', 'Audio collections'],
    ['historic', 'Old scans'],
    ['book', 'Books and guides'],
    ['link', 'Partner links']
  ];

  var message = document.getElementById('message');
  var loginPanel = document.getElementById('login-panel');
  var loginForm = document.getElementById('login-form');
  var password = document.getElementById('admin-password');
  var loading = document.getElementById('initial-loading');
  var editor = document.getElementById('editor');
  var langSelect = document.getElementById('lang');
  var kindsEl = document.getElementById('kinds');
  var saveStatus = document.getElementById('save-status');

  var state = { types: {}, items: {} };
  var saveTimer = null, saving = false, dirty = false;
  var openKinds = {};
  var started = false;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showMessage(text) { message.textContent = text || ''; message.hidden = !text; }

  function api(url, body) {
    var opts = { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } };
    if (body) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data && data.error || 'The server could not be reached.'); e.status = res.status; throw e; }
        return data;
      });
    });
  }

  // ------------------------------------------------------------ the data
  var byLang = {};
  (LIB && LIB.resources || []).forEach(function (r) { (byLang[r.lang] = byLang[r.lang] || []).push(r); });
  var langs = Object.keys(byLang).sort(function (a, b) { return langName(a).localeCompare(langName(b)); });

  function langName(code) { var l = LIB.languages && LIB.languages[code]; return l ? l.name : code; }

  function resolved(lang) { return V.resolve(byLang[lang] || [], state); }

  // -------------------------------------------------------- state changes
  function setType(lang, type, on) {
    var t = state.types[lang] || (state.types[lang] = {});
    var def = V.typeDefault(lang, type);
    if (on === def) delete t[type]; else t[type] = on;
    if (!Object.keys(t).length) delete state.types[lang];
  }

  function setItem(x, on) {
    if (on === x.itemDefault) delete state.items[x.r.id]; else state.items[x.r.id] = on;
  }

  function changed() {
    dirty = true;
    render();
    status('Saving…', '');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 600);
  }

  function status(text, cls) { saveStatus.textContent = text; saveStatus.className = 'lib-save' + (cls ? ' ' + cls : ''); }

  function save() {
    if (saving) { saveTimer = setTimeout(save, 400); return; }
    saving = true; dirty = false;
    api('/api/visibility', { action: 'save', types: state.types, items: state.items }).then(function () {
      if (!dirty) status('Saved. Everyone sees this within a few seconds.', 'ok');
      showMessage('');
    }).catch(function (e) {
      dirty = true;
      status('Not saved', 'err');
      if (e.status === 401) { showMessage('Your admin session has ended. Sign in again; your last change was not saved.'); showLogin(); }
      else showMessage('Could not save: ' + e.message);
    }).finally(function () { saving = false; });
  }

  // ------------------------------------------------------------- drawing
  function sw(attrs, on, label) {
    return '<label class="sw"><input type="checkbox" ' + attrs + (on ? ' checked' : '') +
      ' aria-label="' + esc(label) + '"><span></span></label>';
  }

  function renderEverywhere() {
    document.getElementById('everywhere').innerHTML = KINDS.map(function (k) {
      var on = 0, total = 0;
      langs.forEach(function (l) {
        if (!byLang[l].some(function (r) { return r.type === k[0]; })) return;
        total++; if (V.typeOn(l, k[0], state)) on++;
      });
      if (!total) return '';
      return '<div class="ev-row"><div><strong>' + esc(k[1]) + '</strong><br><small>On in ' + on + ' of ' + total + ' languages</small></div><div>' +
        '<button class="button button-quiet" type="button" data-all="' + k[0] + '" data-on="1">All on</button> ' +
        '<button class="button button-quiet" type="button" data-all="' + k[0] + '" data-on="0">All off</button></div></div>';
    }).join('');
  }

  function render() {
    renderEverywhere();
    var lang = langSelect.value;
    var rows = resolved(lang);
    var shown = rows.filter(function (x) { return x.visible; }).length;
    var opt = langSelect.options[langSelect.selectedIndex];
    if (opt) opt.textContent = langName(lang) + ' (' + shown + ' of ' + rows.length + ' showing)';
    kindsEl.innerHTML = KINDS.map(function (k) {
      var list = rows.filter(function (x) { return x.r.type === k[0]; });
      if (!list.length) return '';
      var kindOn = V.typeOn(lang, k[0], state);
      var itemsOn = list.filter(function (x) { return x.itemOn; }).length;
      var visible = kindOn ? itemsOn : 0;
      return '<section class="panel kind' + (kindOn ? '' : ' off') + '">' +
        '<div class="kind-head"><h2>' + esc(k[1]) +
          '<span class="n">' + (kindOn ? visible + ' of ' + list.length + ' showing' : 'Hidden · ' + list.length + ' kept') + '</span></h2>' +
          sw('data-kind="' + k[0] + '"', kindOn, k[1] + ' in ' + langName(lang)) + '</div>' +
        '<div class="kind-tools">' +
          '<button class="button button-quiet" type="button" data-items="' + k[0] + '" data-on="1">Every item on</button>' +
          '<button class="button button-quiet" type="button" data-items="' + k[0] + '" data-on="0">Every item off</button>' +
          '<button class="button button-quiet" type="button" data-items="' + k[0] + '" data-on="default">Default picks</button>' +
        '</div>' +
        '<details data-open="' + k[0] + '"' + (openKinds[lang + k[0]] ? ' open' : '') + '><summary>Choose items one by one (' + itemsOn + ' of ' + list.length + ' on)</summary>' +
        '<ul class="items">' + list.map(function (x) {
          var r = x.r, bits = [r.native && r.native !== r.title ? r.native : '', r.year, r.org].filter(Boolean).join(' · ');
          var pick = r.type === 'scripture' && x.itemDefault ? '<span class="tag">DEFAULT</span>' : '';
          return '<li><span class="t">' + esc(r.title) + pick + (bits ? '<small>' + esc(bits) + '</small>' : '') + '</span>' +
            sw('data-item="' + esc(r.id) + '"', x.itemOn, r.title) + '</li>';
        }).join('') + '</ul></details></section>';
    }).join('');
  }

  // -------------------------------------------------------------- events
  kindsEl.addEventListener('change', function (e) {
    var t = e.target, lang = langSelect.value;
    if (t.hasAttribute('data-kind')) { setType(lang, t.getAttribute('data-kind'), t.checked); changed(); }
    else if (t.hasAttribute('data-item')) {
      var id = t.getAttribute('data-item');
      resolved(lang).forEach(function (x) { if (x.r.id === id) setItem(x, t.checked); });
      changed();
    }
  });
  kindsEl.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d.hasAttribute && d.hasAttribute('data-open')) openKinds[langSelect.value + d.getAttribute('data-open')] = d.open;
  }, true);
  kindsEl.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-items]');
    if (!b) return;
    var type = b.getAttribute('data-items'), mode = b.getAttribute('data-on'), lang = langSelect.value;
    resolved(lang).forEach(function (x) {
      if (x.r.type !== type) return;
      setItem(x, mode === 'default' ? x.itemDefault : mode === '1');
    });
    if (mode !== '0') setType(lang, type, true);
    changed();
  });
  document.getElementById('everywhere').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-all]');
    if (!b) return;
    var type = b.getAttribute('data-all'), on = b.getAttribute('data-on') === '1';
    langs.forEach(function (l) { setType(l, type, on); });
    changed();
  });
  document.getElementById('reset-lang').addEventListener('click', function () {
    var lang = langSelect.value;
    if (!confirm('Put ' + langName(lang) + ' back to the defaults: all films and audio Bibles, the default Scripture text (five in English), everything else off?')) return;
    delete state.types[lang];
    (byLang[lang] || []).forEach(function (r) { delete state.items[r.id]; });
    changed();
  });
  langSelect.addEventListener('change', render);
  window.addEventListener('beforeunload', function (e) {
    if (dirty || saving) { e.preventDefault(); e.returnValue = ''; }
  });

  // ------------------------------------------------------------- sign in
  function showLogin() {
    editor.hidden = true; loading.hidden = true; loginPanel.hidden = false; password.focus();
  }

  function start(data) {
    if (started) {
      // Signed back in after the session ended: keep the unsaved switches.
      loginPanel.hidden = true; editor.hidden = false;
      if (dirty) save();
      return;
    }
    started = true;
    var s = data && data.state;
    state = { types: (s && s.types) || {}, items: (s && s.items) || {} };
    langSelect.innerHTML = langs.map(function (l) {
      return '<option value="' + esc(l) + '">' + esc(langName(l)) + '</option>';
    }).join('');
    if (byLang.eng) langSelect.value = 'eng';
    loginPanel.hidden = true; loading.hidden = true; editor.hidden = false;
    render();
  }

  function load() {
    return api('/api/visibility?format=json').then(function (data) {
      if (!data.admin) return showLogin();
      start(data);
    }).catch(function (e) {
      loading.hidden = true;
      showMessage(e.status ? e.message : 'The server could not be reached. Open this page on the online site.');
    });
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!password.value) return;
    showMessage('');
    api('/api/admin', { action: 'login', password: password.value }).then(function () {
      password.value = '';
      return load();
    }).catch(function (err) {
      showMessage(err.status === 401 ? 'The password was not accepted. Please try again.' : err.message);
    });
  });

  if (!LIB || !V) { loading.hidden = true; showMessage('The library catalogue did not load.'); return; }
  load();
})();
