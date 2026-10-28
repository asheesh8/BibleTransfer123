/* Service worker — only ever runs when the library is served over HTTP(S).
   Off a microSD card the page is file://, where service workers do not exist;
   registration is guarded and this file is simply never used.

   Its job is the app shell, not the library. Media is deliberately NOT cached:
   a packed card holds tens of gigabytes and copying that into the Cache API
   would duplicate it into the phone's own storage and fill the device.

   VERSION must change whenever the shell changes, or an installed copy keeps
   serving the old one. packer/et/generate.py (`npm run generate`) sets it from a
   hash of every SHELL file, and `easytransfer build` stamps card copies. */
var VERSION = 'shell-ca3490db008c';

var SHELL = [
  'index.html', 'library.html', 'item.html', 'share.html', 'help.html', 'nearby.html',
  'manifest.webmanifest', 'privacy.html', 'save-guide.html',
  'assets/css/app.css', 'assets/css/consent.css', 'assets/css/save-guide.css',
  'assets/css/help-device.css', 'assets/css/tokens.css', 'assets/css/components/sheet.css', 'assets/css/components/toast.css', 'assets/css/components/mascot.css',
  'assets/css/components/button.css', 'assets/css/components/card.css', 'assets/css/components/chip.css',
  'assets/art/kandili-village.webp', 'assets/art/kandili-village.jpg',
  'assets/js/core.js', 'assets/js/ui/icons.js', 'assets/js/ui/sheet.js', 'assets/js/ui/toast.js', 'assets/js/ui/shell.js', 'assets/js/ui/covers.js', 'assets/js/brand/mascot.js', 'assets/js/i18n.js', 'assets/js/i18n-load.js', 'assets/js/i18n/en.js', 'assets/js/art.js', 'assets/js/analytics.js',
  'assets/js/home.js', 'assets/js/library.js', 'assets/js/item.js', 'assets/js/data/bible-books.js',
  'assets/css/pages/onboarding.css', 'assets/css/pages/screens.css', 'assets/css/pages/partners.css', 'assets/js/features/partner-preview.js', 'assets/partners/dbs.webp', 'assets/partners/cef.webp', 'assets/partners/youversion-kids.webp', 'assets/js/data/onboarding-strings.js', 'assets/js/features/onboarding.js',
  'assets/js/share.js', 'assets/js/help.js', 'assets/js/save.js', 'assets/js/nearby.js', 'assets/js/save-guide.js',
  'assets/js/shared-library.js', 'assets/js/share-libraries.js', 'assets/js/visibility.js', 'assets/vendor/peerjs.min.js', 'assets/vendor/qrcode.js',
  'assets/css/components/qr.css', 'assets/css/components/progress.css', 'assets/css/pages/nearby.css',
  'share-libraries/index.html',
  'assets/icon/icon-192.png', 'assets/icon/icon-512.png',
  'data/catalog.js', 'data/catalog-home.js',
  // Language pages and catalogues come from registry/languages.json; run
  // `npm run generate` (packer/et/generate.py) instead of editing between markers.
  // generated:languages:start
  'english/index.html', 'data/catalog-eng.js', 'data/catalog-eng-shelf.js',
  'mandarin/index.html', 'data/catalog-cmn.js', 'data/catalog-cmn-shelf.js',
  'hindi/index.html', 'data/catalog-hin.js', 'data/catalog-hin-shelf.js',
  'marathi/index.html', 'data/catalog-mar.js', 'data/catalog-mar-shelf.js',
  'urdu/index.html', 'data/catalog-urd.js', 'data/catalog-urd-shelf.js',
  'swahili/index.html', 'data/catalog-swh.js', 'data/catalog-swh-shelf.js',
  'zulu/index.html', 'data/catalog-zul.js', 'data/catalog-zul-shelf.js',
  'western-punjabi/index.html', 'data/catalog-pnb.js', 'data/catalog-pnb-shelf.js',
  'cantonese/index.html', 'data/catalog-yue.js', 'data/catalog-yue-shelf.js',
  'pashto/index.html', 'northern-pashto/index.html', 'data/catalog-pus.js', 'data/catalog-pus-shelf.js',
  'eastern-punjabi/index.html', 'data/catalog-pan.js', 'data/catalog-pan-shelf.js',
  'nepali/index.html', 'data/catalog-npi.js', 'data/catalog-npi-shelf.js',
  'sindhi/index.html', 'data/catalog-snd.js', 'data/catalog-snd-shelf.js',
  'luganda/index.html', 'data/catalog-lug.js', 'data/catalog-lug-shelf.js',
  'luo/index.html', 'data/catalog-luo.js', 'data/catalog-luo-shelf.js',
  'malagasy/index.html', 'data/catalog-mlg.js', 'data/catalog-mlg-shelf.js',
  'kirundi/index.html', 'data/catalog-run.js', 'data/catalog-run-shelf.js',
  'akan/index.html', 'data/catalog-aka.js', 'data/catalog-aka-shelf.js',
  'tigrinya/index.html', 'data/catalog-tir.js', 'data/catalog-tir-shelf.js',
  'arabic/index.html', 'data/catalog-ara.js', 'data/catalog-ara-shelf.js',
  'haitian/index.html', 'data/catalog-hat.js', 'data/catalog-hat-shelf.js',
  'spanish/index.html', 'data/catalog-spa.js', 'data/catalog-spa-shelf.js',
  'kuria/index.html', 'data/catalog-kuj.js', 'data/catalog-kuj-shelf.js',
  'luhya/index.html', 'data/catalog-luy.js', 'data/catalog-luy-shelf.js',
  'bukusu/index.html', 'data/catalog-bxk.js', 'data/catalog-bxk-shelf.js',
  'saamia/index.html', 'data/catalog-lsm.js', 'data/catalog-lsm-shelf.js',
  'maragoli/index.html', 'data/catalog-rag.js', 'data/catalog-rag-shelf.js',
  'idakho/index.html', 'data/catalog-ida.js', 'data/catalog-ida-shelf.js',
  'tiriki/index.html',
  'kabras/index.html', 'data/catalog-lkb.js', 'data/catalog-lkb-shelf.js',
  'tachoni/index.html', 'data/catalog-lts.js', 'data/catalog-lts-shelf.js',
  'banyala/index.html', 'data/catalog-nle.js', 'data/catalog-nle-shelf.js',
  'marachi/index.html', 'data/catalog-lri.js', 'data/catalog-lri-shelf.js',
  'kamba/index.html', 'data/catalog-kam.js', 'data/catalog-kam-shelf.js',
  'kalenjin/index.html', 'data/catalog-kln.js', 'data/catalog-kln-shelf.js',
  'giryama/index.html', 'data/catalog-nyf.js', 'data/catalog-nyf-shelf.js',
  'digo/index.html', 'data/catalog-dig.js', 'data/catalog-dig-shelf.js',
  'duruma/index.html', 'data/catalog-dug.js', 'data/catalog-dug-shelf.js',
  'meru/index.html', 'data/catalog-mer.js', 'data/catalog-mer-shelf.js',
  'turkana/index.html', 'data/catalog-tuv.js', 'data/catalog-tuv-shelf.js',
  'teso/index.html', 'data/catalog-teo.js', 'data/catalog-teo-shelf.js',
  'chichewa/index.html', 'data/catalog-nya.js', 'data/catalog-nya-shelf.js',
  'kinyarwanda/index.html', 'data/catalog-kin.js', 'data/catalog-kin-shelf.js',
  'xhosa/index.html', 'data/catalog-xho.js', 'data/catalog-xho-shelf.js',
  'shona/index.html', 'data/catalog-sna.js', 'data/catalog-sna-shelf.js',
  'hausa/index.html', 'data/catalog-hau.js', 'data/catalog-hau-shelf.js',
  'lingala/index.html', 'data/catalog-lin.js', 'data/catalog-lin-shelf.js',
  'nigerian-pidgin/index.html', 'data/catalog-pcm.js', 'data/catalog-pcm-shelf.js',
  'yoruba/index.html', 'data/catalog-yor.js', 'data/catalog-yor-shelf.js',
  'portuguese/index.html', 'data/catalog-por.js', 'data/catalog-por-shelf.js',
  'amharic/index.html', 'data/catalog-amh.js', 'data/catalog-amh-shelf.js',
  'french/index.html', 'data/catalog-fra.js', 'data/catalog-fra-shelf.js',
  'igbo/index.html', 'data/catalog-ibo.js', 'data/catalog-ibo-shelf.js',
  'oromo/index.html', 'data/catalog-orm.js', 'data/catalog-orm-shelf.js',
  'kikuyu/index.html', 'data/catalog-kik.js', 'data/catalog-kik-shelf.js',
  'gusii/index.html', 'ekegusii/index.html', 'kisii/index.html', 'data/catalog-guz.js', 'data/catalog-guz-shelf.js',
  'maasai/index.html', 'data/catalog-mas.js', 'data/catalog-mas-shelf.js',
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

/* Interface strings, one small static file per language. Only English is
   installed up front; another language is kept once the reader has used it,
   so switching to it later works offline without installing all 38. */
var STRINGS_PATH = new RegExp('^' + SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 'assets/js/i18n/[a-z]{2,3}\\.js$');

function shellPath(url) {
  var path = url.pathname === SCOPE ? SCOPE + 'index.html' : url.pathname;
  if (STRINGS_PATH.test(path)) return path;
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
