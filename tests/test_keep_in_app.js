// Inside the phone apps a save is kept in the app's own storage and plays from there.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/assets/js/save.js'), 'utf8');

function boot(native) {
  const mem = {}, calls = [];
  let progress = null;
  const Capacitor = {
    convertFileSrc: uri => uri.replace('file://', 'https://localhost/_capacitor_file_'),
    Plugins: {
      Filesystem: {
        mkdir: o => (calls.push(['mkdir', o]), Promise.resolve()),
        getUri: o => Promise.resolve({ uri: 'file:///data/' + o.path }),
        deleteFile: o => (calls.push(['delete', o]), Promise.resolve())
      },
      FileTransfer: {
        addListener: (_, fn) => { progress = fn; return Promise.resolve({ remove() { calls.push(['unlisten']); } }); },
        downloadFile: o => {
          calls.push(['download', o]);
          progress({ url: o.url, bytes: 5, contentLength: 10, lengthComputable: true });
          return Promise.resolve({ path: o.path });
        }
      }
    }
  };
  const ET = {
    native, i18n: { t: k => k, h: k => k },
    store: { get: (k, d) => k in mem ? mem[k] : d, set: (k, v) => { mem[k] = v; } },
    analytics: { track() {} }
  };
  const window = { ET, Capacitor: native ? Capacitor : undefined };
  vm.runInNewContext(source, { window, URL, location: { href: 'https://localhost/item.html' },
    indexedDB: undefined, AbortController, Promise, Error });
  return { save: ET.save, calls, mem };
}

test('the website and the card never offer to keep files in an app', () => {
  const { save } = boot(false);
  assert.equal(save.inApp, false);
  assert.equal(save.local('https://cdn.example/film.mp4'), 'https://cdn.example/film.mp4');
});

test('a kept file is streamed to app storage and then plays from the phone', async () => {
  const { save, calls } = boot(true);
  assert.equal(save.inApp, true);
  const url = 'https://cdn.example/jesus.mp4';
  assert.equal(save.local(url), url);
  const seen = [];
  const result = await save.keep({ name: 'Jesus - MP4.mp4', bytes: 10 }, url, null, (a, b) => seen.push([a, b]));
  assert.deepEqual(seen, [[5, 10]]);
  const download = calls.find(c => c[0] === 'download')[1];
  assert.equal(download.url, url);
  assert.match(download.path, /^file:\/\/\/data\/library\/[0-9a-z]+\/Jesus - MP4\.mp4$/);
  assert.equal(result.kept, download.path);
  assert.equal(save.local(url), download.path.replace('file://', 'https://localhost/_capacitor_file_'));
  assert.ok(calls.some(c => c[0] === 'unlisten'));
});

test('stopping a save throws the finished copy away instead of keeping it', async () => {
  const { save, calls } = boot(true);
  const ctrl = new AbortController();
  const url = 'https://cdn.example/long.mp4';
  const kept = save.keep({ name: 'Long.mp4', bytes: 10 }, url, ctrl.signal, () => {});
  ctrl.abort();
  await assert.rejects(kept, { name: 'AbortError' });
  await new Promise(r => setTimeout(r, 10));
  assert.ok(calls.some(c => c[0] === 'delete'));
  assert.equal(save.local(url), url);
});
