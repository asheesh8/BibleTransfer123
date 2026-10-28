// Run: node --test tests/test_design_system.js
// Keeps the design system honest: components read tokens only, every token
// they read exists, Kandili's script colours match its tokens, every pose
// draws, and the style guide loads every component it documents.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');

const APP = path.join(__dirname, '../app');
const CSS = path.join(APP, 'assets/css');
const read = p => fs.readFileSync(p, 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const tokens = read(path.join(CSS, 'tokens.css'));
const defined = new Set([...tokens.matchAll(/(--et-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
const components = fs.readdirSync(path.join(CSS, 'components')).filter(f => f.endsWith('.css'));

test('every component reads colours from tokens, never a hex value', () => {
  for (const f of components) {
    // data: URIs carry their own SVG and are allowed.
    const src = stripComments(read(path.join(CSS, 'components', f))).replace(/url\("data:[^"]*"\)/g, '');
    const hex = src.match(/#[0-9a-fA-F]{3,8}\b/g);
    assert.equal(hex, null, `${f} uses ${hex}`);
  }
});

test('every --et- variable used anywhere in the kit is defined in tokens.css', () => {
  const files = [
    ...components.map(f => path.join(CSS, 'components', f)),
    path.join(CSS, 'base.css'),
    path.join(CSS, 'pages/styleguide.css'),
    path.join(APP, 'styleguide.html'),
    path.join(APP, 'assets/js/features/styleguide.js')
  ];
  for (const file of files) {
    // Names built in script ("var(--et-space-" + n) end in a dash and are skipped.
    for (const m of read(file).matchAll(/var\((--et-[a-z0-9-]*[a-z0-9])\s*[,)]/g)) {
      assert.ok(defined.has(m[1]), `${path.basename(file)} reads undefined ${m[1]}`);
    }
  }
});

test('light and dark define the same semantic tokens', () => {
  const darkBlocks = tokens.split(/prefers-color-scheme: dark|\[data-theme="dark"\]/).slice(1);
  assert.equal(darkBlocks.length, 2);
  const names = b => new Set([...b.split('}')[0].matchAll(/(--et-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  const [media, attr] = darkBlocks.map(names);
  assert.deepEqual([...media].sort(), [...attr].sort(), 'the two dark blocks have drifted apart');
  for (const n of ['--et-bg', '--et-text', '--et-fill-go', '--et-on-go', '--et-text-soft']) assert.ok(media.has(n), n);
});

test('reduced motion collapses every duration token', () => {
  const durs = [...defined].filter(n => n.startsWith('--et-dur-'));
  const block = tokens.split('prefers-reduced-motion: reduce')[1].split('}')[0];
  for (const d of durs) assert.ok(block.includes(d + ':'), `${d} keeps running under reduced motion`);
});

function loadMascot() {
  const window = { addEventListener() {}, setTimeout() {} };
  window.window = window;
  const ctx = { window, location: { protocol: 'file:' }, navigator: {},
                document: { readyState: 'loading', documentElement: { getAttribute: () => null } } };
  vm.createContext(ctx);
  for (const f of ['core.js', 'brand/mascot.js']) vm.runInContext(read(path.join(APP, 'assets/js', f)), ctx);
  return window.ET.use('brand/mascot');
}

test("Kandili's colours in mascot.js match the --et-k- tokens", () => {
  const M = loadMascot();
  const map = { brass: 'brass', shade: 'shade', glass: 'glass', shine: 'shine', face: 'face',
                glow: 'glow', blush: 'blush', go: 'go', sky: 'sky', card: 'card' };
  for (const [js, tok] of Object.entries(map)) {
    const m = tokens.match(new RegExp('--et-k-' + tok + ':\\s*(#[0-9A-Fa-f]{6})'));
    assert.ok(m, `--et-k-${tok} missing`);
    assert.equal(M.COLORS[js].toUpperCase(), m[1].toUpperCase(), js);
  }
});

test('every pose draws a complete lantern with no text in the art', () => {
  const M = loadMascot();
  assert.equal(M.POSES.length, 10);
  for (const p of M.POSES) {
    const svg = M.markup(p);
    assert.ok(!/undefined|NaN/.test(svg), p);
    for (const part of ['k-body', 'k-flame', 'k-eyes', 'k-mouth', 'k-face', 'k-shadow', 'k-glow', 'k-float', 'k-fly'])
      assert.ok(svg.includes('class="' + part + '"'), `${p} lacks ${part}`);
    assert.ok(!/<text/.test(svg), `${p} has text baked into the art`);
    assert.ok(svg.includes('aria-hidden="true"'), `${p} should be decorative by default`);
  }
  assert.ok(M.markup('hello', { label: 'Hi' }).includes('role="img" aria-label="Hi"'));
  assert.ok(Buffer.byteLength(read(path.join(APP, 'assets/js/brand/mascot.js'))) < 30 * 1024, 'mascot.js over its 30 KB budget');
});

test('the style guide loads every component stylesheet and kit script', () => {
  const html = read(path.join(APP, 'styleguide.html'));
  for (const f of components) assert.ok(html.includes(`assets/css/components/${f}`), `styleguide.html misses ${f}`);
  for (const s of ['tokens.css', 'base.css'])
    assert.ok(html.indexOf(s) < html.indexOf('components/'), `${s} must load before components`);
  // core.js first: it holds the module registry every kit script registers with.
  const at = js => html.lastIndexOf(`src="assets/js/${js}"`);
  for (const js of ['ui/icons.js', 'brand/mascot.js', 'ui/sheet.js', 'ui/toast.js', 'features/styleguide.js'])
    assert.ok(at(js) > at('core.js') && at('core.js') > -1, `${js} must load after core.js`);
  // Runs off a card: nothing from the network.
  assert.ok(!/(src|href)="https?:/.test(html), 'styleguide.html loads something from the network');
  assert.ok(!/type="module"/.test(html), 'ES modules do not load from file://');
});

test('every kit script opens with a header comment and registers with ET.module', () => {
  const dirs = ['ui', 'brand', 'features'].map(d => path.join(APP, 'assets/js', d));
  for (const d of dirs) {
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.js'))) {
      const src = read(path.join(d, f));
      assert.ok(src.startsWith('/* ='), `${f} needs a header comment`);
      assert.ok(!/^\s*(import|export)\s/m.test(src), `${f} uses ES module syntax`);
      const name = path.basename(d) + '/' + f.replace(/\.js$/, '');
      assert.ok(src.includes(`window.ET.module('${name}', [`), `${f} should register as ET.module('${name}')`);
    }
  }
});
