// Inside the iPhone and Android apps (mobile/, Capacitor) the same core runs
// from the app itself, with no server of its own behind it.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/core.js'), 'utf8');

function boot({ native, protocol, href }) {
  const calls = { page: [], http: [] };
  const window = {
    addEventListener() {}, setTimeout() {},
    fetch(input, init) { calls.page.push(input); return Promise.resolve('page'); }
  };
  if (native !== undefined) {
    window.Capacitor = {
      isNativePlatform: () => native,
      Plugins: { CapacitorHttp: { request(options) {
        calls.http.push(options);
        return Promise.resolve({ status: 200, data: { ok: true } });
      } } }
    };
  }
  const registrations = [];
  const url = new URL(href);
  vm.runInNewContext(source, {
    window, document: { readyState: 'complete' }, URL, Response,
    location: { protocol, href, origin: url.origin, search: url.search },
    navigator: { serviceWorker: { register(u) { registrations.push(u); return Promise.resolve(); } } }
  });
  return { ET: window.ET, window, calls, registrations };
}

test('the app knows it is the app, on iPhone and on Android', () => {
  for (const [protocol, href] of [['capacitor:', 'capacitor://localhost/index.html'],
                                  ['https:', 'https://localhost/index.html']]) {
    const { ET } = boot({ native: true, protocol, href });
    assert.equal(ET.native, true);
    assert.equal(ET.online, true);
    assert.equal(ET.publicOrigin, 'https://www.bibletransfer123.org');
  }
});

test('links made inside the app point at the live site, not the phone', () => {
  const { ET } = boot({ native: true, protocol: 'capacitor:', href: 'capacitor://localhost/item.html?id=abc' });
  assert.equal(ET.publicHref(), 'https://www.bibletransfer123.org/item.html?id=abc');
});

test('the website and the card are unchanged', () => {
  const web = boot({ protocol: 'https:', href: 'https://www.bibletransfer123.org/library.html' });
  assert.equal(web.ET.native, false);
  assert.equal(web.ET.online, true);
  assert.equal(web.ET.publicOrigin, 'https://www.bibletransfer123.org');
  assert.equal(web.window.fetch('/api/analytics') instanceof Promise, true);
  assert.deepEqual(web.calls.page, ['/api/analytics']);
  const card = boot({ native: false, protocol: 'file:', href: 'file:///sdcard/index.html' });
  assert.equal(card.ET.native, false);
  assert.equal(card.ET.online, false);
});

test('the app sends its /api calls to the live site through native HTTP', async () => {
  const app = boot({ native: true, protocol: 'capacitor:', href: 'capacitor://localhost/index.html' });
  const res = await app.window.fetch('/api/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"events":[]}'
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const sent = app.calls.http[0];
  assert.equal(sent.url, 'https://www.bibletransfer123.org/api/analytics');
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.Origin, 'https://www.bibletransfer123.org');
  assert.deepEqual(JSON.parse(JSON.stringify(sent.data)), { events: [] });
  await app.window.fetch('https://cdn.example/film.mp4');
  assert.deepEqual(app.calls.page, ['https://cdn.example/film.mp4']);
});

test('the app never installs the website\'s service worker', () => {
  const app = boot({ native: true, protocol: 'https:', href: 'https://localhost/index.html' });
  assert.deepEqual(app.registrations, []);
});

test('a kept film can be deleted from the phone, and is forgotten', async () => {
  const { ET, window } = boot({ native: true, protocol: 'https:', href: 'https://localhost/index.html' });
  const deleted = [];
  window.Capacitor.Plugins.Filesystem = { deleteFile: o => (deleted.push(o.path), Promise.resolve()) };
  ET.store.set('et.kept', JSON.stringify({
    'https://cdn/a.mp4': { uri: 'file:///d/a.mp4', name: 'a.mp4', bytes: 1, id: 'x' },
    'https://cdn/b.mp4': { uri: 'file:///d/b.mp4', name: 'b.mp4', bytes: 2, id: 'y' }
  }));
  assert.deepEqual(Object.keys(ET.keptFiles()), ['https://cdn/a.mp4', 'https://cdn/b.mp4']);
  await ET.forgetKept('https://cdn/a.mp4');
  await ET.forgetKept('https://cdn/never.mp4');
  assert.deepEqual(deleted, ['file:///d/a.mp4']);
  assert.deepEqual(Object.keys(ET.keptFiles()), ['https://cdn/b.mp4']);
});
