# Adding a language library

This is the recipe as it stands today, taken from the Meru, Turkana and Teso
change (commit fc8e04e, PR #21). It touches about 15 files, including the same ISO code pasted into six inline
lists across `item.js`, `shared-library.js` and `packer/et/build.py`. The rebuild's
language registry (workstream W2) will shrink it to one registry entry, one
catalogue and the interface strings; this guide will be rewritten then.

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

| File | What to add |
|---|---|
| `app/<slug>/index.html` | Copy a sibling language page; set `window.ET_SHARED_LIBRARY` and the catalogue script tag. Keep the `api/visibility` and `visibility.js` tags right after the catalogue. |
| `app/assets/js/item.js` | The ISO code in three long inline `r.lang === …` lists (native titles, "spoken in" wording, the share text). |
| `app/assets/js/shared-library.js` | The ISO code in two inline `scope.lang === …` lists (page title, email wording). |
| `packer/et/build.py` | The ISO code in the inline tuple that keeps DBS's video labels. |
| `app/assets/js/share-libraries.js` | The route for Larry's "email one language" screen. |
| `app/assets/js/i18n.js` | Only if it gets its own interface language. |
| `app/sw.js` | The page and catalogue in the cache list, and bump `VERSION`. |
| `vercel.json` | The slug and every alias as rewrites. |
| `packer/analytics.py` | The slug in `QR_LIBRARIES` (a test checks it matches `share-libraries.js`). |
| `packer/library_mail.py` | The entry in `LIBRARIES` for "Email this library". |
| `art/og/cards.json` | Preview card words; then `node art/og/render.js` and `python3 packer/write_og_tags.py`. |

## 4. Test and document

1. Add or extend tests: `tests/test_dbs_audit.py` for the shelf, and
   `tests/test_sw.js` for the cache list.
2. Add the language's notes to `docs/TRANSLATION-HANDOFF.md`.
3. Run `npm test`. Everything must pass.
4. After deploy, open `https://www.bibletransfer123.org/<slug>` and one item.

## 5. Print materials

QR codes encode `https://bibletransfer123.org/<slug>?src=qr` so scans are
counted. Generate the new code with the same settings as the existing set
(error correction M, no border).
