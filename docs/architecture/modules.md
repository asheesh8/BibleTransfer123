# Module map

Every script in `app/assets/js/` and what it needs. The rebuild moves files
into `core/`, `ui/`, `features/` and `data/` one at a time; this table is
updated in the same pull request as each move.

## How a module is written

```js
/* data/bible-books: the standard book list, local book names, audio Bible URLs. */
window.ET.module('data/bible-books', ['core'], function (ET) {
  'use strict';
  // ...
  return { BOOKS: BOOKS, bookName: bookName, audioBibleUrl: audioBibleUrl };
});
```

- `ET.module(name, deps, factory)` runs `factory` with the named modules and
  stores what it returns. A dependency that is not loaded yet, or a name used
  twice, throws an error that names the module and says to check the page's
  `<script>` order.
- `ET.use(name)` returns a loaded module.
- `core.js` registers itself as `core` and is the first ET script on every page.
- Pages still load modules with plain `<script defer>` tags, in dependency
  order ([decision 0002](../decisions/0002-no-bundler.md)).
- Older files are wrapped in `(function (ET) { … })(window.ET)` and attach to
  `ET` directly. They move to `ET.module` when they are split.

## Modules

| File | Module | Needs | Loaded by |
|---|---|---|---|
| `core.js` | `core` | catalogue, `visibility.js` | every page |
| `ui/shell.js` | `ui/shell` (also `ET.header`, `ET.tabbar`, `ET.icon`, `ET.sheet`, `ET.stepper`, `ET.toast`, `ET.lantern`, `ET.loadMascot`, `ET.facebookShare`) | `core` | every page that loads `core.js`, right after it |
| `ui/covers.js` | `ui/covers` (also `ET.row`, `ET.poster`, `ET.thumb`, `ET.typeIcon`) | `core` | pages that list items: `index.html`, `library.html`, `item.html`, language pages |
| `data/bible-books.js` | `data/bible-books` | `core` | `item.html` |
| `ui/icons.js` | `ui/icons` (also `ET.ui.icon`) | `core` | `styleguide.html` |
| `ui/sheet.js` | `ui/sheet` (also `ET.ui.sheet`) | `core`, `ui/icons` | `styleguide.html` |
| `ui/toast.js` | `ui/toast` (also `ET.ui.toast`) | `core`, `ui/icons` | `styleguide.html` |
| `brand/mascot.js` | `brand/mascot` (also `ET.mascot`) | `core` | `styleguide.html`; fetched by `ET.loadMascot()` on app pages |
| `features/styleguide.js` | `features/styleguide` | `core`, the four above | `styleguide.html` |
| `i18n-load.js` | none (plain sync script) | nothing | every page, right before `i18n.js` |
| `i18n/<code>.js` | `window.ET_STRINGS[code]` (data) | nothing | `en.js` always, plus the reader's language; others load on demand |
| `i18n.js` | `ET.i18n` (legacy) | `core`, `i18n/en.js` | every page |
| `analytics.js` | `ET.analytics` (legacy) | `core`, `i18n` | every page |
| `visibility.js` | `window.ET_VISIBILITY` | catalogue, `api/visibility` | every library page |
| `art.js` | legacy | `core` | library pages |
| `home.js` | legacy | `core`, `i18n` | `index.html` |
| `library.js` | legacy | `core`, `i18n`, `save.js` | `library.html`, language pages |
| `shared-library.js` | legacy | `core`, `i18n` | language pages |
| `item.js` | legacy | `core`, `i18n`, `save.js`, `data/bible-books` | `item.html` |
| `save.js` | `ET.save` (legacy) | `core`, `i18n` | library, item, nearby pages |
| `share.js` | legacy | `core`, `i18n` | `share.html` |
| `nearby.js` | legacy | `core`, `i18n`, `save.js`, `vendor/peerjs.min.js`, `vendor/qrcode.js` | `nearby.html` |
| `help.js` | legacy | `core`, `i18n` | `help.html` |
| `save-guide.js` | legacy | `core`, `i18n` | `save-guide.html` |
| `share-libraries.js` | legacy | `core`, `i18n` | `share-libraries/` |
| `admin*.js` | legacy | `core` | `admin/` |

## What core.js keeps

Since the core split (October 2026) `core.js` holds only what has no look of
its own: the registry, storage, `esc`/`qs`/`$`/`$$`/`human`/`pad`, the
shared-library scope (`libraryScope`, `scopedUrl`, `scopeEntryUrl`), theme,
the catalogue (`library`, `byId`), content language and `displayTitle`,
file safety (`safeType`, `openable`, `safeUrl`) and the offline install.
Anything that draws goes in a `ui/` module. A test keeps `core.js` under 400
lines.

`ui/shell.js` and `ui/covers.js` set their old `ET.*` names so no screen had
to change when they moved. As screens move onto the design kit, they call
`ET.ui.sheet`, `ET.ui.toast` and `ET.ui.icon` instead, and the shell's
versions retire.

Tests: `tests/test_modules.js` checks the registry, the book data, the
item page's script order, the old names, and that every page loads
`ui/shell.js` and `ui/covers.js` when its scripts call them.
