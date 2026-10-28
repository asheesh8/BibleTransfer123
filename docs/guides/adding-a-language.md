# Adding a language library

Every language library is one entry in `registry/languages.json`. The generator
`packer/et/generate.py` (run it with `npm run build`) turns that list into the
files that used to be edited by hand:

| Generated file | What it gets from the registry |
|---|---|
| `app/<slug>/index.html` | The whole page: language, direction, titles, hero text, catalogue tag, preview card. |
| `app/<stub>/index.html` | A redirect page for an old folder name (for example `kisii` to `gusii`). |
| `app/sw.js` | The language block of `SHELL` (page plus catalogue) and `VERSION`. |
| `vercel.json` | One rewrite per slug, alias and stub, and the slug list in the `?src=qr` redirect. |
| `app/assets/js/share-libraries.js` | The `routes` list on Larry's "email one language" screen. |
| `packer/analytics.py` | `QR_LIBRARIES`. |
| `packer/library_mail.py` | `LIBRARIES` for "Email this library". |

`tests/test_generate.py` fails while any of these is out of date, so a
forgotten build cannot ship. Never edit a generated file by hand; the next
build puts it back.

`VERSION` in `sw.js` is a hash of every file the shell caches, so **any** change
to a shell file (a script, a stylesheet, a catalogue) needs `npm run build`
before commit. That replaces bumping `shell-vNN` by hand. Non-language entries
in `SHELL` and non-language rewrites in `vercel.json` (`/admin`, `/privacy`...)
stay hand-written; the generator keeps them.

The path below is for a language whose content is all hosted by the Digital
Bible Society (DBS) and built by the shared builder. Languages with partner
content or their own builder (English, French, Arabic, Spanish and others)
follow the same list but have a `packer/build_<name>.py` of their own.

## 1. Audit the DBS pages

DBS blocks plain HTTP clients, so its pages are rendered in a headless browser.
Save the audit as `catalog/source/dbs-audit-<language>-<date>.json`: the
rendered page, every film record, every audio Bible's books and chapters, and
a ranged check of every file. Only files that check as real media are carried.

## 2. Build the shelf

1. Add the language to `LANGS` in `packer/build_dbs_audit.py` (ISO code, slug,
   names, interface language, audit date). Kenyan languages without a
   reviewable interface translation use `ui: 'swh'`.
2. Run `python3 packer/build_dbs_audit.py <iso>`. It writes `catalog/<name>.json`.
3. If the build needs a new rule, add it to `packer/et/curation.py`, never as
   a one-off in the generated JSON.
4. Run `npm run dbs:import` to regenerate every `app/data/catalog-*.js`.

## 3. Wire it into the app

1. Add an entry to `languages` in `registry/languages.json`. The order there
   is the order of the share list and the QR redirect.
2. Add its preview card words to `art/og/cards.json`, then run
   `node art/og/render.js` for the picture. The page reads the words from there.
3. Run `npm run build` and commit the registry together with what it wrote.

Registry fields:

| Field | Required | Meaning |
|---|---|---|
| `slug` | yes | URL and folder: `/<slug>`, `app/<slug>/index.html`. Never rename or remove one; printed QR codes use it. |
| `lang` | yes | ISO 639-3 code of the content. Also the catalogue, `app/data/catalog-<lang>.js`. |
| `ui` | yes | Interface language code in `i18n.js`. Kenyan languages without a reviewed translation use `swh`. |
| `name`, `native` | yes | English and own-language names (page data, emails, share list). |
| `htmlLang` | yes | The page's `<html lang>`, usually the BCP 47 code of the interface. |
| `dir` | no | `rtl` for Arabic-script pages; omit for `ltr`. |
| `aliases` | yes | Extra URL paths that open the page (`/hau`, `/ha`). Add, never remove. |
| `stubs` | no | Old folder names that get a redirect page as well as a rewrite, so they also work off a card. |
| `title`, `description` | yes | `<title>` and the meta description. |
| `heading` | no | The hero heading when it differs from `title`. |
| `badge`, `lead` | yes | Hero eyebrow and lead line. |
| `pageText` | no | Which `pageText` set fills the search, filter and empty-state text before scripts run. Defaults to `ui`; a new interface language adds a set. |
| `catalog` | no | Catalogue code when the page shares another language's shelf (Tiriki uses `ida`). |
| `shareName` | no | Name in the share list when it differs from `name`. |
| `reloadGuard` | no | `i18n` for a newly added interface language: reloads an installed copy once its worker can serve the new strings. |

These still need the ISO code by hand until the screens are split up:

| File | What to add |
|---|---|
| `app/assets/js/item.js` | The ISO code in three long inline `r.lang === …` lists (native titles, "spoken in" wording, the share text). |
| `app/assets/js/shared-library.js` | The ISO code in two inline `scope.lang === …` lists (page title, email wording). |
| `packer/et/build.py` | The ISO code in the inline tuple that keeps DBS's video labels. |
| `app/assets/js/i18n/<code>.js` and `i18n.js` | Only if it gets its own interface language: a new strings file, a `LANGS` entry, and its lines in `SAY`. |

## 4. Test and document

1. Add or extend tests: `tests/test_dbs_audit.py` for the shelf. The cache
   list, rewrites and share lists are checked by `tests/test_generate.py`.
2. Add the language's notes to `docs/TRANSLATION-HANDOFF.md`.
3. Run `npm test`. Everything must pass.
4. After deploy, open `https://www.bibletransfer123.org/<slug>` and one item.

## 5. Print materials

QR codes encode `https://bibletransfer123.org/<slug>?src=qr` so scans are
counted. Generate the new code with the same settings as the existing set
(error correction M, no border).
