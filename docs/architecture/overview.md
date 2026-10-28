# Architecture overview

EasyTransfer is one static app folder (`app/`) that ships unchanged to four
places, plus a Python toolchain that fills it with catalogues and packs it onto
cards.

```
                 catalog/*.json  (audited DBS and partner inventories)
                        |
                 packer/  (Python 3, standard library only)
                        |  writes app/data/catalog-*.js
                        v
   app/   HTML + CSS + classic scripts on a global ET, no build step
     |
     +-- Web:       Vercel serves app/ as the site root; api/*.py functions
     +-- Pi / LAN:  packer/serve.py (byte ranges, Nearby signalling, the API)
     +-- microSD:   opened straight off the card on file://
     +-- PWA:       installed from the web; app/sw.js caches the shell
```

## The constraints that shape everything

These are hard rules. A change that breaks one breaks a card that is already
in someone's hands.

| Rule | Why | Consequence for code |
|---|---|---|
| Runs on `file://` off a microSD card | Most users have no internet | Classic `<script>` tags only. No ES modules, no `fetch` of local files. Data ships as `.js` files that set a global (`window.LIBRARY`). |
| No runtime dependencies, nothing from a CDN | Offline, and nothing can disappear upstream | Third-party code is vendored (`app/assets/vendor/peerjs.min.js`). |
| No bundler or compile step | What is in the repo is what runs; anyone can fix a card with a text editor | Source files are the shipped files. See [decision 0002](../decisions/0002-no-bundler.md). |
| Same app on web, Pi, card and PWA | One codebase to test | Feature-detect (`location.protocol`, service worker support), never fork the code. |
| Service worker caches the shell, never media | A card holds tens of GB | `VERSION` in `app/sw.js` is a hash of the shell, set by `npm run build`; without a new one installed copies keep the old page. |
| Built for a shared, cracked phone outdoors | Our users | 56 px touch targets, icon plus word, Play / Save / Share verbs, RTL-aware, no pinch zoom. |
| Every public URL keeps working | 57 language links and printed QR codes are in circulation | Slugs and aliases in `vercel.json` are never removed, only added. |

## The front end today

| Layer | Files | Notes |
|---|---|---|
| Pages | `app/*.html`, `app/<slug>/index.html` (57 language pages) | Each page lists its own scripts in load order. |
| Shared code | `app/assets/js/core.js` | Module registry, storage, icons, DOM helpers, header, tab bar, rows, covers, sheets, install and share helpers (about 670 lines). |
| Book data | `app/assets/js/data/bible-books.js` | Standard book list, local book names, audio Bible URLs. Loaded only by `item.html`. |
| Interface text | `app/assets/js/i18n/<code>.js`, `i18n-load.js`, `i18n.js` | One strings file per language (14 to 64 KB). `i18n-load.js` writes the tags for English and the reader's language; `i18n.js` (about 45 KB) is the runtime plus the welcome screen's every-language lines. Another language loads when the reader switches. |
| Screens | `home.js`, `library.js`, `item.js`, `save.js`, `share.js`, `nearby.js`, `help.js`, `save-guide.js`, `admin*.js` | One file per screen. |
| Styles | `app/assets/css/app.css` and four smaller sheets | Colour, radius and touch-size tokens on `:root`, light and dark. |

## The front end after the rebuild

Four layers, each allowed to call only the layers below it:

1. **Page shells**: thin HTML; script lists and language pages generated.
2. **Features**: one module per screen (home, library, player, save, share,
   nearby, help, admin).
3. **UI components and mascot**: header, tab bar, row, poster, sheet, toast,
   stepper, `ET.mascot`. They take data and return markup.
4. **Core**: module registry, storage, DOM, events, i18n runtime, scope, theme,
   service worker. Knows nothing about Bibles or screens.

Data (catalogues, interface strings, book names) sits beside the layers as
one file per language. One registry, `registry/languages.json`, is the
single list that language pages, `sw.js`, rewrites and the QR list are
generated from (`npm run build`; see the
[adding a language guide](../guides/adding-a-language.md)).
[modules.md](modules.md) lists every module and what it
needs. The full plan, with workstreams, is in the rebuild plan doc
linked from [decision 0001](../decisions/0001-rebuild-scope.md).

## Server side

- `api/*.py`: Vercel functions (analytics, admin, QR counter, visibility
  switches, email). Thin wrappers over `packer/`.
- `packer/analytics.py`: consent-gated analytics and admin auth, shared by
  Vercel and `serve.py`. Storage is Upstash Redis in production, SQLite locally.
- `packer/serve.py`: the Pi and local server.

The rebuild keeps all of this (decision 0001).
