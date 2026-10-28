// One strings file per interface language, and the loader that picks two of them.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const app = path.join(__dirname, '../app');
const js = path.join(app, 'assets/js');
const runtime = fs.readFileSync(path.join(js, 'i18n.js'), 'utf8');
const loader = fs.readFileSync(path.join(js, 'i18n-load.js'), 'utf8');
const files = fs.readdirSync(path.join(js, 'i18n')).filter(f => f.endsWith('.js'));

function boot(withTables) {
  const ET = { module(name, deps, factory) { return factory(this); }, libraryScope: () => null, store: { get: (_, d) => d, set() {} }, $$: () => [], $: () => null, esc: v => v };
  const window = { ET };
  const context = vm.createContext({ window, document: { documentElement: { setAttribute() {} } }, navigator: { languages: [] } });
  if (withTables) for (const f of files) vm.runInContext(fs.readFileSync(path.join(js, 'i18n', f), 'utf8'), context);
  vm.runInContext(runtime, context);
  return { ET, tables: window.ET_STRINGS };
}

test('every interface language has exactly one strings file', () => {
  const { ET } = boot(false);
  assert.deepEqual(files.map(f => f.slice(0, -3)).sort(), JSON.parse(JSON.stringify(ET.i18n.langs.map(l => l.code))).sort());
});

test('i18n.js holds no string tables, only the runtime and the every-language lines', () => {
  assert.ok(Buffer.byteLength(runtime) < 80 * 1024, 'i18n.js has grown past 80 KB; strings belong in i18n/<code>.js');
  assert.doesNotMatch(runtime, /(^|[^_])STRINGS\.[a-z]/);
});

test('the every-language lines match each language file, so the welcome screen never drifts', () => {
  const { tables } = boot(true);
  const bare = boot(false).ET;
  for (const key of ['ui.changelang', 'welcome.title', 'welcome.sub', 'welcome.search', 'welcome.suggested'])
    for (const code of Object.keys(tables))
      assert.equal(bare.i18n.say(key, code), tables[code][key] || tables.en[key], `${code}.${key}`);
  for (const code of Object.keys(tables))
    for (const n of [1, 3])
      assert.equal(bare.i18n.say('welcome.count', code, { n }), boot(true).ET.i18n.say('welcome.count', code, { n }), `${code} count ${n}`);
});

function pick({ stored = null, search = '', shared = null, sync = false } = {}) {
  let written = '';
  const window = { ET_SHARED_LIBRARY: shared };
  vm.runInNewContext(loader, {
    window, location: { search },
    localStorage: { getItem: () => stored },
    document: { currentScript: { hasAttribute: name => sync && name === 'data-sync' }, write: html => { written += html; } }
  });
  return [...written.matchAll(/<script( defer)? src="assets\/js\/i18n\/([^"]+)\.js"><\\?\/script>/g)].map(m => (m[1] ? '' : 'sync:') + m[2]);
}

test('the loader writes English plus the reader\'s language, in i18n.js\'s order of precedence', () => {
  assert.deepEqual(pick(), ['en'], 'first run: English, the welcome screen covers the rest');
  assert.deepEqual(pick({ stored: 'swh' }), ['en', 'swh']);
  assert.deepEqual(pick({ stored: 'en' }), ['en']);
  assert.deepEqual(pick({ stored: 'swh', shared: { lang: 'tuv', ui: 'swh' } }), ['en', 'swh']);
  assert.deepEqual(pick({ stored: 'ur', shared: { lang: 'amh', ui: 'am' } }), ['en', 'am'], 'a language library keeps its interface');
  assert.deepEqual(pick({ stored: 'ur', search: '?id=x&only=hau&ui=ha' }), ['en', 'ha']);
  assert.deepEqual(pick({ stored: 'ur', search: '?only=hau' }), ['en'], 'a scoped link without ui is English');
  assert.deepEqual(pick({ stored: '../x' }), ['en'], 'only a language code becomes a path');
  assert.deepEqual(pick({ stored: 'swh', sync: true }), ['sync:en', 'sync:swh']);
});

test('every page that loads i18n.js loads the strings loader right before it', () => {
  const pages = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) pages.push(p);
    }
  })(app);
  let checked = 0;
  for (const page of pages) {
    const html = fs.readFileSync(page, 'utf8');
    if (!html.includes('assets/js/i18n.js')) continue;
    assert.match(html, /<script (data-sync )?src="assets\/js\/i18n-load\.js"><\/script>\n<script (defer )?src="assets\/js\/i18n\.js"><\/script>/, path.relative(app, page));
    checked++;
  }
  assert.ok(checked > 60, `only ${checked} pages checked`);
});

test('a module can carry its own strings without shadowing the language files', () => {
  const { ET, tables } = boot(true);
  ET.i18n.extend({ en: { 'test.extra': 'Hello', 'app.name': 'Wrong' }, swh: { 'test.extra': 'Habari' } });
  ET.i18n.set('swh');
  assert.equal(ET.i18n.t('test.extra'), 'Habari');
  assert.equal(ET.i18n.t('app.name'), tables.swh['app.name']);
  ET.i18n.set('ur');
  assert.equal(ET.i18n.t('test.extra'), 'Hello', 'falls back to the module\'s English');
});
