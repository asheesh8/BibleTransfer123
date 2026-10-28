// Kandili's first-run funnel: its words, how it loads, and what Home does with the answer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const app = path.join(__dirname, '../app');
const js = path.join(app, 'assets/js');
const read = f => fs.readFileSync(path.join(app, f), 'utf8');

function boot() {
  const ET = {
    module(name, deps, factory) { return factory(this); }, 
    libraryScope: () => null, store: { get: (_, d) => d, set() {} }, $$: () => [], $: () => null, esc: v => v,
    mods: {}, module: (name, deps, fn) => (ET.mods[name] = fn(ET))
  };
  const window = { ET };
  const context = vm.createContext({ window, document: { documentElement: { setAttribute() {} } }, navigator: { languages: [] } });
  vm.runInContext(read('assets/js/i18n/en.js'), context);
  vm.runInContext(read('assets/js/i18n.js'), context);
  vm.runInContext(read('assets/js/data/onboarding-strings.js'), context);
  return ET;
}

const funnel = read('assets/js/features/onboarding.js');
const strings = read('assets/js/data/onboarding-strings.js');

test('every key the funnel asks for has English words', () => {
  const ET = boot();
  const keys = new Set(funnel.match(/'ob\.[a-z.-]*[a-z]'/g).map(k => k.slice(1, -1)));
  // Keys built from the choice lists.
  for (const w of ['film', 'audio-bible', 'scripture', 'audio', 'all']) keys.add('ob.want.' + w);
  for (const n of ['wifi', 'little', 'none']) { keys.add('ob.net.' + n); keys.add('ob.net.' + n + '.say'); }
  for (const k of keys) assert.notEqual(ET.i18n.say(k, 'en'), k, k + ' has no English');
});

test('every interface language but Maa has every line, with its placeholders kept', () => {
  const ET = boot();
  const { KEYS, table } = ET.mods['data/onboarding-strings'];
  const codes = ET.i18n.langs.map(l => l.code);
  for (const code of Object.keys(table)) assert.ok(codes.includes(code), code + ' is not an interface language');
  const marks = s => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const code of codes) {
    if (code === 'mas') continue;   // partial on purpose; the rest falls back to English
    for (const k of KEYS) {
      assert.ok(table[code] && table[code][k], `${code} has ${k}`);
      assert.equal(marks(table[code][k]), marks(table.en[k]), `${code} ${k} keeps its placeholders`);
    }
  }
});

test('the welcome screen loads the funnel with plain tags that work from file://', () => {
  const i18n = fs.readFileSync(path.join(js, 'i18n.js'), 'utf8');
  for (const f of ['assets/css/pages/onboarding.css', 'assets/js/data/onboarding-strings.js', 'assets/js/features/onboarding.js']) {
    assert.ok(i18n.includes("'" + f + "'"), 'welcome() loads ' + f);
    assert.ok(fs.existsSync(path.join(app, f)), f + ' exists');
  }
  assert.doesNotMatch(funnel + strings, /\bfetch\(|import\s|localStorage/);
  assert.match(i18n, /if \(ET\.onboarding\) ET\.onboarding\.start\(el, done\);\s*else done\(\);/);
});

test('the service worker caches the funnel for offline first runs', () => {
  const sw = read('sw.js');
  for (const f of ['assets/css/pages/onboarding.css', 'assets/js/data/onboarding-strings.js', 'assets/js/features/onboarding.js'])
    assert.ok(sw.includes("'" + f + "'"), 'sw.js SHELL lists ' + f);
});

test('Home shelves the kind of thing someone asked Kandili for first', () => {
  const home = read('assets/js/home.js');
  const order = home.match(/var ORDER = (\[[^\]]+\]);/)[1].replace(/'/g, '"');
  const fn = new Function('ET', 'ORDER', home.match(/function order\(\) \{[\s\S]*?\n  \}/)[0] + '; return order;');
  const ORDER = JSON.parse(order);
  const with_ = want => fn({ store: { get: () => want } }, ORDER)();
  assert.deepEqual(with_(''), ORDER);
  assert.equal(with_('audio-bible')[0], 'audio-bible');
  assert.deepEqual(with_('scripture').slice(0, 2), ['scripture', 'book']);
  assert.deepEqual(with_('nonsense'), ORDER);
  assert.equal(with_('audio').length, ORDER.length);
});

test('the funnel stylesheet keeps 56px targets and honours reduced motion', () => {
  const css = read('assets/css/pages/onboarding.css');
  assert.match(css, /\.ob-icon, \.ob-skip \{\s*min-width: 56px; min-height: 56px;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /margin-left|margin-right|padding-left|padding-right|[^-]left:|[^-]right:/, 'use logical properties so RTL mirrors');
});
