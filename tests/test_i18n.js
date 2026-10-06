// Validate translation contracts and the public formatter across every UI language.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const app = path.join(__dirname, '../app');
const source = fs.readFileSync(path.join(app, 'assets/js/i18n.js'), 'utf8');
function harness(elements = {}, scope = null) {
  const attributes = {};
  const ET = { libraryScope: () => scope, store: { get: (_, fallback) => fallback, set() {} },
    $$: selector => elements[selector] || [], $: () => null, esc: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') };
  const window = { ET };
  const document = { documentElement: { setAttribute: (key, value) => { attributes[key] = value; } } };
  // Capture dictionaries without bypassing normal initialization or formatting.
  vm.runInNewContext(source.replace('  var shared = ET.libraryScope();',
    '  window.audit = STRINGS;\n  var shared = ET.libraryScope();'), { window, document, navigator: { languages: [] } });
  return { ET, dictionaries: window.audit, attributes };
}
const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('all thirty-four languages retain formatter variables and render escaped strings', () => {
  const { ET, dictionaries, attributes } = harness();
  assert.equal(ET.i18n.langs.length, 34);
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

test('native controls render and untranslated guides use disclosed English', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('mr');
  for (const key of ['home.pick', 'lib.search', 'item.save', 'share.title', 'help.title']) {
    assert.match(ET.i18n.t(key), /[\u0900-\u097F]/, `Marathi ${key} is still English`);
  }
  ET.i18n.set('lg');
  assert.equal(ET.i18n.t('lib.search'), 'Noonya erinnya');
  assert.equal(ET.i18n.t('item.save'), 'Tereka ku ssimu yange');
  ET.i18n.set('kik');
  assert.equal(ET.i18n.t('lib.search'), 'Etha na rĩĩtwa');
  ET.i18n.set('guz');
  assert.equal(ET.i18n.t('ui.close'), 'Kuneka', 'Close must not say Home');
  assert.equal(ET.i18n.t('tab.home'), 'Inka');
  assert.equal(ET.i18n.t('type.scripture'), 'Amariko', 'Scripture must not say laws');
  ET.i18n.set('mas');
  assert.equal(ET.i18n.t('item.read'), 'Aisom');
  for (const language of ['lg', 'kik', 'guz', 'mas']) {
    ET.i18n.set(language);
    assert.equal(ET.i18n.meta(language).interfaceNote, 'Screenshot guide in English');
    for (const key of ['route.computer-iphone.4.p', 'help.android.1.h', 'help.trouble.0.p', 'share.item']) {
      assert.ok(dictionaries[language][key], `${language}.${key} falls back to English`);
      assert.notEqual(dictionaries[language][key], dictionaries.swh[key], `${language}.${key} copies Swahili`);
    }
  }
  delete dictionaries.ur['ui.catalog.missing'];
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
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Entoki 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Intokitin 2');
  ET.i18n.set('guz');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Egento 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Ebinto 2');
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
  const { ET, dictionaries } = harness({ '[data-i18n]': [heading] });
  // Every language is complete, so simulate a key a future change leaves untranslated.
  delete dictionaries.mas['help.title'];
  delete dictionaries.mas['route.computer-iphone.4.p'];
  ET.i18n.set('mas');
  assert.equal(heading.attributes.lang, 'en');
  assert.match(ET.i18n.tOrHTML('route.computer-iphone.4.p', 'Copy the file'), /lang="en" dir="ltr">Copy the file/);
  ET.i18n.set('mr');
  assert.equal(heading.attributes.lang, 'mr');
  assert.doesNotMatch(ET.i18n.h('help.title'), /lang="en"/);
});

 test('new shared libraries initialize in their native interface without a stored preference', () => {
  for (const scope of [{lang: 'run', ui: 'rn'}, {lang: 'aka', ui: 'ak'}, {lang: 'nya', ui: 'ny'}, {lang: 'kin', ui: 'rw'}, {lang: 'xho', ui: 'xh'}, {lang: 'sna', ui: 'sn'}, {lang: 'mlg', ui: 'mg'}, {lang: 'hau', ui: 'ha'}, {lang: 'lin', ui: 'ln'}, {lang: 'orm', ui: 'om'}, {lang: 'luo', ui: 'luo'}, {lang: 'ibo', ui: 'ig'}, {lang: 'fra', ui: 'fr'}, {lang: 'amh', ui: 'am'}, {lang: 'por', ui: 'pt'}, {lang: 'yor', ui: 'yo'}, {lang: 'pcm', ui: 'pcm'}]) {
    const {ET, dictionaries, attributes} = harness({}, scope);
    assert.equal(ET.i18n.current(), scope.ui);
    ET.i18n.apply();
    assert.equal(attributes.lang, scope.ui);
    for (const key of ['lib.search', 'item.save', 'item.missing', 'help.title',
                       'route.iphone-android.1.h', 'route.computer-android.1.p']) {
      assert.ok(dictionaries[scope.ui][key], scope.ui + '.' + key);
      assert.notEqual(ET.i18n.t(key), dictionaries.en[key], scope.ui + '.' + key);
    }
  }
});

test('French covers every existing interface key and uses singular resource counts', () => {
  const { ET, dictionaries } = harness({}, {lang: 'fra', ui: 'fr'});
  for (const key of Object.keys(dictionaries.en)) {
    assert.ok(dictionaries.fr[key], 'French fallback: ' + key);
  }
  assert.equal(ET.i18n.t('lib.countall', {n: 1}), '1 ressource');
  assert.equal(ET.i18n.t('lib.countall', {n: 2}), '2 ressources');
  assert.equal(ET.i18n.t('help.android.4.h'), 'Si le fichier ne s’ouvre pas');
  assert.equal(ET.i18n.t('type.book'), 'Livres et guides');
});

test('Amharic translates all interface keys and keeps clear file troubleshooting', () => {
  const { ET, dictionaries, attributes } = harness({}, {lang: 'amh', ui: 'am'});
  for (const key of Object.keys(dictionaries.en)) {
    assert.ok(dictionaries.am[key], 'Amharic fallback: ' + key);
  }
  assert.equal(attributes.dir, undefined);
  ET.i18n.apply();
  assert.equal(attributes.dir, 'ltr');
  assert.equal(ET.i18n.t('lib.countall', {n: 1}), '1 ይዘት');
  assert.equal(ET.i18n.t('lib.countall', {n: 2}), '2 ይዘቶች');
  assert.equal(ET.i18n.t('help.android.4.h'), 'ፋይሉ ካልተከፈተ');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /ፋይሉ ካልተከፈተ/);
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File Transfer/);
  assert.equal(ET.i18n.meta('am').native, 'አማርኛ');
});

