// A QR code scanned inside the app opens our own pages there, and nothing else.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/features/scan.js'), 'utf8');

function boot(native, href) {
  const toasts = [], fetched = [];
  const loc = new URL(href);
  const ET = {
    native, i18n: { t: k => k, h: k => k },
    toast: m => toasts.push(m), icon: () => '',
    module: (name, deps, fn) => fn(ET)
  };
  const routes = { kisii: 'gusii/index.html', privacy: 'privacy.html' };
  const window = { ET };
  vm.runInNewContext(source, {
    window, URL, Promise, Error, String,
    location: loc,
    document: { currentScript: { src: href.replace(/^(\w+:\/\/[^/]+\/).*/, '$1') + 'assets/js/features/scan.js' } },
    fetch: url => (fetched.push(url), Promise.resolve({ ok: true, json: () => Promise.resolve(routes) }))
  });
  return { scan: ET.scan, toasts, fetched };
}

test('in the app, our links open the matching page among the files', async () => {
  const { scan, fetched } = boot(true, 'capacitor://localhost/index.html');
  const at = 'capacitor://localhost/';
  assert.equal(await scan.target('https://bibletransfer123.org/kikuyu?src=qr'), at + 'kikuyu/index.html?src=qr');
  assert.equal(await scan.target('https://www.bibletransfer123.org/kisii'), at + 'gusii/index.html');
  assert.equal(await scan.target('https://www.bibletransfer123.org/privacy'), at + 'privacy.html');
  assert.equal(await scan.target('https://www.bibletransfer123.org/'), at + 'index.html');
  assert.equal(await scan.target('https://www.bibletransfer123.org/nearby.html?join=482915'),
    at + 'nearby.html?join=482915');
  assert.equal(await scan.target('https://www.bibletransfer123.org/item.html?id=x#t'), at + 'item.html?id=x#t');
  assert.equal(await scan.target('482 915'), at + 'nearby.html?join=482915');
  assert.deepEqual(fetched, [at + 'routes.json']);
});

test('codes that are not ours are never opened', async () => {
  const { scan, toasts } = boot(true, 'https://localhost/kikuyu/index.html');
  assert.equal(await scan.target('https://evil.example/bibletransfer123.org'), null);
  assert.equal(await scan.target('https://bibletransfer123.org.evil.example/'), null);
  assert.equal(await scan.target('WIFI:S:x;T:WPA;P:y;;'), null);
  assert.equal(await scan.target('javascript:alert(1)'), null);
  assert.equal(await scan.go('hello'), false);
  assert.deepEqual(toasts, ['scan.other']);
});

test('on the website, our links open as they are', async () => {
  const { scan, fetched } = boot(false, 'https://www.bibletransfer123.org/nearby.html');
  assert.equal(await scan.target('https://www.bibletransfer123.org/kikuyu?src=qr'),
    'https://www.bibletransfer123.org/kikuyu?src=qr');
  assert.equal(await scan.target('https://www.bibletransfer123.org/admin'), 'https://www.bibletransfer123.org/admin');
  assert.deepEqual(fetched, []);
});
