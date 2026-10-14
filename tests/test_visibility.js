'use strict';
// Built-in library switches: films and audio Bibles all on, five Scripture
// texts per language, old scans and the rest off, admin overrides on top.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP = path.join(__dirname, '..', 'app');
const code = fs.readFileSync(path.join(APP, 'assets/js/visibility.js'), 'utf8');

function load(catalog, live, storage) {
  const store = storage || {};
  const window = {};
  if (live !== undefined) window.ET_VISIBILITY_LIVE = live;
  const context = vm.createContext({
    window,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    JSON, Array, Object
  });
  vm.runInContext(fs.readFileSync(path.join(APP, 'data', catalog), 'utf8'), context);
  const all = window.LIBRARY.resources.slice();
  vm.runInContext(code, context);
  return { all, lib: window.LIBRARY, store, V: window.ET_VISIBILITY };
}

const count = (list, f) => list.filter(f).length;

test('defaults keep every film and audio Bible and five Scripture texts in English and one elsewhere', () => {
  const { all, lib } = load('catalog.js');
  const shown = lib.resources;
  assert.equal(count(shown, r => r.type === 'film'), count(all, r => r.type === 'film'));
  assert.equal(count(shown, r => r.type === 'audio-bible'), count(all, r => r.type === 'audio-bible'));
  for (const type of ['historic', 'audio', 'link']) assert.equal(count(shown, r => r.type === type), 0, type);
  // Books are off except in English, where the Bible Study Tool Box shows.
  assert.equal(count(shown, r => r.type === 'book' && r.lang !== 'eng'), 0, 'book');
  assert.ok(shown.some(r => r.id === 'eng-book-bible-study-toolbox'), 'English workbook shows');
  const langs = new Set(all.map(r => r.lang));
  for (const lang of langs) {
    const have = count(all, r => r.lang === lang && r.type === 'scripture');
    assert.equal(count(shown, r => r.lang === lang && r.type === 'scripture'), Math.min(have, lang === 'eng' ? 5 : 1), lang);
  }
  const eng = shown.filter(r => r.lang === 'eng' && r.type === 'scripture').map(r => r.title);
  assert.ok(eng.includes('King James Version') && eng.includes('World English Bible'));
  assert.equal(lib.allResources.length, all.length, 'nothing is deleted');
});

test('every chosen translation exists in the full and per-language catalogues', () => {
  const { all, V } = load('catalog.js');
  const ids = new Set(all.filter(r => r.type === 'scripture').map(r => r.id));
  for (const [lang, picks] of Object.entries(V.TOP_SCRIPTURE)) {
    assert.equal(picks.length, lang === 'eng' ? 5 : 1, lang);
    for (const id of picks) assert.ok(ids.has(id), id);
    const own = load('catalog-' + lang + '.js');
    assert.equal(count(own.lib.resources, r => r.type === 'scripture'), picks.length, lang);
  }
});

test('admin switches override the defaults for kinds and single items', () => {
  const live = { v: 1, types: { eng: { historic: true, film: false } }, items: { 'eng-text-engkjv': false } };
  const { all, lib } = load('catalog-eng.js', live);
  assert.equal(count(lib.resources, r => r.type === 'film'), 0);
  assert.equal(count(lib.resources, r => r.type === 'historic'), count(all, r => r.type === 'historic'));
  assert.ok(!lib.resources.some(r => r.id === 'eng-text-engkjv'));
});

test('offline pages reuse the last switches they saw, and a cleared server clears them', () => {
  const live = { v: 1, types: { eng: { film: false } }, items: {} };
  const first = load('catalog-eng.js', live);
  const offline = load('catalog-eng.js', undefined, first.store);
  assert.equal(count(offline.lib.resources, r => r.type === 'film'), 0);
  const cleared = load('catalog-eng.js', null, first.store);
  assert.ok(count(cleared.lib.resources, r => r.type === 'film') > 0);
  assert.ok(count(load('catalog-eng.js', undefined, cleared.store).lib.resources, r => r.type === 'film') > 0);
});

test('every page that loads a catalogue applies the switches right after it', () => {
  const pages = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) pages.push(full);
    }
  })(APP);
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    const m = /<script[^>]*src="(?:\.\.\/)?data\/catalog[^"]*"[^>]*><\/script>\s*([\s\S]*?)<\/script>\s*<script[^>]*src="([^"]+)"/.exec(html);
    if (!m) continue;
    if (page.includes(path.sep + 'admin' + path.sep)) {
      if (html.includes('visibility.js')) assert.ok(html.includes('ET_VISIBILITY_ADMIN = true'), page);
      continue;
    }
    assert.ok(m[1].includes('src="api/visibility"'), page);
    assert.equal(m[2], 'assets/js/visibility.js', page);
  }
});
