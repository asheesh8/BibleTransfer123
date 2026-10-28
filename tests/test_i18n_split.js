// The per-language interface builds stay in step with i18n.js and pick the right file.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const { build, SOURCE, JS } = require('../packer/write_i18n_split.js');

const source = fs.readFileSync(SOURCE, 'utf8');
const files = build(source);

function load(code, stored = {}) {
  const ET = { libraryScope: () => null, store: { get: (k, d) => (k in stored ? stored[k] : d), set() {} },
    $$: () => [], $: () => null, esc: v => v };
  const window = { ET };
  vm.runInNewContext(code, { window, document: { documentElement: { setAttribute() {} } }, navigator: { languages: [] } });
  return ET.i18n;
}

test('committed language builds match a fresh build of i18n.js (run `npm run i18n`)', () => {
  const written = fs.readdirSync(path.join(JS, 'i18n')).map(f => 'i18n/' + f).concat('i18n-pick.js').sort();
  assert.deepEqual(written, Object.keys(files).sort());
  for (const [name, body] of Object.entries(files)) {
    assert.equal(fs.readFileSync(path.join(JS, name), 'utf8'), body, name + ' is out of date');
  }
});

test('each build speaks its language exactly as the complete file does, plus the every-language lines', () => {
  const full = load(source);
  for (const lang of full.langs) {
    const partial = load(files['i18n/' + lang.code + '.js'], { 'et.lang': lang.code });
    const complete = load(source, { 'et.lang': lang.code });
    for (const key of ['app.name', 'home.greet', 'lib.search', 'item.recordings', 'tab.library', 'ui.mainnav']) {
      assert.equal(partial.t(key), complete.t(key), `${lang.code} ${key}`);
      assert.equal(partial.h(key), complete.h(key), `${lang.code} ${key} html`);
    }
    for (const other of full.langs) {
      assert.equal(partial.say('welcome.title', other.code), full.say('welcome.title', other.code));
      assert.equal(partial.say('ui.changelang', other.code), full.say('ui.changelang', other.code));
      assert.equal(partial.say('welcome.count', other.code, { n: 3 }), full.say('welcome.count', other.code, { n: 3 }));
    }
    const kb = Buffer.byteLength(files['i18n/' + lang.code + '.js']) / 1024;
    assert.ok(kb < 160, `${lang.code} build is ${Math.round(kb)} KB`);
  }
});

test('i18n-pick.js chooses the scoped, saved or complete interface file', () => {
  function pick({ search = '', stored = null, lib, sync = false }) {
    let written = '';
    const window = { ET_SHARED_LIBRARY: lib };
    vm.runInNewContext(files['i18n-pick.js'], {
      window, location: { search },
      localStorage: { getItem: () => stored },
      document: { currentScript: { hasAttribute: n => sync && n === 'data-sync' }, write: s => { written += s; } }
    });
    return written;
  }
  assert.equal(pick({}), '<script defer src="assets/js/i18n.js"></script>');
  assert.equal(pick({ stored: 'swh' }), '<script defer src="assets/js/i18n/swh.js"></script>');
  assert.equal(pick({ stored: 'xx' }), '<script defer src="assets/js/i18n.js"></script>');
  assert.equal(pick({ stored: 'en', lib: { lang: 'kuj', ui: 'swh' } }), '<script defer src="assets/js/i18n/swh.js"></script>');
  assert.equal(pick({ search: '?id=a&only=swh&ui=swh', stored: 'ar' }), '<script defer src="assets/js/i18n/swh.js"></script>');
  assert.equal(pick({ search: '?id=a&only=swh', stored: 'ar' }), '<script defer src="assets/js/i18n/en.js"></script>');
  assert.equal(pick({ stored: 'ar', sync: true }), '<script src="assets/js/i18n/ar.js"></script>');
});

test('every page loads its interface text through the picker', () => {
  const app = path.join(__dirname, '../app');
  const pages = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) { if (entry.name !== 'assets' && entry.name !== 'data') walk(path.join(dir, entry.name)); }
      else if (entry.name.endsWith('.html')) pages.push(path.join(dir, entry.name));
    }
  })(app);
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    assert.ok(!/src="assets\/js\/i18n\.js"/.test(html), path.relative(app, page) + ' loads every language');
  }
});
