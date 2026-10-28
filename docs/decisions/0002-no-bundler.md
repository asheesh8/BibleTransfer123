# 0002. Modular classic scripts, no bundler

Status: Proposed
Date: 2026-10-28

## Context

A modular codebase usually means ES modules and a bundler. Neither fits here:
browsers refuse ES modules loaded from `file://`, which is how a microSD card
opens, so any bundler would have to output classic scripts anyway. A bundler
also brings npm dependencies and a compile step before every test, which the
project has avoided so that anyone can fix a card with a text editor.

What the project does need is real module boundaries, and an end to
hand-maintaining the same list of languages in seven places.

## Decision

- Keep shipping source files as they are written. No bundler, no transpiler.
- Each JavaScript file registers one module with a small registry on `ET`
  (about 30 lines) and names its dependencies:

  ```js
  ET.module('ui/sheet', ['core/dom', 'i18n'], function (dom, i18n) {
    return { open: open };
  });
  ```

  The registry resolves modules in page load order and throws a clear error
  when one is missing.
- Allow one Python step, `npm run build`, that only generates repetitive files
  from `registry/languages.json`: the language pages, the `sw.js` cache list and
  `VERSION`, `vercel.json` rewrites, the share list and the analytics QR list.
  A test fails when a generated file is out of date, so forgetting the step
  cannot ship.

## Consequences

- No new dependencies; Python 3 and a browser remain the whole toolchain.
- No tree shaking or minification. Mitigated by splitting interface strings
  per language, which cuts the largest file from 926 KB to about 25 KB a page.
- Page script order matters and is enforced by a test rather than by imports.
