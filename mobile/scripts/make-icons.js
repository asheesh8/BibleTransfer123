/* Draws the app icons and splash screens from Kandili himself: the same SVG
   (app/assets/js/brand/mascot.js) the app animates, so the splash hands off
   to the launch moment (features/launch.js) without a jump.

   Run from mobile/:  node scripts/make-icons.js
   Needs Playwright's Chromium (the repo's dev dependency), nothing else.

   Splash sizing is shared with features/launch.js, which redraws the same
   lantern on the same spot as the app opens:
   · Android: the lantern's box is SPLASH_DP dp tall, centred.
   · iPhone/iPad: the storyboard fills the screen with a 2732 px square
     (aspect fill), so the box is IOS_SHARE of the square's side. */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HERE = path.resolve(__dirname, '..');
const APP = path.resolve(HERE, '..', 'app');
const RES = path.join(HERE, 'android/app/src/main/res');
const IOS = path.join(HERE, 'ios/App/App/Assets.xcassets');

// docs/design/color.md: the splash page in light and dark, plum for the icon.
const LIGHT = '#FBF7F1', DARK = '#1A1316', PLUM = '#7A2C5E';
const SPLASH_DP = 190;                  // keep equal to SPLASH_DP in features/launch.js
const IOS_SHARE = 0.2;                  // keep equal to IOS_SHARE in features/launch.js
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// The ground every picture sits on: one flat colour, never a gradient, or
// nothing (Android's foreground layers).
const GROUND = { light: LIGHT, dark: DARK, plum: PLUM, none: 'transparent' };

