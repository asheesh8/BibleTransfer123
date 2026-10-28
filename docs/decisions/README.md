# Decision records

One file per architectural decision, numbered in order. Each says what was
decided, why, and what it costs. Status is one of Proposed, Accepted,
Superseded by NNNN.

Never rewrite an accepted record to change its meaning. Write a new one that
supersedes it, and update the old one's status line only.

| # | Decision | Status |
|---|---|---|
| [0001](0001-rebuild-scope.md) | Rebuild the front end, keep the engine | Accepted |
| [0002](0002-no-bundler.md) | Modular classic scripts, no bundler | Accepted |
| [0003](0003-mascot-cutout-svg.md) | Animate the mascot as cut-out SVG parts | Accepted |
| [0004](0004-playwright-dev-only.md) | Playwright for browser tests, dev only | Accepted |

Template for a new record:

```
# NNNN. Title in a few words

Status: Proposed | Accepted (YYYY-MM-DD, by whom) | Superseded by NNNN
Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```