test('Portuguese covers the controls, help, sharing and singular resource counts', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('pt');
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), '1 recurso');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), '2 recursos');
  assert.equal(ET.i18n.t('help.android.4.h'), 'Se o arquivo não abrir');
  assert.equal(ET.i18n.t('item.chapter', { n: 3 }), 'Capítulo 3');
  for (const key of Object.keys(dictionaries.fr)) {
    assert.ok(dictionaries.pt[key], `Portuguese lacks ${key}`);
  }
  assert.equal(ET.i18n.meta('pt').native, 'Português');
});

test('Yoruba covers every interface and help key with usable file wording', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('yo');
  for (const key of Object.keys(dictionaries.pt)) assert.ok(dictionaries.yo[key], 'Yoruba fallback: ' + key);
  assert.equal(ET.i18n.t('help.android.4.h'), 'Tí fáìlì náà kò bá ṣí');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /Tí fáìlì náà kò bá ṣí/);
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Ohun 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Ohun 2');
  assert.equal(ET.i18n.t('item.chapter', { n: 3 }), 'Orí 3');
  assert.equal(ET.i18n.meta('yo').native, 'Èdè Yorùbá');
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File transfer/);
});

test('Nigerian Pidgin covers all controls and guides with clear file wording', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('pcm');
  for (const key of Object.keys(dictionaries.pt)) assert.ok(dictionaries.pcm[key], 'Pidgin fallback: ' + key);
  assert.equal(ET.i18n.t('help.android.4.h'), 'If di file no open');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /If di file no open/);
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), '1 thing');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), '2 things');
  assert.equal(ET.i18n.t('item.chapter', { n: 3 }), 'Chapter 3');
  assert.equal(ET.i18n.meta('pcm').native, 'Naija Pidgin');
  assert.equal(ET.i18n.meta('unknown').name, 'English');
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File Transfer/);
});

