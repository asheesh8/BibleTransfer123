// The module registry, and the code that moved out of core.js into modules.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const APP = path.join(__dirname, '../app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

function boot(...files) {
  const window = { addEventListener() {}, setTimeout() {} };
  window.window = window;
  const context = vm.createContext({
    window, document: { readyState: 'loading' }, location: { protocol: 'file:' }, navigator: {}
  });
  for (const f of files) vm.runInContext(read(f), context, { filename: f });
  return window.ET;
}

test('core registers itself as the "core" module', () => {
  const ET = boot('assets/js/core.js');
  assert.equal(ET.use('core'), ET);
});

test('a module receives the modules it names, in order', () => {
  const ET = boot('assets/js/core.js');
  ET.module('test/a', [], () => ({ n: 1 }));
  const b = ET.module('test/b', ['core', 'test/a'], (core, a) => ({ core, n: a.n + 1 }));
  assert.equal(b.core, ET);
  assert.equal(ET.use('test/b').n, 2);
});

test('a missing or repeated module is a clear error, not a silent undefined', () => {
  const ET = boot('assets/js/core.js');
  assert.throws(() => ET.module('test/c', ['test/missing'], () => ({})), /needs "test\/missing"/);
  assert.throws(() => ET.use('test/missing'), /not loaded on this page/);
  ET.module('test/d', [], () => ({}));
  assert.throws(() => ET.module('test/d', [], () => ({})), /defined twice/);
});

test('Bible book data loads after core and keeps the old ET names', () => {
  const ET = boot('assets/js/core.js', 'assets/js/data/bible-books.js');
  const books = ET.use('data/bible-books');
  assert.equal(books.BOOKS.OT.length, 39);
  assert.equal(books.BOOKS.NT.length, 27);
  assert.equal(ET.BOOKS, books.BOOKS);
  assert.equal(ET.bookName('1Corinthians'), '1 Corinthians');
  assert.equal(
    ET.audioBibleUrl({ fileset: 'ENGKJV', version: 'ENGKJV' }, 'NT', 40, 'Matthew', 5),
    'https://dbs.org/cdn/audio/ENGKJV/NT_ENGKJV/40_Matthew/40_Matthew_005.mp3'
  );
});

test('the item page loads the book data between core and item.js', () => {
  const html = read('item.html');
  const at = f => html.indexOf('src="assets/js/' + f + '"');
  assert.ok(at('core.js') > -1 && at('data/bible-books.js') > -1 && at('item.js') > -1);
  assert.ok(at('core.js') < at('data/bible-books.js'));
  assert.ok(at('data/bible-books.js') < at('item.js'));
});

test('core.js stays code: no book tables creep back in', () => {
  const core = read('assets/js/core.js');
  assert.doesNotMatch(core, /LOCAL_BOOKS|var BOOKS/);
  assert.ok(core.split('\n').length < 400, 'core.js is over 400 lines; move what it draws into a ui/ module');
});

test('the shell and covers keep the names screens already call', () => {
  const ET = boot('assets/js/core.js', 'assets/js/ui/icons.js', 'assets/js/ui/sheet.js', 'assets/js/ui/toast.js', 'assets/js/ui/shell.js', 'assets/js/ui/covers.js');
  for (const name of ['icon', 'lantern', 'loadMascot', 'header', 'tabbar', 'sheet', 'stepper', 'toast', 'copyText', 'facebookShare'])
    assert.equal(ET[name], ET.use('ui/shell')[name], 'ET.' + name);
  for (const name of ['row', 'poster', 'thumb', 'typeIcon'])
    assert.equal(ET[name], ET.use('ui/covers')[name], 'ET.' + name);
  const r = { id: 'film-eng', type: 'film', title: 'Jesus', lang: 'eng' };
  assert.match(ET.row(r, { kicker: 'Film', sub: '2 h', verb: 'Watch' }), /class="rowi" href="item\.html\?id=film-eng"/);
  assert.match(ET.poster(r), /class="gen"/);
  assert.match(ET.icon('play'), /^<svg/);
});

/* Every page that loads core and draws a header, tab bar or icon needs the
   shell straight after it; a page that shows items also needs covers. Read
   from the files themselves, so a new page or a new call cannot slip by. */
test('each page loads the modules its scripts call, after core', () => {
  const SHELL = /ET\.(header|tabbar|icon|sheet|stepper|toast|copyText|facebookShare|facebookUrl|lantern|loadMascot)\(/;
  const COVERS = /ET\.(row|poster|thumb|typeIcon)\(/;
  const pages = fs.readdirSync(APP).filter(f => f.endsWith('.html'))
    .concat(fs.readdirSync(APP).filter(d => fs.existsSync(path.join(APP, d, 'index.html')) && d !== 'admin').map(d => d + '/index.html'));
  let checked = 0;
  for (const page of pages) {
    const html = read(page);
    const at = f => html.indexOf('src="assets/js/' + f + '"');
    if (at('core.js') === -1) continue;
    const scripts = [...html.matchAll(/src="assets\/js\/([\w/-]+)\.js"/g)].map(m => m[1])
      .filter(s => s !== 'core' && s !== 'i18n-load' && !s.startsWith('i18n/'));
    const code = scripts.map(s => read('assets/js/' + s + '.js')).join('\n');
    if (SHELL.test(code)) assert.ok(at('ui/shell.js') > at('core.js'), page + ' needs ui/shell.js after core.js');
    if (at('ui/shell.js') > -1) {
      for (const kit of ['ui/icons.js', 'ui/sheet.js', 'ui/toast.js'])
        assert.ok(at(kit) > at('core.js') && at(kit) < at('ui/shell.js'), page + ' needs ' + kit + ' between core.js and ui/shell.js');
      for (const css of ['tokens.css', 'components/sheet.css', 'components/toast.css'])
        assert.ok(html.includes('href="assets/css/' + css + '"'), page + ' needs ' + css + ' for the kit sheet and toast');
    }
    if (COVERS.test(code)) assert.ok(at('ui/covers.js') > at('core.js'), page + ' needs ui/covers.js after core.js');
    checked++;
  }
  assert.ok(checked > 50, 'only ' + checked + ' pages checked');
});
