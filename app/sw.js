/* Service worker — only ever runs when the library is served over HTTP(S).
   Off a microSD card the page is file://, where service workers do not exist;
   registration is guarded and this file is simply never used.

   Its job is the app shell, not the library. Media is deliberately NOT cached:
   a packed card holds tens of gigabytes and copying that into the Cache API
   would duplicate it into the phone's own storage and fill the device.

   VERSION must change whenever the shell changes, or an installed copy keeps
   serving the old one. packer/et/generate.py (`npm run generate`) sets it from a
   hash of every SHELL file, and `easytransfer build` stamps card copies. */
var VERSION = 'shell-c17a69a94322';

var SHELL = [
  'index.html', 'library.html', 'item.html', 'share.html', 'help.html', 'nearby.html',
  'manifest.webmanifest', 'privacy.html', 'save-guide.html',
  'assets/css/app.css', 'assets/css/consent.css', 'assets/css/save-guide.css',
  'assets/css/help-device.css',
  'assets/js/core.js', 'assets/js/i18n.js', 'assets/js/art.js', 'assets/js/analytics.js',
  'assets/js/home.js', 'assets/js/library.js', 'assets/js/item.js', 'assets/js/data/bible-books.js',
  'assets/js/share.js', 'assets/js/help.js', 'assets/js/save.js', 'assets/js/nearby.js', 'assets/js/save-guide.js',
  'assets/js/shared-library.js', 'assets/js/share-libraries.js', 'assets/js/visibility.js', 'assets/vendor/peerjs.min.js',
  'share-libraries/index.html',
  'assets/icon/icon-192.png', 'assets/icon/icon-512.png',
  'data/catalog.js', 'data/catalog-home.js',
  // Language pages and catalogues come from registry/languages.json; run
  // `npm run generate` (packer/et/generate.py) instead of editing between markers.
  // generated:languages:start
  'english/index.html', 'data/catalog-eng.js',
  'mandarin/index.html', 'data/catalog-cmn.js',
  'hindi/index.html', 'data/catalog-hin.js',
  'marathi/index.html', 'data/catalog-mar.js',
  'urdu/index.html', 'data/catalog-urd.js',
  'swahili/index.html', 'data/catalog-swh.js',
  'zulu/index.html', 'data/catalog-zul.js',
  'western-punjabi/index.html', 'data/catalog-pnb.js',
  'cantonese/index.html', 'data/catalog-yue.js',
  'pashto/index.html', 'northern-pashto/index.html', 'data/catalog-pus.js',
  'eastern-punjabi/index.html', 'data/catalog-pan.js',
  'nepali/index.html', 'data/catalog-npi.js',
  'sindhi/index.html', 'data/catalog-snd.js',
  'luganda/index.html', 'data/catalog-lug.js',
  'luo/index.html', 'data/catalog-luo.js',
  'malagasy/index.html', 'data/catalog-mlg.js',
  'kirundi/index.html', 'data/catalog-run.js',
  'akan/index.html', 'data/catalog-aka.js',
  'tigrinya/index.html', 'data/catalog-tir.js',
  'arabic/index.html', 'data/catalog-ara.js',
  'haitian/index.html', 'data/catalog-hat.js',
  'spanish/index.html', 'data/catalog-spa.js',
  'kuria/index.html', 'data/catalog-kuj.js',
  'luhya/index.html', 'data/catalog-luy.js',
  'bukusu/index.html', 'data/catalog-bxk.js',
  'saamia/index.html', 'data/catalog-lsm.js',
  'maragoli/index.html', 'data/catalog-rag.js',
  'idakho/index.html', 'data/catalog-ida.js',
  'tiriki/index.html',
  'kabras/index.html', 'data/catalog-lkb.js',
  'tachoni/index.html', 'data/catalog-lts.js',
  'banyala/index.html', 'data/catalog-nle.js',
  'marachi/index.html', 'data/catalog-lri.js',
  'kamba/index.html', 'data/catalog-kam.js',
  'kalenjin/index.html', 'data/catalog-kln.js',
  'giryama/index.html', 'data/catalog-nyf.js',
  'digo/index.html', 'data/catalog-dig.js',
  'duruma/index.html', 'data/catalog-dug.js',
  'meru/index.html', 'data/catalog-mer.js',
  'turkana/index.html', 'data/catalog-tuv.js',
  'teso/index.html', 'data/catalog-teo.js',
  'chichewa/index.html', 'data/catalog-nya.js',
  'kinyarwanda/index.html', 'data/catalog-kin.js',
  'xhosa/index.html', 'data/catalog-xho.js',
  'shona/index.html', 'data/catalog-sna.js',
  'hausa/index.html', 'data/catalog-hau.js',
  'lingala/index.html', 'data/catalog-lin.js',
  'nigerian-pidgin/index.html', 'data/catalog-pcm.js',
  'yoruba/index.html', 'data/catalog-yor.js',
  'portuguese/index.html', 'data/catalog-por.js',
  'amharic/index.html', 'data/catalog-amh.js',
  'french/index.html', 'data/catalog-fra.js',
  'igbo/index.html', 'data/catalog-ibo.js',
  'oromo/index.html', 'data/catalog-orm.js',
  'kikuyu/index.html', 'data/catalog-kik.js',
  'gusii/index.html', 'ekegusii/index.html', 'kisii/index.html', 'data/catalog-guz.js',
  'maasai/index.html', 'data/catalog-mas.js',
  // generated:languages:end
  'assets/save-guide/macos/slide-01.webp', 'assets/save-guide/macos/slide-02.webp',
  'assets/save-guide/macos/slide-03.webp', 'assets/save-guide/macos/slide-04.webp',
  'assets/save-guide/macos/slide-05.webp', 'assets/save-guide/macos/slide-06.webp',
  'assets/save-guide/macos/slide-07.webp', 'assets/save-guide/macos/slide-08.webp',
  'assets/save-guide/macos/slide-09.webp', 'assets/save-guide/macos/slide-10.webp',
  'assets/save-guide/macos/slide-11.webp', 'assets/save-guide/macos/slide-12.webp',
  'assets/save-guide/windows/slide-01.webp', 'assets/save-guide/windows/slide-02.webp',
  'assets/save-guide/windows/slide-03.webp', 'assets/save-guide/windows/slide-04.webp',
  'assets/save-guide/windows/slide-05.webp', 'assets/save-guide/windows/slide-06.webp',
  'assets/save-guide/windows/slide-07.webp', 'assets/save-guide/windows/slide-08.webp',
  'assets/save-guide/windows/slide-09.webp', 'assets/save-guide/windows/slide-10.webp',
  'assets/save-guide/windows/slide-11.webp', 'assets/save-guide/windows/slide-12.webp',
  'assets/media/village-server-deployment.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // addAll fails the whole install if any one file 404s. The shell is
      // fixed and known, but a partial build should not brick installation,
      // so each file is added on its own and failures are tolerated.
      // Bound background requests so installing offline support does not
      // crowd out a film or a page the person opens next.
      var next = 0;
      function cacheNext() {
        if (next >= SHELL.length) return Promise.resolve();
        var u = SHELL[next++];
        // A new shell version must not inherit fresh-but-outdated HTTP assets.
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {})
          .then(cacheNext);
      }
      return Promise.all([cacheNext(), cacheNext(), cacheNext()]);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
                             .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Only the files in SHELL are ever served from the cache. Everything else —
   Nearby's signalling, the library's media, a publisher's CDN — goes straight
   to the network untouched.

   It used to be the other way round (cache any same-origin GET, skip /media/),
   and that silently broke Nearby on a Pi: the "any messages for me?" poll has
   the same URL every time, so after the first answer the worker kept handing
   back that same stored OFFER instead of asking the server. An allow-list
   cannot make that mistake with a URL it has never heard of. */
var SCOPE = new URL(self.registration.scope).pathname;
var SHELL_PATHS = SHELL.map(function (p) { return SCOPE + p; });

function shellPath(url) {
  var path = url.pathname === SCOPE ? SCOPE + 'index.html' : url.pathname;
  return SHELL_PATHS.indexOf(path) === -1 ? null : path;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var path = shellPath(url);
  if (!path) return;

  // Cache first so the shell opens instantly and works with the Pi switched
  // off, but refresh in the background so a rebuild is picked up. Keyed by
  // path alone: item.html?id=a and item.html?id=b are the same page.
  var key = new Request(path);
  var cached = caches.open(VERSION).then(function (c) { return c.match(key); });
  // Revalidate against the server even within an asset's HTTP max-age.
  var live = fetch(req, { cache: 'no-cache' }).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      return caches.open(VERSION).then(function (c) {
        return c.put(key, copy);
      }).catch(function () {
        // A full or unavailable cache must not discard a successful response.
      }).then(function () { return res; });
    }
    return res;
  }).catch(function () { return cached; });
  // Keep the refresh and cache write alive after returning a cached response.
  e.waitUntil(live.then(function () {}));
  e.respondWith(
    cached.then(function (hit) { return hit || live; })
  );
});
