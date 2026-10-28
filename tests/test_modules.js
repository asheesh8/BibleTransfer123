// The module registry, and the Bible book data that moved out of core.js.
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
  assert.ok(core.split('\n').length < 1000, 'core.js is over 1,000 lines; split it into modules');
});
