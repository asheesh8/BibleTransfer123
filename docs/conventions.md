# Conventions

Rules that keep the codebase readable as it grows. When a rule here and the
code disagree, fix one of them in the same pull request.

## Files and names

- One module per file, one job per module. A file past about 400 lines is a
  sign it holds two jobs.
- Data is not code. Tables of names, strings or settings live in data files
  (`app/data/`, `catalog/`), not inside a script.
- File names are lowercase with hyphens: `save-guide.js`, `share-libraries.js`.
- CSS classes for shared components are prefixed `et-`: `et-row`, `et-sheet`.
- Language codes follow ISO 639-3 for content (`swh`, `luy`) and the interface
  code in `LANGS` in `i18n.js` (and the file name in `i18n/`) for the interface.

## Every script file

- Starts with a short header comment: what the module does, what it depends on,
  and anything surprising (for example, why it avoids `fetch`).
- Is a classic script wrapped in a function, attached to the global `ET`. No
  ES modules: they do not load from `file://`. See
  [decision 0002](decisions/0002-no-bundler.md).
- Reads storage through `ET`'s storage helper, never `localStorage` directly:
  Safari blocks it on `file://` and private mode throws on write.

## Interface

- Touch targets at least 56 px. Icon plus word on every action.
- Verbs are Play, Save and Share. Plain words for a slow reader.
- Every string goes through i18n with an English fallback. Never hard-code
  visible text in a script.
- Test right-to-left (Urdu or Arabic) and a non-Latin script (Amharic or
  Hindi) for every layout change.
- Honour `prefers-reduced-motion`.

## Shipping a change

1. `npm test` passes.
2. Run `npm run generate` after changing a file the service worker caches or
   `registry/languages.json`. It sets `VERSION` in `app/sw.js` from the
   shell's contents and rewrites the generated language files;
   `tests/test_generate.py` fails if you forget.
3. Docs that describe the changed behaviour are updated in the same pull
   request.
4. Merge to `main` once tests pass, then check the live site.

## Commits and pull requests

- Subject line says what changed for a user or a maintainer, in the
  imperative: "Add Meru, Turkana and Teso DBS libraries".
- The body says why, and anything a reviewer would not see from the diff.
