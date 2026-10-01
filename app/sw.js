/* Service worker — only ever runs when the library is served over HTTP(S).
   Off a microSD card the page is file://, where service workers do not exist;
   registration is guarded and this file is simply never used.

   Its job is the app shell, not the library. Media is deliberately NOT cached:
   a packed card holds tens of gigabytes and copying that into the Cache API
   would duplicate it into the phone's own storage and fill the device.

   VERSION must change whenever the shell changes, or an installed copy keeps
   serving the old one. `easytransfer build` rewrites it. */
var VERSION = 'shell-v23';

var SHELL = [
  'index.html', 'library.html', 'item.html', 'share.html', 'help.html', 'nearby.html',
  'manifest.webmanifest', 'privacy.html', 'save-guide.html',
  'assets/css/app.css', 'assets/css/consent.css', 'assets/css/save-guide.css',
  'assets/js/core.js', 'assets/js/i18n.js', 'assets/js/art.js', 'assets/js/analytics.js',
  'assets/js/home.js', 'assets/js/library.js', 'assets/js/item.js',
  'assets/js/share.js', 'assets/js/help.js', 'assets/js/save.js', 'assets/js/nearby.js', 'assets/js/save-guide.js',
  'assets/js/shared-library.js', 'assets/js/share-libraries.js', 'assets/vendor/peerjs.min.js',
  'english/index.html', 'mandarin/index.html', 'hindi/index.html', 'urdu/index.html',
  'swahili/index.html', 'cantonese/index.html', 'pashto/index.html', 'sindhi/index.html',
  'zulu/index.html', 'maasai/index.html',
  'gusii/index.html', 'ekegusii/index.html', 'kisii/index.html', 'northern-pashto/index.html',
  'eastern-punjabi/index.html', 'western-punjabi/index.html', 'nepali/index.html',
  'share-libraries/index.html',
  'assets/icon/icon-192.png', 'assets/icon/icon-512.png',
  'data/catalog.js',
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
  'assets/save-guide/windows/slide-11.webp', 'assets/save-guide/windows/slide-12.webp'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // addAll fails the whole install if any one file 404s. The shell is
      // fixed and known, but a partial build should not brick installation,
      // so each file is added on its own and failures are tolerated.
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () {});
      }));
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
  e.respondWith(
    caches.match(key).then(function (hit) {
      var live = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(key, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});
