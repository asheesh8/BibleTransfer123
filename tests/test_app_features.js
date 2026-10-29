// What only the phone apps add to every page (features/app.js): footer links,
// and the answer from /api/app-config.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/features/app.js'), 'utf8');

function el(tag) {
  const node = { tagName: tag, children: [], attrs: {}, innerHTML: '', id: '', className: '',
    setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); all.push(c); return c; },
    remove() { all.splice(all.indexOf(this), 1); }, querySelector() { return null; }, focus() {} };
  return node;
}
let all = [];
function boot(answer, stored) {
  all = [];
  const storage = new Map(Object.entries(stored || {}));
  const main = el('main'), body = el('body');
  const calls = { fetch: [], toast: [] };
  const ET = {
    native: true, esc: s => String(s), lantern: () => '<svg></svg>',
    toast: text => calls.toast.push(text),
    i18n: { t: k => k, h: (k, v) => k + (v ? ':' + v.v : ''), onChange() {} },
    module: (name, deps, fn) => fn(ET)
  };
  const window = {
    ET, ET_APP_VERSION: '1.0.0', Capacitor: { getPlatform: () => 'android' },
    localStorage: { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, v) }
  };
  const document = {
    currentScript: { src: 'https://localhost/assets/js/features/app.js' }, body,
    querySelector: s => s.startsWith('main') ? main : null,
    getElementById: id => all.find(n => n.id === id) || null,
    createElement: el
  };
  const fetch = url => {
    calls.fetch.push(url);
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(answer) });
  };
  vm.runInNewContext(source, { window, document, fetch, JSON, String, Promise, encodeURIComponent });
  return { app: ET.app, main, body, calls, storage };
}

test('every page in the app links to privacy, deleting data and help, with the version', async () => {
  const { app, main } = boot({ update: 'none' });
  await app.start();
  const nav = main.children[0];
  assert.match(nav.innerHTML, /href="https:\/\/localhost\/privacy\.html"/);
  assert.match(nav.innerHTML, /href="https:\/\/localhost\/delete-data\.html"/);
  assert.match(nav.innerHTML, /href="https:\/\/localhost\/support\.html"/);
  assert.match(nav.innerHTML, /app\.version:1\.0\.0/);
});

test('the update check sends only the platform and the version, at most every six hours', async () => {
  const { app, calls, storage } = boot({ update: 'none' });
  await app.check(1000);
  assert.deepEqual(calls.fetch, ['/api/app-config?platform=android&version=1.0.0']);
  await app.check(1000 + 3600000);
  assert.equal(calls.fetch.length, 1);
  assert.ok(storage.get('et.appconfig'));
});

test('a broken version is blocked only on a fresh answer, so saved films still play offline', async () => {
  const required = { update: 'required', storeUrl: 'https://play.google.com/store/apps/details?id=org.villageservers.library' };
  const fresh = boot(required);
  await fresh.app.check(1000);
  const screen = fresh.body.children.find(n => n.id === 'et-app-update');
  assert.ok(screen);
  assert.match(screen.innerHTML, /play\.google\.com/);

  const offline = boot(new Error('offline'), { 'et.appconfig': JSON.stringify({ at: 0, data: required }) });
  await offline.app.check(1000 + 7 * 3600000);
  assert.equal(offline.body.children.length, 0);
});

test('a new version and a notice are each mentioned once', async () => {
  const answer = { update: 'available', latestVersion: '1.1.0', notice: { id: 'n1', text: 'Hello' } };
  const { app, calls, storage } = boot(answer);
  await app.check(1000);
  assert.deepEqual(calls.toast, ['app.update.available', 'Hello']);
  storage.delete('et.appconfig');
  await app.check(2000);
  assert.equal(calls.toast.length, 2);
});
