/* Service worker — only ever runs when the library is served over HTTP(S).
   Off a microSD card the page is file://, where service workers do not exist;
   registration is guarded and this file is simply never used.

   Its job is the app shell, not the library. Media is deliberately NOT cached:
   a packed card holds tens of gigabytes and copying that into the Cache API
   would duplicate it into the phone's own storage and fill the device.

   VERSION must change whenever the shell changes, or an installed copy keeps
   serving the old one. `easytransfer build` rewrites it. */
var VERSION = 'shell-v1';

var SHELL = [
  'index.html', 'library.html', 'item.html', 'share.html', 'help.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/js/core.js', 'assets/js/i18n.js', 'assets/js/art.js',
  'assets/js/home.js', 'assets/js/library.js', 'assets/js/item.js',
  'assets/js/share.js', 'assets/js/help.js',
  'assets/icon/icon-192.png', 'assets/icon/icon-512.png',
  'data/catalog.js'
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

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // publisher CDNs: leave alone
  if (url.pathname.indexOf('/media/') !== -1) return;   // never cache the library itself

  // Shell: cache first so it opens instantly and works with the Pi switched
  // off, but refresh in the background so a rebuilt card is picked up.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var live = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || live;
    })
  );
});
