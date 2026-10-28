# 0004. Playwright for browser tests, dev only

Status: Proposed
Date: 2026-10-28

## Context

Tests today are Python `unittest` and `node --test`. They check catalogues,
strings and page wiring, but nothing opens a page in a browser. The rebuild
touches every screen, and the failures that matter most (a card that does not
open on `file://`, a page that breaks offline, a script loaded out of order)
only show up in a real browser.

## Decision

Use Playwright with Chromium for a small set of smoke tests under
`tests/e2e/`: open Home, a language page, an item and the save flow on
`file://`, on `packer/serve.py`, and offline as an installed PWA. Playwright is
a development tool only. Nothing from it is ever copied into `app/` or onto a
card.

## Consequences

- Running the browser tests needs Node and Playwright installed; the existing
  tests still run with Python and Node alone.
- The "no npm dependencies" rule is restated as "no runtime dependencies".
