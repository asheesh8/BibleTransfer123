/* ============================================================================
   ET.app: what only the iPhone and Android apps need on every page.

   Depends on: core.js, i18n.js, ui/shell.js; css/consent.css.

   · Footer links to Privacy, Delete my data and Help, and the app's version.
     Both stores expect them inside the app, not only on the website.
   · Asks /api/app-config (registry/app-config.json on the site) at most every
     six hours, sending only the platform and the version:
       update "required"   a full-screen "Please update" with the store link,
                           only on a fresh answer, so a phone with no internet
                           can still play what it has saved
       update "available"  one quiet note per new version
       notice              one note per notice id
       features            kept for ET.feature (core.js) to read
   The web and cards never load this file (shell.js loads it when ET.native).
   ========================================================================= */

window.ET.module('features/app', ['core', 'i18n', 'ui/shell'], function (ET) {
  'use strict';

  var t = ET.i18n.t, h = ET.i18n.h;
  var KEY = 'et.appconfig', EVERY = 6 * 3600000;
  var VERSION = String(window.ET_APP_VERSION || '');
  var PLATFORM = window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : '';
  var ROOT = ((document.currentScript && document.currentScript.src) || '')
    .replace(/assets\/js\/features\/app\.js(\?.*)?$/, '');

  function read(key) {
    try { return JSON.parse(window.localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  // True the first time this value is seen under key, then never again.
  function once(key, value) {
    if (!value || read(key) === value) return false;
    write(key, value);
    return true;
  }

  function links() {
    var main = document.querySelector('main#main') || document.querySelector('main');
    if (!main || document.getElementById('et-app-links')) return;
    var nav = document.createElement('nav');
    nav.id = 'et-app-links';
    nav.className = 'app-links';
    nav.setAttribute('aria-label', t('app.name'));
    nav.innerHTML =
      '<a href="' + ROOT + 'privacy.html">' + h('app.privacy') + '</a>' +
      '<a href="' + ROOT + 'delete-data.html">' + h('app.delete') + '</a>' +
      '<a href="' + ROOT + 'support.html">' + h('app.help') + '</a>' +
      (VERSION ? '<span class="app-version">' + h('app.version', { v: VERSION }) + '</span>' : '');
    main.appendChild(nav);
  }

  function block(config) {
    if (document.getElementById('et-app-update')) return;
    var el = document.createElement('div');
    el.className = 'app-update';
    el.id = 'et-app-update';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'et-app-update-title');
    el.innerHTML = '<div>' + ET.lantern(96) +
      '<h2 id="et-app-update-title">' + h('app.update.title') + '</h2>' +
      '<p>' + h('app.update.body') + '</p>' +
      (config.storeUrl ? '<a class="btn block" href="' + ET.esc(config.storeUrl) + '">' + h('app.update.go') + '</a>' : '') +
      '</div>';
    document.body.appendChild(el);
    var go = el.querySelector('a');
    if (go) go.focus();
  }

  function apply(config, fresh) {
    if (!config) return;
    if (config.update === 'required' && fresh) block(config);
    else if (config.update === 'available' && once(KEY + '.offered', config.latestVersion)) ET.toast(t('app.update.available'));
    if (config.notice && config.notice.text && once(KEY + '.notice', String(config.notice.id))) ET.toast(String(config.notice.text));
  }

  function check(now) {
    var cached = read(KEY);
    if (cached && cached.data && now - cached.at < EVERY) { apply(cached.data, false); return Promise.resolve(cached.data); }
    var q = '?platform=' + encodeURIComponent(PLATFORM) + '&version=' + encodeURIComponent(VERSION);
    return fetch('/api/app-config' + q).then(function (res) {
      if (!res.ok) throw new Error('app-config ' + res.status);
      return res.json();
    }).then(function (data) {
      write(KEY, { at: now, data: data });
      apply(data, true);
      return data;
    }, function () { return cached && cached.data; });   // no internet: carry on with what we had
  }

  function start() {
    links();
    if (ET.i18n.onChange) ET.i18n.onChange(function () {
      var old = document.getElementById('et-app-links');
      if (old) old.remove();
      links();
    });
    return check(Date.now());
  }

  ET.app = { start: start, check: check, links: links };
  return ET.app;
});
