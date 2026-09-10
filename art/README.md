# Artwork

## What the app uses today

Hand-drawn inline SVG, in `app/assets/js/art.js`:

| | Where |
|---|---|
| `ET.art.home()` | the lantern mascot, its light, and a film / book / recording |
| `ET.art.share()` | light crossing from one phone to another |
| `ET.art.empty()` | the lantern searching, and not finding |
| `ET.art.lanternBody()` | the mascot alone, used in the header |

The whole set is about 4 KB, follows light and dark through the stylesheet's own
custom properties, and stays sharp from a 4-inch phone to a projector.

## Why it is not generated art

It was meant to be. Higgsfield **requires a paid plan** and this account is on
the free tier with 1.6 credits, so no generation was possible — that is the only
reason, not a design preference.

That said, for this particular app SVG is arguably the better answer regardless:

- **Weight.** The set is 4 KB. A comparable raster set is 2–4 MB, on a card where
  a megabyte is a chapter of something that did not fit.
- **Theme.** One drawing serves light and dark. Raster art needs two of each.
- **Sharpness.** No resolution to pick, on devices from a cracked 4-inch screen
  to a wall projection.

Generated art is still worth having for anything the SVG set cannot carry — a
warm illustrated welcome screen, or per-category cover art for the shelves.

## If you top up and want to generate

The direction is a friendly lantern — نور, "light" — in flat vector, gold and
deep purple on cream, rounded and chunky, in the register of a language-learning
app's mascot. Prompt that produced nothing here only because the plan blocked it:

> Flat vector mascot illustration of a friendly glowing oil lantern character.
> Simple round black dot eyes, small warm smile, soft rounded chunky shapes,
> thick clean outlines, no gradients. Warm gold and deep purple palette on a
> plain cream background. Cheerful, welcoming, child-friendly app mascot in the
> style of a modern language-learning app. Centered, generous margins, flat 2D,
> no text, no letters.

Palette to hold it to: gold `#E8A317`, gold deep `#B87D06`, purple `#6B2E86`,
purple deep `#4E1F64`, cream `#FFFBF2`, ink `#2A1B33`.

**Two rules for anything generated.** Save it into `app/assets/art/` so it ships
on the card — nothing may load from a network at runtime. And keep each file
under about 150 KB; a card's space belongs to Scripture and film before it
belongs to decoration.
