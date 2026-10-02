// Run: node --test tests/test_sw.js
// Exercise the actual service worker against separate HTTP and Cache API stores.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../app/sw.js'), 'utf8');
const origin = 'https://library.example';
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(scopePath = '/') {
  const base = origin + scopePath;
  const listeners = {};
  const stores = new Map();
  const httpCache = new Map();
  const requests = [];
  const matches = [];
  const writes = [];
  const pendingWrites = [];
  let offline = false;
  let holdWrites = false;
  let rejectWrites = false;
  let serverBody = url => 'server:' + new URL(url).pathname;

  class Request {
    constructor(input, options = {}) {
      this.url = new URL(typeof input === 'string' ? input : input.url, base).href;
      this.method = options.method || input.method || 'GET';
      this.cache = options.cache || input.cache || 'default';
    }
  }
  class Response {
    constructor(body, status = 200) { this.body = body; this.status = status; this.ok = status >= 200 && status < 300; }
    clone() { return new Response(this.body, this.status); }
  }
  const key = value => new Request(value).url;
  const store = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const fetch = async (request, options = {}) => {
    const mode = options.cache || request.cache;
    requests.push({ url: request.url, mode });
    if (offline) throw new Error('Offline');
    // Simulate a still-fresh max-age=3600 HTTP entry. Ordinary requests get
    // stale deployment bytes; reload/no-cache must consult the current server.
    if (mode !== 'reload' && mode !== 'no-cache' && httpCache.has(request.url)) return httpCache.get(request.url).clone();
    const response = new Response(serverBody(request.url));
    httpCache.set(request.url, response.clone());
    return response;
  };
  const caches = {
    async open(name) {
      const entries = store(name);
      return {
        async add(request) { const response = await fetch(request); entries.set(key(request), response); },
        async match(request) { matches.push({ cache: name, key: key(request) }); return entries.get(key(request)); },
        async put(request, response) {
          writes.push({ cache: name, key: key(request) });
          if (rejectWrites) throw new Error('Cache storage quota exceeded');
          if (holdWrites) await new Promise(resolve => pendingWrites.push(resolve));
          entries.set(key(request), response);
        }
      };
    },
    async match(request) {
      matches.push({ cache: 'ALL', key: key(request) });
      for (const entries of stores.values()) if (entries.has(key(request))) return entries.get(key(request));
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  const self = {
    registration: { scope: base }, location: { origin },
    addEventListener(name, callback) { listeners[name] = callback; },
    async skipWaiting() { self.skipped = true; },
    clients: { async claim() { self.claimed = true; } }
  };
  const context = { self, caches, fetch, Request, URL, Promise };
  vm.runInNewContext(source, context);
  return {
    context, stores, httpCache, requests, matches, writes, self,
    seed(name, url, body) { store(name).set(key(url), new Response(body)); },
    cached(name, url) { return store(name).get(key(url)); },
    offline(value) { offline = value; },
    holdWrites(value = true) { holdWrites = value; },
    releaseWrites() { for (const resolve of pendingWrites.splice(0)) resolve(); },
    rejectWrites(value = true) { rejectWrites = value; },
    server(body) { serverBody = typeof body === 'function' ? body : () => body; },
    async lifecycle(name) {
      let work;
      listeners[name]({ waitUntil(promise) { work = promise; } });
      await work;
    },
    async dispatch(url, method = 'GET') {
      let response;
      let intercepted = false;
      const lifetime = [];
      listeners.fetch({
        request: new Request(url, { method }),
        respondWith(promise) { intercepted = true; response = promise; },
        waitUntil(promise) { lifetime.push(promise); }
      });
      return { intercepted, response: await response, lifetime };
    }
  };
}

test('install fetches current deployment bytes despite fresh stale HTTP entries', async () => {
  const h = harness();
  for (const filename of h.context.SHELL) h.httpCache.set(origin + '/' + filename, { clone() { return { body: 'old HTTP deployment' }; } });
  await h.lifecycle('install');
  assert.equal(h.requests.length, h.context.SHELL.length);
  assert.ok(h.requests.every(request => request.mode === 'reload'));
  assert.equal(h.cached(h.context.VERSION, '/assets/js/save-guide.js').body, 'server:/assets/js/save-guide.js');
  assert.equal(h.cached(h.context.VERSION, '/assets/css/save-guide.css').body, 'server:/assets/css/save-guide.css');
  assert.equal(h.cached(h.context.VERSION, '/save-guide.html').body, 'server:/save-guide.html');
  assert.equal(h.self.skipped, true);
});

test('reads only the current cache and preserves its offline fallback', async () => {
  const h = harness();
  h.seed('legacy-shell', '/assets/js/save-guide.js', 'legacy code');
  h.seed(h.context.VERSION, '/assets/js/save-guide.js', 'current code');
  h.offline(true);
  const result = await h.dispatch('/assets/js/save-guide.js');
  assert.equal(result.response.body, 'current code');
  await tick();
  assert.ok(h.matches.every(match => match.cache === h.context.VERSION));
  assert.equal(h.requests[0].mode, 'no-cache');
});

test('a current-cache miss uses the network instead of legacy cache bytes', async () => {
  const h = harness();
  h.seed('legacy-shell', '/save-guide.html', 'legacy HTML');
  const result = await h.dispatch('/save-guide.html');
  assert.equal(result.response.body, 'server:/save-guide.html');
  await tick();
  assert.equal(h.cached(h.context.VERSION, '/save-guide.html').body, 'server:/save-guide.html');
  assert.ok(h.matches.every(match => match.cache === h.context.VERSION));
});

test('an offline current-cache miss never falls back to a mismatched legacy shell', async () => {
  const h = harness();
  h.seed('legacy-shell', '/save-guide.html', 'legacy HTML');
  h.offline(true);
  const result = await h.dispatch('/save-guide.html');
  assert.equal(result.intercepted, true);
  assert.equal(result.response, undefined);
});

test('cached hits refresh with no-cache and normalize version queries for shell storage', async () => {
  const h = harness();
  h.seed(h.context.VERSION, '/assets/js/save-guide.js', 'cached code');
  h.httpCache.set(origin + '/assets/js/save-guide.js?v=24', { clone() { return { body: 'stale HTTP code' }; } });
  h.server('new server code');
  const result = await h.dispatch('/assets/js/save-guide.js?v=24');
  assert.equal(result.response.body, 'cached code');
  await tick();
  assert.equal(h.requests[0].url, origin + '/assets/js/save-guide.js?v=24');
  assert.equal(h.requests[0].mode, 'no-cache');
  assert.equal(h.cached(h.context.VERSION, '/assets/js/save-guide.js').body, 'new server code');
  assert.equal(h.writes[0].key, origin + '/assets/js/save-guide.js');
});

test('a cached response returns immediately while waitUntil holds the worker through its cache write', async () => {
  const h = harness();
  h.seed(h.context.VERSION, '/assets/js/save-guide.js', 'cached code');
  h.server('refreshed code');
  h.holdWrites();
  const result = await h.dispatch('/assets/js/save-guide.js');
  assert.equal(result.response.body, 'cached code');
  assert.equal(result.lifetime.length, 1);
  let finished = false;
  const lifetime = Promise.all(result.lifetime).then(() => { finished = true; });
  await tick();
  assert.equal(h.writes.length, 1);
  assert.equal(finished, false, 'worker lifetime must include the pending cache write');
  assert.equal(h.cached(h.context.VERSION, '/assets/js/save-guide.js').body, 'cached code');
  h.releaseWrites();
  await lifetime;
  assert.equal(finished, true);
  assert.equal(h.cached(h.context.VERSION, '/assets/js/save-guide.js').body, 'refreshed code');
});

test('failed cache writes do not discard a successful online response on a cache miss', async () => {
  const h = harness();
  h.rejectWrites();
  const result = await h.dispatch('/assets/js/save-guide.js');
  assert.ok(result.response, 'network response remains usable when caching is unavailable');
  assert.equal(result.response.body, 'server:/assets/js/save-guide.js');
  await Promise.all(result.lifetime);
});

test('API, media, signalling, cross-origin and mutation requests remain unintercepted', async () => {
  const h = harness();
  for (const [url, method] of [
    ['/api/admin?days=30', 'GET'], ['/api/analytics', 'POST'],
    ['/media/large-film.mp4', 'GET'], ['/signal/poll', 'GET'],
    ['https://publisher.example/assets/js/core.js', 'GET'], ['/index.html', 'POST']
  ]) assert.equal((await h.dispatch(url, method)).intercepted, false, url);
  assert.equal(h.requests.length, 0);
  assert.equal(h.matches.length, 0);
});

test('activation removes legacy versions before claiming clients', async () => {
  const h = harness();
  h.seed('legacy-shell', '/index.html', 'old');
  h.seed(h.context.VERSION, '/index.html', 'new');
  await h.lifecycle('activate');
  assert.deepEqual([...h.stores.keys()], [h.context.VERSION]);
  assert.equal(h.self.claimed, true);
});

test('a library served beneath a subpath still normalizes its root and scoped asset keys', async () => {
  const h = harness('/app/');
  h.seed(h.context.VERSION, '/app/index.html', 'card home');
  h.offline(true);
  assert.equal((await h.dispatch('/app/')).response.body, 'card home');
  assert.equal((await h.dispatch('/assets/js/core.js')).intercepted, false);
});

test('Kikuyu, Marathi and Luganda library pages remain available offline after installation', async () => {
  const h = harness();
  await h.lifecycle('install');
  h.offline(true);
  for (const slug of ['kikuyu', 'marathi', 'luganda']) {
    const result = await h.dispatch('/' + slug + '/index.html');
    assert.equal(result.intercepted, true);
    assert.equal(result.response.body, 'server:/' + slug + '/index.html');
  }
});
