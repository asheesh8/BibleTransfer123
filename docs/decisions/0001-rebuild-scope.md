# 0001. Rebuild the front end, keep the engine

Status: Accepted (2026-10-28, Ashish)
Date: 2026-10-28

## Context

The app is heading into a board funding meeting and needs a cleaner, modular
codebase, a proper design system and an animated mascot. The engine behind it
works and is tested: language catalogues, the card packer, the Pi server,
analytics, the visibility switches and phone-to-phone Nearby. The pain is in
the front end: `core.js` is 2,155 lines, `i18n.js` loads all 38 interface
languages (1.5 MB) on every page, and adding one language touches about 15
files. Fifty-seven language links and printed QR codes are already in
circulation.

Three options were weighed: rebuild only the front end, rewrite everything
including the Python packer and server, or tidy in place with no new look.

## Decision

Rebuild the front end from the ground up on a new modular structure with a new
design system and mascot, and keep the engine. Move screens over one at a time
behind the same URLs, so the site, the cards and the QR codes keep working
after every merge.

## Consequences

- Every public URL, catalogue format and API stays as it is.
- The Python packer is cleaned up (per-language builders folded into data)
  only where it produces the same catalogues byte for byte.
- Work is split into 14 workstreams across 5 phases; the plan is in the
  project's rebuild plan doc
  (https://claude.ai/artifact/91yMom5T3NiyyhLKqbpUwR).
