# Adding a screen

A screen is one HTML page and one script that draws it. Follow these steps
and the tests tell you if you missed one.

1. **The page.** Copy the `<head>` and the script list from a page close to
   yours, such as `help.html`. Keep the order: catalogue, `visibility.js`,
   `core.js`, `ui/icons.js`, `ui/sheet.js`, `ui/toast.js`, `ui/shell.js`,
   then `ui/covers.js` if the screen lists items, then `i18n-load.js`
   (without `defer`), `i18n.js`, `analytics.js`, and your script last.
   Keep the stylesheets too: `tokens.css`, `app.css`,
   `components/sheet.css`, `components/toast.css`.
2. **The script.** Register it under its file name and name what it needs:

   ```js
   /* My screen: what it shows and who reaches it. */
   window.ET.module('my-screen', ['core', 'ui/shell', 'i18n'], function (ET) {
     'use strict';
     var t = ET.i18n.t, h = ET.i18n.h;
     ET.header('my-screen.html');
     ET.tabbar('my-screen.html');
     // draw into <main>; use ET.sheet(html, { title }) for a sheet and
     // ET.toast(text) for a confirmation
     ET.i18n.apply();
     ET.i18n.onChange(render);
   });
   ```

3. **Words.** Every string goes through `t()` or `h()`. Add the keys to
   `app/assets/js/i18n/en.js`; other languages fall back to English until
   translated (see `docs/TRANSLATION-HANDOFF.md`).
4. **Offline.** Add the page and its script to `SHELL` in `app/sw.js`, then
   run `npm run generate` so `VERSION` changes and installed copies update.
5. **Docs.** Add a row to `docs/architecture/modules.md`.
6. **Check.** Run `npm test`, then open the page from `file://` and over
   `npm run dev`. `tests/test_modules.js` fails if the page loads a module
   before something it needs, and `tests/test_generate.py` fails if
   `VERSION` is stale.

Rules that never bend are in [the architecture overview](../architecture/overview.md):
no ES modules, no `fetch` of local files, no build step.
