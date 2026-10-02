// Validate translation contracts and the public formatter across every UI language.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const app = path.join(__dirname, '../app');
const source = fs.readFileSync(path.join(app, 'assets/js/i18n.js'), 'utf8');
function harness(elements = {}) {
  const attributes = {};
  const ET = { libraryScope: () => null, store: { get: (_, fallback) => fallback, set() {} },
    $$: selector => elements[selector] || [], $: () => null, esc: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
  const window = { ET };
  const document = { documentElement: { setAttribute: (key, value) => { attributes[key] = value; } } };
  // Capture dictionaries without bypassing normal initialization or formatting.
  vm.runInNewContext(source.replace('  var shared = ET.libraryScope();',
    '  window.audit = STRINGS;\n  var shared = ET.libraryScope();'), { window, document, navigator: { languages: [] } });
  return { ET, dictionaries: window.audit, attributes };
}
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all sixteen languages retain formatter variables and render escaped strings', () => {
  const { ET, dictionaries, attributes } = harness();
  assert.equal(ET.i18n.langs.length, 16);
  for (const language of ET.i18n.langs) {
    ET.i18n.set(language.code);
    assert.equal(attributes.dir, language.dir);
    assert.equal(attributes.lang, language.code);
    for (const [key, value] of Object.entries(dictionaries[language.code])) {
      assert.ok(typeof value === 'string' && value.trim(), `${language.code}.${key} is empty`);
      const english = dictionaries.en[key] || (key.endsWith('.one') && dictionaries.en[key.slice(0, -4)]);
      if (english) assert.deepEqual(placeholders(value), placeholders(english), `${language.code}.${key} changes runtime variables`);
      const vars = Object.fromEntries(placeholders(value).map(variable => [variable, '<example>']));
      const rendered = ET.i18n.h(key, vars);
      assert.ok(!/\{\w+\}/.test(rendered), `${language.code}.${key} leaves a placeholder`);
      assert.ok(!rendered.includes('<example>'), `${language.code}.${key} fails to escape substituted text`);
    }
    const count = ET.i18n.t('home.offline', { n: 7, total: 19 });
    assert.ok(count.includes('7') && count.includes('19'), `${language.code} omits part of the offline count`);
  }
});

test('literal interface and accessibility keys have an English fallback', () => {
  const { dictionaries } = harness();
  for (const name of ['core', 'home', 'library', 'item', 'save', 'shared-library', 'share-libraries', 'nearby', 'share', 'help', 'i18n']) {
    const file = fs.readFileSync(path.join(app, 'assets/js', name + '.js'), 'utf8');
    for (const match of file.matchAll(/\b(?:t|h)\(\s*['"]([a-z][\w.-]+)['"]\s*[,)]/g)) {
      assert.ok(dictionaries.en[match[1]], `${name}.js uses unresolved key ${match[1]}`);
    }
  }
  for (const name of ['index', 'library', 'item', 'share', 'help', 'nearby']) {
    const html = fs.readFileSync(path.join(app, name + '.html'), 'utf8');
    for (const match of html.matchAll(/data-i18n(?:-aria|-placeholder)?="([\w.-]+)"/g)) {
      assert.ok(dictionaries.en[match[1]], `${name}.html uses unresolved key ${match[1]}`);
    }
  }
});

test('native draft controls render and untranslated guides use disclosed English', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('mr');
  for (const key of ['home.pick', 'lib.search', 'item.save', 'share.title', 'help.title']) {
    assert.match(ET.i18n.t(key), /[\u0900-\u097F]/, `Marathi ${key} is still English`);
  }
  ET.i18n.set('kik');
  assert.equal(ET.i18n.t('lib.search'), 'Etha na rĩĩtwa');
  ET.i18n.set('guz');
  assert.equal(ET.i18n.t('ui.close'), 'Kuneka', 'Close must not say Home');
  assert.equal(ET.i18n.t('tab.home'), 'Inka');
  assert.equal(ET.i18n.t('type.scripture'), 'Amariko', 'Scripture must not say laws');
  ET.i18n.set('mas');
  assert.equal(ET.i18n.t('item.read'), 'Aɨsʉ́m');
  for (const language of ['kik', 'guz', 'mas']) {
    ET.i18n.set(language);
    assert.equal(ET.i18n.meta(language).interfaceNote, 'Some menus in English');
    assert.equal(dictionaries[language]['route.computer-iphone.4.p'], undefined, 'an unverified guide must not copy Swahili');
    assert.equal(ET.i18n.tOr('route.computer-iphone.4.p', 'Copy the file'), 'Copy the file');
  }
  ET.i18n.set('ur');
  assert.match(ET.i18n.h('ui.catalog.missing'), /class="latin"/, 'an untranslated error stays readable in an RTL interface');
  assert.equal(ET.i18n.tOr('not.translated', 'Readable fallback'), 'Readable fallback');
});

// Singular variants remain optional; scripts without number inflection use
// their normal labels. A fallback must not override a real translation.
test('resource counts select singular wording without forcing English', () => {
  const { ET } = harness();
  ET.i18n.set('en');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), '1 item');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), '2 items');
  assert.equal(ET.i18n.t('bulk.summary', { items: 1, files: 3 }), '1 item · Files: 3');
  ET.i18n.set('kik');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Kĩndũ 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Indo 2');
  ET.i18n.set('mas');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Entóki 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Intokitín 2');
  ET.i18n.set('guz');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), '1 item');
  ET.i18n.set('cmn');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), '共 1 项');
  assert.equal(ET.i18n.say('welcome.count', 'en', { n: 1 }), '1 resource: a film, Bible, or recording');
  assert.equal(ET.i18n.say('welcome.count', 'en', { n: 2 }), '2 resources: films, Bibles and recordings');
});

test('untranslated copy is marked as English and changes back when translated', () => {
  const element = key => ({ attributes: { 'data-i18n': key },
    getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; } });
  const heading = element('help.title');
  const { ET } = harness({ '[data-i18n]': [heading] });
  ET.i18n.set('mas');
  assert.equal(heading.attributes.lang, 'en');
  assert.match(ET.i18n.tOrHTML('route.computer-iphone.4.p', 'Copy the file'), /lang="en" dir="ltr">Copy the file/);
  ET.i18n.set('mr');
  assert.equal(heading.attributes.lang, 'mr');
  assert.doesNotMatch(ET.i18n.h('help.title'), /lang="en"/);
});
