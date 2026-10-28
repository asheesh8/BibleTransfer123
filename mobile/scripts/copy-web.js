/* Copies the web app (../app) into www/, the folder Capacitor packs into the
   iPhone and Android apps. app/ stays the one source: never edit www/.

   Left out, because the app never needs them inside the install:
   · admin/          the analytics dashboard (stays on the website only)
   · assets/og/      Facebook preview pictures, read by Facebook from the site
   · assets/library/ VillageServer's own files; the catalogue already points
                     at their https://www.bibletransfer123.org copies
   · sw.js           the website's offline cache; the app is offline already

   And one change on the way: pages load the admin's library switches with
   <script src="api/visibility">, which the app has no server to answer, so the
   copies ask the live site instead. Offline that fails quietly and the switches
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
const SKIP = new Set(['admin', 'assets/og', 'assets/library', 'sw.js']);

function copy(rel) {
  const from = path.join(SRC, rel);
  const to = path.join(OUT, rel);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      const child = rel ? rel + '/' + name : name;
      if (!SKIP.has(child) && name !== '.DS_Store') copy(child);
    }
  } else if (rel.endsWith('.html')) {
    fs.writeFileSync(to, fs.readFileSync(from, 'utf8')
      .replace(/src="api\/visibility"/g, `src="${LIVE}/api/visibility"`));
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
