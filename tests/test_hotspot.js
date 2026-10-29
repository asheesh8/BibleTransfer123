// Sharing with no internet: the Wi-Fi code and the page the other phone sees.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/features/hotspot.js'), 'utf8');

function boot(plugin) {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ET = {
    native: !!plugin, esc, human: n => n + ' B',
    i18n: { t: k => k, h: k => k, current: () => 'sw' },
    module: (name, deps, fn) => fn(ET)
  };
  const window = { ET, Capacitor: { Plugins: plugin ? { Hotspot: plugin } : {} }, addEventListener() {} };
  vm.runInNewContext(source, { window, String, Object, URL, JSON });
  return ET.hotspot;
}

test('only the Android app, with its Hotspot plugin, offers it', () => {
  assert.equal(boot(null).ok, false);
  assert.equal(boot({ start() {} }).ok, true);
});

test('the Wi-Fi code escapes the characters a WIFI: code reserves', () => {
  const hs = boot({});
  assert.equal(hs.wifiCode('AndroidShare_1234', 'abc;d:e,f"g\\h'),
    'WIFI:T:WPA;S:AndroidShare_1234;P:abc\\;d\\:e\\,f\\"g\\\\h;;');
});

test('the page lists each file by its place, with names escaped', () => {
  const hs = boot({});
  const html = hs.page([{ name: 'Yesu <1>.mp4', bytes: 10 }, { name: 'Injili ya Yohana.mp3', bytes: 20 }]);
  assert.match(html, /^<!doctype html><html lang="sw">/);
  assert.ok(html.includes('href="/f/0/Yesu%20%3C1%3E.mp4"'));
  assert.ok(html.includes('<b>Yesu &lt;1&gt;.mp4</b>'));
  assert.ok(html.includes('href="/f/1/Injili%20ya%20Yohana.mp3"'));
  assert.ok(!/(src|href)="https?:/.test(html), 'the page must not need the internet');
});

test('the app on the other phone reads both codes', () => {
  const hs = boot({});
  assert.deepEqual({ ...hs.parseWifi(hs.wifiCode('AndroidShare_12', 'p;a:s,s"w\\d')) }, { ssid: 'AndroidShare_12', password: 'p;a:s,s"w\\d' });
  assert.equal(hs.parseWifi('https://www.bibletransfer123.org/'), null);
  assert.equal(hs.baseFrom('http://192.168.49.1:8080/'), 'http://192.168.49.1:8080/');
  assert.equal(hs.baseFrom('http://10.0.0.5:8080/f/0/x'), 'http://10.0.0.5:8080/');
  assert.equal(hs.baseFrom('https://www.bibletransfer123.org/kikuyu'), null);
  assert.equal(hs.baseFrom('http://evil.example:8080/'), null);
});

test('the list for the other phone keeps each film under its own address', () => {
  const hs = boot({});
  assert.deepEqual(JSON.parse(hs.listFor([{ name: 'a.mp4', bytes: 3, id: 'kik-film-jesus', url: 'https://cdn/a.mp4' }])),
    [{ n: 0, name: 'a.mp4', bytes: 3, id: 'kik-film-jesus', url: 'https://cdn/a.mp4' }]);
});
