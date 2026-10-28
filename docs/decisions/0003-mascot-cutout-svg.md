# 0003. Animate the mascot as cut-out SVG parts

Status: Accepted (2026-10-28, Ashish)
Date: 2026-10-28

## Context

The brand gets a lantern mascot in a flat 2D style, animated the way
Duolingo's bird is: bobbing, waving, cheering, flying. The art will be
generated as images, then cleaned up. Duolingo uses Rive; Lottie is the other
common choice. Both need a runtime of roughly 150 to 250 KB and vector files
authored in their own editors, and Rive's WebAssembly runtime is awkward to
load from `file://`. Generated images also drift from pose to pose, so drawing
each pose separately gives an inconsistent character.

## Decision

- Make one master character sheet, trace it into clean SVG, and split it into
  parts: body, flame, eyes, mouth, arms, handle.
- Animate the parts with CSS keyframes and the Web Animations API, using only
  `transform` and `opacity` so it stays smooth on low-end Android phones.
- Expose a small `ET.mascot` API with named moods: idle, wave, cheer, fly,
  think, sad, sleep. Features call moods; they never animate parts directly.
- With `prefers-reduced-motion`, show a still pose and never loop.

## Consequences

- Nothing new to ship or load; works on web, Pi, card and PWA alike.
- Each mascot SVG stays under 30 KB.
- Motion is limited to what rigid parts can do (squash, bob, swing, twirl).
  If a hired animator later wants richer motion, Rive is the upgrade path and
  gets its own decision record.
