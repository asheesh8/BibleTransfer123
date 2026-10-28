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
- Older code still sets names like `ET.i18n` and `ET.save` directly, and
  screens call those names. New code can use `ET.use('save')` instead.

## Modules

Every file below registers with `ET.module` under its own path, except
the four marked "not a module": `core.js` creates the registry,
`i18n-load.js` must run synchronously before anything else, and
`visibility.js` and the admin scripts also run on pages without the app.
`tests/test_modules.js` checks both rules and, on every page, that each
module's dependencies load earlier.

| File | Module (and the old name it sets) | Needs | Loaded by |
|---|---|---|---|
| `core.js` | `core` (`window.ET`) | catalogue, `visibility.js` | every page, first |
| `ui/icons.js` | `ui/icons` (`ET.ui.icon`) | `core` | every page |
| `ui/sheet.js` | `ui/sheet` (`ET.ui.sheet`) | `core`, `ui/icons` | every page |
| `ui/toast.js` | `ui/toast` (`ET.ui.toast`) | `core`, `ui/icons` | every page |
| `ui/shell.js` | `ui/shell` (`ET.header`, `ET.tabbar`, `ET.icon`, `ET.sheet`, `ET.toast`, `ET.stepper`, `ET.lantern`, `ET.loadMascot`, `ET.facebookShare`) | `core`, `ui/icons`, `ui/sheet`, `ui/toast` | every page |
| `ui/covers.js` | `ui/covers` (`ET.row`, `ET.poster`, `ET.thumb`, `ET.typeIcon`) | `core` | pages that list items: `index.html`, `library.html`, `item.html`, language pages |
| `brand/mascot.js` | `brand/mascot` (`ET.mascot`) | `core` | `styleguide.html`; fetched by `ET.loadMascot()` elsewhere |
| `data/bible-books.js` | `data/bible-books` (`ET.BOOKS`, `ET.bookName`) | `core` | `item.html` |
| `data/onboarding-strings.js` | `data/onboarding-strings` | `core` | fetched by the first-run welcome |
| `features/onboarding.js` | `features/onboarding` (`ET.onboarding`) | `core`, `data/onboarding-strings` | fetched by the first-run welcome |
| `features/styleguide.js` | `features/styleguide` | `core`, `ui/icons`, `brand/mascot`, `ui/sheet`, `ui/toast` | `styleguide.html` |
| `i18n/<code>.js` | data on `window.ET_STRINGS[code]` | nothing | `en.js` always, plus the reader's language; others on demand |
| `i18n.js` | `i18n` (`ET.i18n`) | `core` | every page |
| `analytics.js` | `analytics` (`ET.analytics`) | `core`, `i18n` | every page |
| `art.js` | `art` (`ET.art`) | `core` | `library.html`, `share.html`, language pages |
| `save.js` | `save` (`ET.save`) | `core`, `ui/shell`, `i18n` | library, item, nearby pages |
| `home.js` | `home` | `core`, `ui/shell`, `ui/covers`, `i18n` | `index.html` |
| `library.js` | `library` | `core`, `ui/shell`, `ui/covers`, `i18n`, `save` | `library.html`, language pages |
| `shared-library.js` | `shared-library` | `core`, `ui/shell`, `i18n` | language pages |
| `item.js` | `item` | `core`, `ui/shell`, `ui/covers`, `i18n`, `save`, `data/bible-books` | `item.html` |
| `share.js` | `share` | `core`, `ui/shell`, `i18n` | `share.html` |
| `nearby.js` | `nearby` (`ET.nearby`) | `core`, `ui/shell`, `i18n`, `save`; `vendor/peerjs.min.js`, `vendor/qrcode.js` | `nearby.html` |
| `help.js` | `help` | `core`, `ui/shell`, `i18n` | `help.html` |
| `save-guide.js` | `save-guide` | `core`, `i18n` | `save-guide.html` |
| `share-libraries.js` | `share-libraries` | `core`, `ui/shell`, `i18n` | `share-libraries/` |
| `i18n-load.js` | not a module (sync, writes the string tags) | nothing | every page, right before `i18n.js` |
| `visibility.js` | not a module (`window.ET_VISIBILITY`) | catalogue, `api/visibility` | library pages, `admin/library.html` |
| `admin*.js` | not a module | catalogue | `admin/` |

Screen scripts still live at the top of `assets/js/`. Moving them into
`features/` is a rename for later, when fewer threads are editing them.

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
