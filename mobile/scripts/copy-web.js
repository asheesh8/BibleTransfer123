/* Copies the web app (../app) into www/, the folder Capacitor packs into the
   iPhone and Android apps. app/ stays the one source: never edit www/.

   Left out, because the app never needs them inside the install:
   · admin/          the analytics dashboard (stays on the website only)
   · assets/og/      Facebook preview pictures, read by Facebook from the site
   · assets/library/ VillageServer's own files; the catalogue already points
                     at their https://www.bibletransfer123.org copies
   · sw.js           the website's offline cache; the app is offline already
   · assets/media/**.mp4  the how-to and VillageServer videos (60 MB). The
                     pages play them from the live site instead, so the app
                     download stays small; their posters stay in the app

   On the way, core.js gains window.ET_APP_VERSION, the app's version. And
   pages load the admin's library switches with <script src="api/visibility">,
   which the app has no server to answer, so the copies ask the live site
   instead. Offline that fails quietly and the switches
   built into the catalogue apply, exactly as off a card.

   Plus routes.json: the website's short links (/kisii, /pidgin, /privacy)
   from vercel.json, so a QR code scanned in the app (features/scan.js) finds
   the right page among the files. */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'app');
const OUT = path.resolve(__dirname, '..', 'www');
const LIVE = 'https://www.bibletransfer123.org';
// The app's version (mobile/package.json, kept equal to Android's versionName
// and iPhone's MARKETING_VERSION by tests/test_mobile_release.py), for
// features/app.js and analytics.
const VERSION = require('../package.json').version;
const SKIP = new Set(['admin', 'assets/og', 'assets/library', 'sw.js']);

function copy(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      const child = rel ? rel + '/' + name : name;
      if (SKIP.has(child) || name === '.DS_Store') continue;
      if (/^assets\/media\/.*\.mp4$/.test(child)) continue;
      copy(child);
    }
  } else if (rel.endsWith('.html')) {
    fs.writeFileSync(to, fs.readFileSync(from, 'utf8')
      .replace(/src="api\/visibility"/g, `src="${LIVE}/api/visibility"`));
  } else if (rel.endsWith('.js')) {
    fs.writeFileSync(to, (rel === 'assets/js/core.js' ? `window.ET_APP_VERSION = '${VERSION}';\n` : '') +
      fs.readFileSync(from, 'utf8')
      .replace(/<source src="assets\/media\//g, `<source src="${LIVE}/assets/media/`));
  } else {
    fs.copyFileSync(from, to);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
copy('');
const vercel = JSON.parse(fs.readFileSync(path.resolve(SRC, '..', 'vercel.json'), 'utf8'));
const routes = {};
for (const r of vercel.rewrites || []) {
  const from = r.source.replace(/^\/+/, ''), to = r.destination.replace(/^\/+/, '');
  if (/^[\w-]+(\/[\w-]+)*$/.test(from) && !/^admin(\/|$)/.test(from)) routes[from] = to;
}
fs.writeFileSync(path.join(OUT, 'routes.json'), JSON.stringify(routes));
let bytes = 0, files = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else { bytes += fs.statSync(p).size; files++; }
  }
})(OUT);
console.log(`www/: ${files} files, ${(bytes / 1048576).toFixed(1)} MB from app/`);
