'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/assets/js/analytics.js'), 'utf8');

function client(options = {}) {
  const persistent = new Map(), temporary = new Map(), requests = [], listeners = {};
  if (options.consent) persistent.set('et.consent', JSON.stringify(options.consent));
  const storage = map => ({ getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  const location = new URL(options.url || 'https://library.example/english');
  const context = {
    URL, URLSearchParams, Uint8Array, Date, Number, Object, JSON, Array, String,
    location, localStorage: storage(persistent), sessionStorage: storage(temporary),
    navigator: { onLine: true, globalPrivacyControl: options.gpc === true },
    document: { readyState: 'loading', referrer: options.referrer || '', addEventListener() {}, getElementById() { return null; } },
    setTimeout: () => 1, clearTimeout() {},
    fetch: async (url, config) => { requests.push({ url, config, body: JSON.parse(config.body) }); return { ok: true }; },
    crypto: { getRandomValues: values => crypto.randomFillSync(values) },
    addEventListener: (type, callback) => { listeners[type] = callback; },
    ET: { contentLang: () => 'eng', byId: value => value === 'book-1' ? { id: value, lang: 'eng' } : null,
      qs: key => new URLSearchParams(location.search).get(key), libraryScope: () => null }
  };
  context.window = context;
  vm.runInNewContext(source, context);
  return { analytics: context.ET.analytics, context, persistent, temporary, requests, listeners };
}
const accepted = () => ({ version: 1, analytics: true, at: Date.now() });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('unknown or declined consent creates no analytics identity, request, or link tag', async () => {
  for (const consent of [undefined, { version: 1, analytics: false, at: Date.now() }]) {
    const c = client({ consent });
    c.analytics.track('page_view');
    assert.equal(c.analytics.shareIntent('https://library.example/english', 'email').url, 'https://library.example/english');
    c.analytics.flush(); await settle();
    assert.equal(c.requests.length, 0);
    assert.equal(c.persistent.has('et.analytics.visitor'), false);
    assert.equal(c.temporary.size, 0);
  }
});

test('accepted activity uses random IDs and strips private fields and query strings', async () => {
  const c = client({ consent: accepted(), url: 'https://library.example/item.html?id=book-1&email=private%40example.test',
    referrer: 'https://search.example/private?email=private@example.test' });
  c.analytics.track('page_view', { email: 'private@example.test', filename: 'private.pdf', search: 'sensitive' });
  c.analytics.track('download_complete', { resource: 'book-1', status: 'saved', bytes: 1024 });
  c.analytics.flush(); await settle();
  assert.equal(c.requests.length, 1);
  const events = c.requests[0].body.events;
  assert.equal(events[0].type, 'session_start');
  assert.equal(events[1].path, '/item.html');
  assert.equal(events[1].referrer, 'search.example');
  assert.equal(events[1].resource, 'book-1');
  assert.equal(events[2].bytes, 1024);
  assert.match(events[1].visitorId, /^[a-f0-9]{32}$/);
  assert.match(events[1].sessionId, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(events).includes('private'), false);
  assert.deepEqual(Object.keys(c.requests[0].body.consent).sort(), ['analytics', 'version']);
});

test('tagged sharing preserves scope and creates a fresh reference per action', async () => {
  const c = client({ consent: accepted() });
  const url = 'https://library.example/item.html?id=book-1&only=eng&ui=en#chapter';
  const first = c.analytics.shareIntent(url, 'email', { resource: 'book-1' });
  const second = c.analytics.shareIntent(url, 'email', { resource: 'book-1' });
  const parsed = new URL(first.url);
  assert.equal(parsed.searchParams.get('only'), 'eng');
  assert.equal(parsed.searchParams.get('id'), 'book-1');
  assert.equal(parsed.hash, '#chapter');
  assert.equal(parsed.searchParams.get('et_share'), first.shareId);
  assert.equal(parsed.searchParams.get('et_channel'), 'email');
  assert.notEqual(first.shareId, second.shareId);
  assert.equal(c.analytics.shareUrl('https://publisher.example/book', 'email'), 'https://publisher.example/book');
  c.analytics.flush(); await settle();
  assert.equal(c.requests[0].body.events.filter(e => e.type === 'share_intent').length, 2);
});

test('shared-link attribution updates an existing session after acceptance', async () => {
  const c = client({ consent: accepted() });
  c.analytics.track('page_view');
  const previous = JSON.parse(c.temporary.get('et.analytics.session')).id;
  c.context.location.search = '?et_share=shared-reference-1&et_channel=email';
  c.analytics.track('shared_visit', { shareId: 'shared-reference-1', channel: 'email' });
  c.analytics.track('resource_open', { resource: 'book-1' });
  c.analytics.flush(); await settle();
  const events = c.requests[0].body.events;
  assert.equal(events.filter(e => e.type === 'session_start').length, 1);
  assert.equal(events.at(-1).sessionId, previous);
  assert.equal(events.at(-1).shareId, 'shared-reference-1');
});

test('withdrawal in another tab removes analytics identity and queued activity', async () => {
  const c = client({ consent: accepted() });
  c.analytics.track('page_view');
  assert.ok(c.persistent.has('et.analytics.visitor'));
  c.persistent.set('et.consent', JSON.stringify({ version: 1, analytics: false, at: Date.now() }));
  c.listeners.storage({ key: 'et.consent' });
  c.analytics.flush(); await settle();
  assert.equal(c.requests.length, 0);
  assert.equal(c.persistent.has('et.analytics.visitor'), false);
  assert.equal(c.temporary.size, 0);
});

test('expired, outdated, privacy-signalled, and file copies collect nothing', async () => {
  for (const options of [
    { consent: { version: 1, analytics: true, at: Date.now() - 181 * 86400000 } },
    { consent: { version: 0, analytics: true, at: Date.now() } },
    { consent: accepted(), gpc: true },
    { consent: accepted(), url: 'file:///card/app/index.html' }
  ]) {
    const c = client(options);
    c.analytics.track('page_view'); c.analytics.flush(); await settle();
    assert.equal(c.requests.length, 0);
    assert.equal(c.persistent.has('et.analytics.visitor'), false);
  }
});

test('failed requests retry with the same event IDs; revocation discards retry', async () => {
  const c = client({ consent: accepted() });
  c.context.fetch = async (url, config) => { c.requests.push(JSON.parse(config.body)); return { ok: false }; };
  c.analytics.track('page_view'); c.analytics.flush(); await settle();
  c.analytics.flush(); await settle();
  assert.deepEqual(c.requests[0].events.map(e => e.id), c.requests[1].events.map(e => e.id));
  c.persistent.set('et.consent', JSON.stringify({ version: 1, analytics: false, at: Date.now() }));
  c.listeners.storage({ key: 'et.consent' });
  c.analytics.flush(); await settle();
  assert.equal(c.requests.length, 2);
});