const page0 = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${APP}/assets/css/tokens.css">
<link rel="stylesheet" href="${APP}/assets/css/components/mascot.css">
<style>html,body{margin:0;background:transparent}#s{position:fixed;inset:0;overflow:hidden}
#k{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}#k .et-kandili{width:100%}
#k.mono{filter:url(#mono)}#k:is(.mono,.icon) :is(.k-glowwrap,.k-shadow){display:none}</style>
<script src="${APP}/assets/js/core.js"></script><script src="${APP}/assets/js/brand/mascot.js"></script>
</head><body><div id="s"><div id="k"></div></div>
<svg width="0" height="0" style="position:absolute"><filter id="mono" color-interpolation-filters="sRGB">
<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .3 .59 .11 0 0"/>
<feComponentTransfer><feFuncA type="linear" slope="3" intercept="-.9"/></feComponentTransfer></filter></svg>
</body></html>`;

async function main() {
  const tmp = path.join(require('os').tmpdir(), 'kandili-icons.html');
  fs.writeFileSync(tmp, page0);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + tmp);

  // One picture: w x h px, the lantern's box h * share tall (or boxPx),
  // nudged down by dy of the picture's height.
  async function shot(file, w, h, o) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(([o, ground, h]) => {
      document.documentElement.setAttribute('data-motion', 'reduce');
      document.getElementById('s').style.background = ground;
      const k = document.getElementById('k');
      const box = o.boxPx || h * o.share;
      k.style.height = box + 'px';
      k.style.width = box * 320 / 340 + 'px';
      k.style.top = (50 + (o.dy || 0) * 100) + '%';
      k.innerHTML = window.ET.use('brand/mascot').markup(o.pose, { mood: 'still' });
      // Icons are flat: no glow behind him. On dark grounds his glow is brass.
      k.className = o.mono ? 'mono' : o.icon ? 'icon' : '';
      document.body.className = o.ground === 'dark' ? 'et-on-dark' : '';
    }, [o, GROUND[o.ground], h]);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: o.ground === 'none', clip: { x: 0, y: 0, width: w, height: h } });
  }

  // --- iPhone: one 1024 px icon, opaque, iOS rounds the corners itself.
  await shot(path.join(IOS, 'AppIcon.appiconset/AppIcon-512@2x.png'), 1024, 1024,
    { pose: 'neutral', ground: 'plum', share: .9, dy: .025, icon: true });

  // --- Android launcher: legacy square + round, then the adaptive layers
  // (108 dp; the mask shows the middle ~72 dp, the safe circle is 66 dp).
  for (const [name, d] of Object.entries(DENSITY)) {
    const dir = path.join(RES, 'mipmap-' + name), px = Math.round(48 * d), fg = Math.round(108 * d);
    await shot(path.join(dir, 'ic_launcher.png'), px, px, { pose: 'neutral', ground: 'plum', share: .9, dy: .025, icon: true });
    await shot(path.join(dir, 'ic_launcher_round.png'), px, px, { pose: 'neutral', ground: 'plum', share: .8, dy: .03, icon: true });
    await shot(path.join(dir, 'ic_launcher_foreground.png'), fg, fg, { pose: 'neutral', ground: 'none', share: .62, dy: .02, icon: true });
    await shot(path.join(dir, 'ic_launcher_background.png'), fg, fg, { pose: 'neutral', ground: 'plum', share: 0 });
    // Android 13 themed icon: one colour the system tints. Light parts stay,
    // the dark face lines become holes so the face still shows (#mono).
    await shot(path.join(dir, 'ic_launcher_monochrome.png'), fg, fg, { pose: 'neutral', ground: 'none', share: .62, dy: .02, mono: true });
    // Android 12+ splash icon: 288 dp, shown inside a 192 dp circle, on the
    // splash_ground colour (values/ and values-night/).
    for (const [night, ground] of [['', 'light'], ['-night', 'dark']]) {
      const side = Math.round(288 * d);
      await shot(path.join(RES, 'drawable' + night + '-' + name, 'splash_icon.png'), side, side,
        { pose: 'sleeping', ground, boxPx: SPLASH_DP * d });
    }
  }

  // --- Android before 12: splash.png in each drawable(-land|-port)-<dpi>
  // folder at its usual size, light and night, drawn at true scale.
  const SIZES = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
  for (const [night, ground] of [['', 'light'], ['-night', 'dark']]) {
    await shot(path.join(RES, 'drawable' + night, 'splash.png'), 480, 320, { pose: 'sleeping', ground, boxPx: SPLASH_DP });
    for (const [name, [w, h]] of Object.entries(SIZES)) {
      const box = { pose: 'sleeping', ground, boxPx: SPLASH_DP * DENSITY[name] };
      await shot(path.join(RES, 'drawable-port' + night + '-' + name, 'splash.png'), w, h, box);
      await shot(path.join(RES, 'drawable-land' + night + '-' + name, 'splash.png'), h, w, box);
    }
  }

  // --- iPhone/iPad splash: the 2732 px square the storyboard aspect-fills,
  // with a dark-appearance twin (Contents.json lists both).
  const SET = path.join(IOS, 'Splash.imageset');
  for (const f of fs.readdirSync(SET).filter((n) => n.endsWith('.png'))) fs.unlinkSync(path.join(SET, f));
  const images = [];
  for (const [look, ground] of [['', 'light'], ['-dark', 'dark']]) {
    // One file per scale (Xcode wants each listed file once).
    for (const scale of ['1x', '2x', '3x']) {
      const file = 'splash-2732' + look + '@' + scale + '.png';
      await shot(path.join(SET, file), 2732, 2732, { pose: 'sleeping', ground, share: IOS_SHARE });
      const img = { idiom: 'universal', filename: file, scale };
      if (look) img.appearances = [{ appearance: 'luminosity', value: 'dark' }];
      images.push(img);
    }
  }
  fs.writeFileSync(path.join(SET, 'Contents.json'), JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2) + '\n');

  await browser.close();
  fs.unlinkSync(tmp);
  console.log('icons and splash screens drawn from mascot.js');
}

main().catch((e) => { console.error(e); process.exit(1); });
