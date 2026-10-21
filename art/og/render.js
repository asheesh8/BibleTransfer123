/* Makes the link-preview picture for every library page: app/assets/og/<slug>.jpg
   (1200×630), which the page's og:image tag points to.

     node art/og/render.js            # every page
     node art/og/render.js hausa luo  # just these
     ORIGIN=https://www.bibletransfer123.org node art/og/render.js  # screenshots of the live site

   Needs Playwright (npm i -g playwright) and the Noto fonts for each script.
   It serves app/ itself, opens each language page like a phone, screenshots it
   and lays that screenshot into card.html with the page's own words. After a
   run, bump the ?v= in packer/write_og_tags.py and run it so Facebook fetches
   the new pictures. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const APP = path.resolve(__dirname, '../../app');
const OUT = path.join(APP, 'assets/og');
const HOST = 'bibletransfer123.org';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/json' };

function pages() {
  return fs.readdirSync(APP).filter(slug => {
    const file = path.join(APP, slug, 'index.html');
    return fs.existsSync(file) && /window\.ET_SHARED_LIBRARY/.test(fs.readFileSync(file, 'utf8'));
  }).sort();
}

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let file = path.join(APP, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(APP)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const only = process.argv.slice(2);
  const slugs = only.length ? only.filter(slug => slug !== 'home') : pages();
  // The words each page's og: tags carry, in the page's own language;
  // packer/write_og_tags.py writes them into the pages.
  const CARDS = path.join(__dirname, 'cards.json');
  const cards = fs.existsSync(CARDS) ? JSON.parse(fs.readFileSync(CARDS, 'utf8')) : {};
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  // ORIGIN=https://www.bibletransfer123.org screenshots the live pages (with the
  // live library switches) instead of this checkout.
  const local = 'http://127.0.0.1:' + server.address().port;
  const origin = process.env.ORIGIN || local;
  // Behind an HTTPS proxy, covers still load through it but this server is reached directly.
  const args = process.env.HTTPS_PROXY
    ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=<-loopback>;127.0.0.1;localhost'] : [];
  const browser = await playwright.chromium.launch({ args });
  const phone = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => {
    localStorage.setItem('et.consent', JSON.stringify({ version: 0, analytics: false, at: Date.now() }));
  });
  const site = await phone.newPage();
  const words = await phone.newPage();
  await words.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const card = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
  for (const slug of slugs) {
    await site.goto(origin + '/' + slug + '/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await site.evaluate(() => {
      for (const id of ['et-consent', 'et-welcome', 'et-cookie-settings']) {
        const el = document.getElementById(id); if (el) el.remove();
      }
      // The picture shows the library itself: the films and books, not the share buttons.
      document.querySelectorAll('.shared-actions, .send-library').forEach(el => el.remove());
      const hero = document.querySelector('.shared-hero');
      for (let el = hero && hero.nextElementSibling; el && el.id !== 'count'; el = el.nextElementSibling) el.style.display = 'none';
    });
    await site.waitForTimeout(1500);
    const shot = 'data:image/png;base64,' + (await site.screenshot()).toString('base64');
    const data = await site.evaluate(() => {
      const t = window.ET.i18n.t, scope = window.ET_SHARED_LIBRARY;
      const native = scope.native || scope.name;
      return { native, lang: window.ET.i18n.current(),
        title: document.getElementById('shared-title').textContent.trim(),

        labels: [t('type.film'), t('type.audio'), t('type.scripture')],
        lantern: (document.querySelector('.brand svg') || {}).outerHTML || '', brand: t('app.name') };
    });
    data.url = HOST + '/' + slug;
    data.shot = shot;
    await card.goto('file://' + path.join(__dirname, 'card.html'));
    await card.evaluate(d => { document.getElementById('brand').textContent = d.brand; return window.render(d); }, data);
    await card.waitForTimeout(150);
    await card.screenshot({ path: path.join(OUT, slug + '.jpg'), type: 'jpeg', quality: 84 });
    // The description always comes from this checkout's wording, even when the
    // screenshot came from the live site.
    await words.goto(local + '/' + slug + '/', { waitUntil: 'load' });
    data.description = await words.evaluate(() => {
      const scope = window.ET_SHARED_LIBRARY;
      return window.ET.i18n.t('fbshare.post', { lang: scope.native || scope.name })
        .replace(/\s*\p{Extended_Pictographic}\s*/gu, ' ').trim();
    });
    cards[slug] = { title: data.title, description: data.description };
    console.log('og', slug);
  }
  // The home card: the whole library, each language in its own words.
  if (!only.length || only.includes('home')) {
    await site.goto(origin + '/index.html', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    const names = pages().map(slug => {
      const m = fs.readFileSync(path.join(APP, slug, 'index.html'), 'utf8').match(/"native":"([^"]*)"/);
      return m ? JSON.parse('"' + m[1] + '"') : slug;
    }).filter((name, i, all) => all.indexOf(name) === i && name.length < 16);
    const lantern = await site.evaluate(() => (document.querySelector('.brand svg') || {}).outerHTML || '');
    await card.goto('file://' + path.join(__dirname, 'card.html'));
    await card.evaluate(d => window.render(d), {
      native: 'Free Bible library', title: 'Films, audio Bibles and Scripture in 40+ languages',
      labels: ['Films', 'Audio', 'Scripture'], url: HOST, lantern, lang: 'en', home: names
    });
    await card.waitForTimeout(150);
    await card.screenshot({ path: path.join(OUT, 'home.jpg'), type: 'jpeg', quality: 84 });
    cards.home = { title: 'The Library: free Bible films, audio and Scripture',
      description: 'Films, audio Bibles and Scripture in 40+ languages. Watch, listen and read on any phone, then pass it on.' };
    console.log('og home');
  }
  const sorted = {};
  Object.keys(cards).sort().forEach(slug => { sorted[slug] = cards[slug]; });
  fs.writeFileSync(CARDS, JSON.stringify(sorted, null, 1) + '\n');
  await browser.close(); server.close();
})();
