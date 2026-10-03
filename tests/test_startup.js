// Offline installation must never compete with the page's startup requests.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/core.js'), 'utf8');

function boot({ protocol = 'https:', readyState = 'loading', idle = true } = {}) {
  const listeners = {}, pending = [], registrations = [];
  const window = {
    addEventListener(name, fn) { listeners[name] = fn; },
    setTimeout(fn) { pending.push(fn); }
  };
  if (idle) window.requestIdleCallback = fn => pending.push(fn);
  vm.runInNewContext(source, {
    window, document: { readyState }, location: { protocol },
    navigator: { serviceWorker: { register(url) {
      registrations.push(url); return Promise.resolve();
    } } }
  });
  return { listeners, pending, registrations, ET: window.ET };
}

test('the app core is usable before offline installation starts', () => {
  for (const idle of [true, false]) {
    const page = boot({ idle });
    assert.equal(typeof page.ET.library, 'function');
    assert.equal(page.pending.length, 0);
    assert.deepEqual(page.registrations, []);
    page.listeners.load();
    assert.deepEqual(page.registrations, []);
    page.pending.shift()();
    assert.deepEqual(page.registrations, ['sw.js']);
  }
});

test('a core loaded after the load event still installs offline support', () => {
  const page = boot({ readyState: 'complete' });
  assert.equal(page.pending.length, 1);
  page.pending.shift()();
  assert.deepEqual(page.registrations, ['sw.js']);
});

test('opening a microSD card never schedules a service worker', () => {
  const page = boot({ protocol: 'file:' });
  assert.equal(typeof page.ET.library, 'function');
  assert.equal(page.listeners.load, undefined);
  assert.equal(page.pending.length, 0);
  assert.deepEqual(page.registrations, []);
});