test('Lingala covers every control and guide with clear file instructions', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('ln');
  assert.equal(Object.keys(dictionaries.ln).length, 411);
  for (const key of Object.keys(dictionaries.pt)) assert.ok(dictionaries.ln[key], 'Lingala fallback: ' + key);
  assert.equal(ET.i18n.t('help.android.4.h'), 'Soki fichier efungwami te');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /Soki fichier efungwami te/);
  assert.equal(ET.i18n.t('lib.countall', { n: 1 }), 'Eloko 1');
  assert.equal(ET.i18n.t('lib.countall', { n: 2 }), 'Biloko 2');
  assert.equal(ET.i18n.t('save.allchapters', { n: 1 }), 'Mokapo 1');
  assert.equal(ET.i18n.t('save.allchapters', { n: 3 }), 'Mikapo nyonso 3');
  assert.equal(ET.i18n.meta('ln').native, 'Lingála');
  assert.equal(ET.i18n.meta('unknown').name, 'English');
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File Transfer/);
});

test('Hausa covers all controls and guides with clear file wording', () => {
  const { ET, dictionaries } = harness();
  ET.i18n.set('ha');
  assert.equal(Object.keys(dictionaries.ha).length, 411);
  for (const key of Object.keys(dictionaries.pt)) assert.ok(dictionaries.ha[key], 'Hausa fallback: ' + key);
  assert.equal(ET.i18n.t('help.android.4.h'), 'Idan fayil ɗin bai buɗe ba');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /Idan fayil ɗin bai buɗe ba/);
  assert.equal(ET.i18n.t('item.chapter', { n: 3 }), 'Babi na 3');
  assert.equal(ET.i18n.meta('ha').native, 'Hausa');
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File Transfer/);
});

test('Hausa refreshes an older installed shell that falls back to English', () => {
  const html = fs.readFileSync(path.join(app, 'hausa/index.html'), 'utf8');
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const known of [false, true]) {
    let onControllerChange, reloads = 0;
    vm.runInNewContext(inline, {
      window: { ET: { i18n: { meta: () => ({code: known ? 'ha' : 'en'}) } } },
      navigator: { serviceWorker: { addEventListener: (_, fn) => { onControllerChange = fn; } } },
      document: { documentElement: {lang: 'ha'} },
      localStorage: {getItem: () => null}, location: {reload: () => { reloads++; }}
    });
    onControllerChange();
    assert.equal(reloads, known ? 0 : 1);
  }
});

 test('Malagasy covers all controls and guides with precise file instructions', () => {
  const { ET, dictionaries } = harness({}, {lang: 'mlg', ui: 'mg'});
  assert.equal(Object.keys(dictionaries.mg).length, 411);
  for (const key of Object.keys(dictionaries.pt)) assert.ok(dictionaries.mg[key], 'Malagasy fallback: ' + key);
  assert.equal(ET.i18n.t('help.android.4.h'), 'Raha tsy misokatra ilay rakitra');
  assert.match(ET.i18n.t('help.ios.openfile.p'), /Raha tsy misokatra ilay rakitra/);
  assert.equal(ET.i18n.t('item.chapter', {n: 3}), 'Toko 3');
  assert.equal(ET.i18n.meta('mg').native, 'Malagasy');
  assert.match(ET.i18n.t('route.computer-android.2.p'), /File Transfer/);
});
