/* Workflow checks for observable browser actions. Run: node tests/test_instrumentation.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

// The app uses classic scripts and a small DOM surface. This fake keeps the
// tests dependency-free while exercising their public UI and transport hooks.
class Element {
  constructor(tag = 'div', attributes = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = attributes;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.classList = { add() {}, remove() {} };
    this.value = '';
  }
  set innerHTML(value) {
    this.html = value;
    this.children = Array.from(value.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi), match => {
      const attrs = {};
      for (const a of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      return new Element(match[1], attrs);
    });
  }
  get innerHTML() { return this.html || ''; }
  set href(value) { this.attributes.href = value; }
  get href() { return this.attributes.href; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(event, fn) { (this.listeners[event] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({ target: this }); }
  select() {}
  focus() {}
  scrollIntoView() {}
  remove() {}
  appendChild(child) { this.children.push(child); return child; }
  querySelectorAll(selector) {
    const matches = node => {
      if (selector[0] === '#') return node.attributes.id === selector.slice(1);
      if (selector[0] === '.') return (node.attributes.class || '').split(/\s+/).includes(selector.slice(1));
      const data = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
      if (data) return data[1] in node.attributes && (data[2] === undefined || node.attributes[data[1]] === data[2]);
      return node.tagName.toLowerCase() === selector;
    };
    return this.children.flatMap(child => [matches(child) ? child : null, ...child.querySelectorAll(selector)]).filter(Boolean);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture(options = {}) {
  const events = [], sheets = [], downloads = [], peers = [];
  const body = new Element('body');
  body.appendChild(new Element('div', { class: 'shared-actions' }));
  ['item', 'wizard', 'nearby', 'back', 'back-ico', 'shared-badge', 'shared-title', 'shared-lead',
    'email-library', 'copy-library', 'copy-status', 'share-language-list', 'share-back-ico', 'web-note']
    .forEach(id => body.appendChild(new Element('div', { id })));
  const item = { id: 'film-eng', lang: 'eng', title: 'A film', type: 'film',
    files: [{ file: 'https://media.example/film.mp4', label: 'MP4', bytes: 4 }] };
  const scope = options.scope === undefined ? { lang: 'eng', slug: 'english', name: 'English' } : options.scope;
  let allowed = options.allowed !== false, serial = 0;
  const ET = {
    $: (selector, root = body) => root.querySelector(selector),
    $$: (selector, root = body) => root.querySelectorAll(selector),
    esc: String, icon: () => '', human: String, pad: n => String(n).padStart(2, '0'),
    libraryScope: () => scope, contentLang: () => 'eng',
    library: () => ({ languages: { eng: { name: 'English', native: 'English' } }, resources: [item] }),
    byId: id => id === item.id ? item : null,
    qs: key => key === 'signal' ? 'broker' : key === 'id' && options.itemPage ? item.id : '',
    scopedUrl: (page, params = {}) => page + '?' + new URLSearchParams(params),
    scopeEntryUrl: () => '/english', safeUrl: x => x, safeType: () => 'video/mp4', openable: () => false,
    displayTitle: r => r.title, thumb: () => '', header() {}, tabbar() {}, stepper: () => '',
    art: { share: () => '' }, store: { get: (key, value) => value, set() {} },
    i18n: { t: (key, params) => key === 'sharelib.body' ? params.url : key, h: key => key, tOr: (key, value) => value,
      tOrHTML: (key, value) => value, apply() {}, onChange() {} },
    sheet(html) { const el = body.appendChild(new Element()); el.innerHTML = html;
      const sheet = { el, close() {} }; sheets.push(sheet); return sheet; },
    analytics: {
      track(type, fields) { if (allowed) events.push({ type, ...fields }); },
      shareIntent(url, channel, fields) {
        const shareId = allowed ? 'share-' + (++serial) : '';
        this.track('share_intent', { ...fields, channel, shareId });
        return { url: shareId ? url + (url.includes('?') ? '&' : '?') + 'et_share=' + shareId : url, shareId };
      }
    }
  };
  const document = { body, title: '', createElement(tag) {
    const node = new Element(tag);
    if (tag === 'a') node.click = () => { Element.prototype.click.call(node); downloads.push(node.href); };
    return node;
  }, execCommand: () => options.copyResult !== false };
  class Emitter {
    constructor() { this.listeners = {}; }
    on(name, callback) { (this.listeners[name] ||= []).push(callback); }
    emit(name, value) { for (const callback of this.listeners[name] || []) callback(value); }
  }
  class Peer extends Emitter {
    constructor() { super(); peers.push(this); }
    destroy() {}
    connect() { return this.connection; }
  }
  const location = options.file ? { protocol: 'file:', href: 'file:///card/app/english/index.html', origin: 'null' }
    : { protocol: 'https:', origin: 'https://example.test', href: 'https://example.test/app/item.html?id=film-eng' };
  const window = { ET, Peer, crypto: webcrypto, addEventListener() {}, scrollTo() {},
    matchMedia: () => ({ matches: false }), RTCPeerConnection: function () {} };
  Object.assign(window, options.window);
  const navigator = { userAgent: 'Test browser', ...options.navigator };
  const fetch = options.fetch || (async () => {
    let sent = false;
    return { ok: true, headers: { get: () => '4' }, body: {
      getReader: () => ({ read: async () => sent ? { done: true }
        : (sent = true, { done: false, value: new Uint8Array([1, 2, 3, 4]) }) }), cancel() {} }
    };
  });
  const context = vm.createContext({ ET, window, document, location, navigator, URL, URLSearchParams,
    Blob, File: class extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } },
    AbortController, Uint8Array, Uint32Array, RTCPeerConnection: window.RTCPeerConnection,
    fetch, setTimeout: () => 1, clearTimeout() {}, console });
  return { events, sheets, downloads, peers, body, item, document, navigator, context,
    load(name) { vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/assets/js/', name + '.js'), 'utf8'), context); },
    query(selector) { return body.querySelector(selector); },
    allow(value) { allowed = value; }, Emitter };
}

async function settle() { for (let n = 0; n < 30; n++) await Promise.resolve(); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject }; }
function count(f, type) { return f.events.filter(e => e.type === type); }

async function sharing() {
  const copied = [];
  const f = fixture({ allowed: false, navigator: { clipboard: { writeText: async value => copied.push(value) } } });
  f.load('shared-library');
  f.query('#copy-library').click(); await settle();
  assert.equal(f.events.length, 0, 'sharing before consent records no events');
  assert.equal(copied[0], 'https://example.test/english', 'no-consent sharing preserves the ordinary link');
  f.allow(true);
  f.query('#email-library').click();
  const first = f.query('#email-library').href;
  f.query('#email-library').click();
  assert.notEqual(f.query('#email-library').href, first, 'each email click makes a fresh referral link');
  assert.equal(count(f, 'share_complete').length, 0, 'opening email cannot confirm a share');
  f.query('#copy-library').click(); await settle();
  assert.equal(count(f, 'share_complete')[0].status, 'copied');
  assert.match(copied.at(-1), /et_share=/);

  const denied = fixture({ copyResult: false, navigator: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
  denied.load('shared-library'); denied.query('#copy-library').click(); await settle();
  assert.equal(count(denied, 'share_complete').length, 0, 'failed clipboard fallback never reports success');

  const nativeResult = deferred();
  const native = fixture({ itemPage: true, navigator: { share: () => nativeResult.promise } });
  native.load('item'); native.query('#share').click(); native.query('[data-s="native"]').click();
  assert.equal(count(native, 'share_complete').length, 0, 'opening a native sheet is only intent');
  nativeResult.resolve(); await settle();
  assert.equal(count(native, 'share_complete')[0].status, 'handed_off', 'native resolution records handoff, not delivery');

  const cancelResult = deferred();
  const cancel = fixture({ itemPage: true, navigator: { share: () => cancelResult.promise } });
  cancel.load('item'); cancel.query('#share').click(); cancel.query('[data-s="native"]').click();
  cancelResult.reject({ name: 'AbortError' }); await settle();
  assert.equal(count(cancel, 'share_cancel')[0].status, 'cancelled');
  assert.equal(count(cancel, 'share_complete').length, 0);

  const file = fixture({ file: true, allowed: false });
  file.load('shared-library'); file.query('#copy-library').click(); await settle();
  assert.equal(file.events.length, 0, 'the offline sharing path remains usable');

  const launcher = fixture(); launcher.load('share-libraries');
  const email = launcher.query('[data-share-email="urdu"]'); email.click();
  const launchUrl = email.href; email.click();
  assert.notEqual(email.href, launchUrl, 'launcher emails also get fresh attribution');
  assert.equal(count(launcher, 'share_intent')[0].language, 'urd', 'launcher tracks the shared library language');
}

async function languageLibraries() {
  for (const [slug, content, ui, native, browserLanguage] of [
    ['kikuyu', 'kik', 'kik', 'Gĩkũyũ', 'ki-KE'],
    ['marathi', 'mar', 'mr', 'मराठी', 'mr-IN'],
    ['luganda', 'lug', 'lg', 'Luganda', 'lg-UG']
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '../app', slug, 'index.html'), 'utf8');
    const scope = JSON.parse(html.match(/window\.ET_SHARED_LIBRARY = (\{[^\n]+\});/)[1]);
    const f = fixture({ navigator: { languages: [browserLanguage] }, window: {
      ET_SHARED_LIBRARY: scope,
      LIBRARY: { languages: { [content]: { name: scope.name, native } }, resources: [] }
    } });
    f.document.documentElement = new Element('html');
    f.document.querySelector = selector => f.body.querySelector(selector);
    f.document.querySelectorAll = selector => f.body.querySelectorAll(selector);
    f.load('core');
    f.context.ET = f.context.window.ET;
    f.load('i18n');
    const ET = f.context.ET;
    assert.equal(ET.i18n.current(), ui, 'the public page opens in its own UI language');
    assert.equal(ET.i18n.meta(ui).native, native);
    assert.equal(ET.i18n.suggested(), ui, 'the phone locale suggests the matching library');
    assert.equal(ET.contentCode(ui), content, 'the UI language selects its content code');
    if (ui === 'lg') {
      assert.equal(ET.bookName('Genesis'), 'Olubereberye');
      assert.equal(ET.bookName('Revelation'), 'Okubikkulirwa');
    }
    assert.equal(ET.contentLang(), content);
    assert.equal(ET.inMyLanguage({ lang: content }), true);
    assert.equal(ET.inMyLanguage({ lang: 'eng' }), false, 'shared libraries exclude other languages');
    assert.equal(ET.scopeEntryUrl(), '/' + slug);
    const itemLink = new URL(ET.scopedUrl('item.html', { id: 'resource' }), 'https://example.test/');
    assert.equal(itemLink.searchParams.get('only'), content, 'item navigation retains the language lock');
    assert.equal(itemLink.searchParams.get('ui'), ui);
    assert.equal(itemLink.searchParams.get('share'), slug);
    f.load('shared-library');
    if (ui === 'mr') {
      assert.match(ET.i18n.t('lib.search'), /[\u0900-\u097F]/, 'Marathi controls are translated');
      assert.doesNotMatch(f.query('#shared-lead').innerHTML, /Some menus in English/);
    } else {
      assert.equal(ET.i18n.t('lib.search'), ui === 'lg' ? 'Noonya' : 'Etha na rĩĩtwa', 'native search is translated');
      assert.match(f.query('#shared-lead').innerHTML, /Some menus in English/, 'direct links disclose the partial interface');
    }

    const launcher = fixture();
    launcher.load('share-libraries');
    const email = launcher.query('[data-share-email="' + slug + '"]');
    assert.ok(email, 'the language appears in the sharing launcher');
    email.click();
    const sharedLink = new URL(email.href).searchParams.get('body');
    assert.equal(new URL(sharedLink).pathname, '/' + slug);
    assert.equal(count(launcher, 'share_intent')[0].language, content);
  }
}

async function composers() {
  for (const component of ['shared-library', 'item']) {
    const f = fixture({ itemPage: component === 'item', allowed: false });
    f.load(component); if (component === 'item') f.query('#share').click();
    const button = channel => f.query(component === 'item' ? '[data-s="' + channel + '"]' : '[data-shared-channel="' + channel + '"]');
    assert.equal(f.events.length, 0, 'rendering composer links sends no analytics');
    const whatsapp = button('whatsapp'), telegram = button('telegram');
    assert.ok(whatsapp && telegram, 'both explicit channel actions are present online');
    assert.ok(!whatsapp.href.includes('et_share'), 'composer links start without tracking parameters');
    whatsapp.click(); assert.equal(f.events.length, 0, 'no-consent composer click records no event');
    const noConsentWhatsApp = new URL(whatsapp.href);
    assert.equal(noConsentWhatsApp.origin, 'https://wa.me');
    assert.ok(!noConsentWhatsApp.searchParams.get('text').includes('et_share'));
    f.allow(true);
    whatsapp.click();
    const first = whatsapp.href; whatsapp.click();
    assert.notEqual(whatsapp.href, first, 'each composer click gets a fresh share ID');
    const wa = new URL(whatsapp.href);
    assert.equal(wa.searchParams.get('text').split('\n').length, 2);
    assert.match(wa.searchParams.get('text').split('\n')[1], /^https:\/\/example\.test\/.*et_share=/);
    telegram.click();
    const telegramUrl = new URL(telegram.href);
    assert.equal(telegramUrl.origin + telegramUrl.pathname, 'https://t.me/share/url');
    assert.match(telegramUrl.searchParams.get('url'), /^https:\/\/example\.test\/.*et_share=/);
    assert.equal(telegramUrl.searchParams.get('text'), component === 'item' ? f.item.title : 'sharelib.title');
    const intents = count(f, 'share_intent');
    assert.deepEqual(intents.map(e => [e.channel, e.status]), [['whatsapp', 'opened'], ['whatsapp', 'opened'], ['telegram', 'opened']]);
    assert.equal(count(f, 'share_complete').length, 0, 'opening a message composer never counts a completed share');
    const offline = fixture({ file: true, itemPage: component === 'item', allowed: false });
    offline.load(component); if (component === 'item') offline.query('#share').click();
    assert.equal(offline.query('[data-shared-channel="whatsapp"]') || offline.query('[data-s="whatsapp"]'), null);
    assert.equal(offline.query('[data-shared-channel="telegram"]') || offline.query('[data-s="telegram"]'), null);
  }
}

async function saving() {
  const close = deferred(); let written = 0;
  const handle = { name: 'film.mp4', createWritable: async () => ({
    write: async chunk => { written += chunk.byteLength; }, close: () => close.promise, abort() {} }) };
  const saved = fixture({ window: { showSaveFilePicker: async () => handle } });
  saved.load('save'); saved.context.ET.save.open(saved.item);
  saved.query('[data-w="file"]').click(); await settle();
  assert.equal(written, 4);
  assert.equal(count(saved, 'download_complete').length, 0, 'file write completion waits for successful close');
  close.resolve(); await settle();
  assert.equal(count(saved, 'download_complete')[0].status, 'saved');
  assert.equal(count(saved, 'download_complete')[0].bytes, 4);
  assert.match(saved.query('#save-flow').innerHTML, /save.done.title/);
  assert.doesNotMatch(saved.query('#save-flow').innerHTML, /save.done.browser.title/);

  const browser = fixture(); browser.load('save'); browser.context.ET.save.open(browser.item);
  browser.query('[data-w="downloads"]').click(); await settle();
  assert.equal(browser.downloads.length, 1);
  assert.match(browser.query('#save-flow').innerHTML, /save.done.browser.title/);
  assert.match(browser.query('#save-flow').innerHTML, /save.done.browser.where/);
  assert.equal(count(browser, 'download_complete')[0].status, 'browser_handoff', 'browser download does not claim a saved file');

  const stopped = fixture({ fetch: (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject({ name: 'AbortError' }));
  }) });
  stopped.load('save'); stopped.context.ET.save.open(stopped.item);
  stopped.query('[data-w="downloads"]').click(); stopped.query('#sv-stop').click(); await settle();
  assert.equal(count(stopped, 'download_cancel')[0].status, 'cancelled');
  assert.equal(count(stopped, 'download_complete').length, 0);

  const failed = fixture({ window: { showSaveFilePicker: async () => ({ name: 'film.mp4',
    createWritable: async () => ({ write: async () => {}, close: async () => { throw new Error('disk full'); } }) }) } });
  failed.load('save'); failed.context.ET.save.open(failed.item);
  failed.query('[data-w="file"]').click(); await settle();
  assert.equal(count(failed, 'download_error')[0].status, 'failed', 'failed filesystem close is an error');
  assert.equal(count(failed, 'download_complete').length, 0);

  const batch = fixture(); batch.load('save');
  const second = { ...batch.item, id: 'film-urd', lang: 'urd', title: 'Another film' };
  batch.context.ET.save.openMany([batch.item, second]); batch.query('[data-bw="downloads"]').click(); await settle();
  assert.deepEqual(count(batch, 'download_complete').map(e => [e.resource, e.language]),
    [['film-eng', 'eng'], ['film-urd', 'urd']], 'batch downloads retain each resource and language');
}

function connection(f, guest = false) {
  const peer = f.peers.at(-1), conn = new f.Emitter(), messages = [];
  const dc = { bufferedAmount: 0, send: value => messages.push(value), close() {} };
  conn.dataChannel = dc; conn.peerConnection = { sctp: { maxMessageSize: 16384 } }; conn.close = () => {};
  if (guest) { peer.connection = conn; peer.emit('open'); } else peer.emit('connection', conn);
  conn.emit('open');
  dc.onmessage({ data: JSON.stringify({ t: 'hi', device: 'phone' }) });
  return { dc, messages, message: value => dc.onmessage({ data: typeof value === 'string' ? value : JSON.stringify(value) }) };
}

async function nearby() {
  const sender = fixture({ itemPage: true }); sender.load('save'); sender.load('nearby'); await settle();
  sender.query('#r-send').click();
  const channel = connection(sender);
  sender.query('[data-c="0"]').click(); await settle();
  assert.equal(count(sender, 'share_intent')[0].channel, 'nearby');
  assert.equal(count(sender, 'transfer_start').length, 0, 'offering a file does not start its transfer');
  channel.message({ t: 'accept' }); await settle();
  assert.equal(count(sender, 'transfer_start').length, 1);
  assert.equal(count(sender, 'transfer_complete').length, 0, 'sending all bytes does not confirm receipt');
  channel.message({ t: 'got' });
  assert.equal(count(sender, 'transfer_complete')[0].status, 'sent');
  assert.equal(count(sender, 'transfer_complete')[0].bytes, 4);
  channel.message({ t: 'got' });
  assert.equal(count(sender, 'transfer_complete').length, 1, 'duplicate acknowledgements do not count twice');

  const close = deferred();
  const receiver = fixture({ scope: null, window: { showDirectoryPicker: async () => ({
    name: 'Chosen folder', getFileHandle: async () => ({ createWritable: async () => ({
      write: async () => {}, close: () => close.promise }) }) }) } });
  receiver.load('save'); receiver.load('nearby'); await settle(); receiver.query('#r-recv').click();
  receiver.query('#code-in').value = '123456'; receiver.query('#go').click();
  const incoming = connection(receiver, true);
  incoming.message({ t: 'batch', files: [{ name: 'private-filename.mp4', size: 4 }], total: 4 });
  receiver.query('#acc-dir').click(); await settle();
  incoming.message({ t: 'file', i: 0 });
  incoming.dc.onmessage({ data: new Uint8Array([1, 2, 3, 4]).buffer });
  incoming.message({ t: 'eof', i: 0 }); incoming.message({ t: 'end' }); await settle();
  assert.equal(count(receiver, 'transfer_complete').length, 0, 'receiver completion waits for file writes to close');
  assert.equal(incoming.messages.some(value => typeof value === 'string' && JSON.parse(value).t === 'got'), false);
  close.resolve(); await settle();
  assert.equal(count(receiver, 'transfer_complete')[0].status, 'received');
  assert.equal(incoming.messages.some(value => typeof value === 'string' && JSON.parse(value).t === 'got'), true);
  assert.ok(!JSON.stringify(receiver.events).includes('private-filename'), 'analytics excludes user filenames');
  assert.ok(!JSON.stringify(receiver.events).includes('123456'), 'analytics excludes pairing codes');

  const memory = fixture({ scope: null }); memory.load('save'); memory.load('nearby'); await settle();
  memory.query('#r-recv').click(); memory.query('#code-in').value = '654321'; memory.query('#go').click();
  const memoryChannel = connection(memory, true);
  memoryChannel.message({ t: 'batch', files: [{ name: 'forwarded.mp4', size: 4 }], total: 4 });
  memory.query('#acc').click(); memoryChannel.message({ t: 'file', i: 0 });
  memoryChannel.dc.onmessage({ data: new Uint8Array([1, 2, 3, 4]).buffer });
  memoryChannel.message({ t: 'eof', i: 0 }); memoryChannel.message({ t: 'end' }); await settle();
  assert.equal(count(memory, 'transfer_complete')[0].status, 'received');
  memory.query('[data-download="0"]').click();
  assert.equal(count(memory, 'download_complete')[0].status, 'browser_handoff');
  memory.query('#pass').click(); await settle(); connection(memory);
  memory.query('[data-carry="0"]').click();
  assert.equal(count(memory, 'share_intent')[0].status, 'offered', 'onward sharing is measured through the normal offer flow');
  assert.ok(!JSON.stringify(memory.events).includes('forwarded.mp4'));
}

async function guides() {
  const f = fixture({ itemPage: true }); f.load('share');
  const button = (which, id) => f.context.ET.$$('[data-pick]').find(b => b.getAttribute('data-pick') === which && b.getAttribute('data-id') === id);
  button('from', 'iphone').click(); button('to', 'android').click();
  assert.equal(count(f, 'share_intent')[0].status, 'guide_opened');
  assert.equal(count(f, 'share_intent')[0].channel, undefined, 'a mixed-method guide does not claim a method was used');
  assert.equal(count(f, 'share_complete').length, 0, 'reading instructions never confirms an external transfer');
}


async function missingBibleChapter() {
  const f = fixture({ itemPage: true });
  f.item.type = 'audio-bible';
  f.item.play = { kind: 'audio-bible', testaments: ['OT'], saveChapter: true,
    missingChapters: { Judges: [18] } };
  f.context.ET.BOOKS = { OT: [[7, 'Judges', 21], [8, 'Ruth', 4]] };
  f.context.ET.bookName = name => name;
  f.context.ET.audioBibleUrl = (_, tt, n, book, chapter) => book + '/' + chapter + '.mp3';
  f.context.ET.store.get = (_, fallback) => fallback === '0:1' ? '0:18' : fallback;
  const notices = []; f.context.ET.toast = value => notices.push(value);
  f.load('item');
  const audio = f.query('#a'), book = f.query('#bk'), chapter = f.query('#bc');
  audio.play = async () => {};
  assert.match(chapter.innerHTML, /value="18" disabled>18 · item.chapter.unavailable/);
  assert.equal(chapter.value, '1', 'an old bookmark cannot load the missing chapter');
  assert.equal(audio.src, 'Judges/1.mp3');
  chapter.value = '17'; chapter.listeners.change[0]();
  audio.listeners.ended[0]();
  assert.equal(chapter.value, '17', 'autoplay must stop rather than silently skip Scripture');
  assert.equal(audio.src, 'Judges/17.mp3');
  assert.equal(notices.length, 1);
  chapter.value = '18'; chapter.listeners.change[0]();
  assert.equal(audio.src, 'Judges/17.mp3', 'even a synthetic change cannot request missing audio');
  chapter.value = '19'; chapter.listeners.change[0]();
  assert.equal(audio.src, 'Judges/19.mp3', 'a reader can explicitly continue past the missing chapter');
  chapter.value = '21'; audio.listeners.ended[0]();
  assert.equal(book.value, '1'); assert.equal(audio.src, 'Ruth/1.mp3');
}

(async () => {
  await missingBibleChapter(); await sharing(); await languageLibraries(); await composers(); await saving(); await nearby(); await guides();
  console.log('Sharing, WhatsApp/Telegram composers, clipboard, native handoff, save, cancellation, Nearby receipts and guide instrumentation passed.');
})().catch(err => { console.error(err); process.exitCode = 1; });
