# Design system

The kit every rebuilt screen is made from: tokens, components, motion and
Kandili the lantern. See it all live, in light and dark, left-to-right and
right-to-left, at **`/styleguide.html`** (it also opens straight off a card).

- [Who we design for](#who-we-design-for)
- [Files](#files)
- [Tokens](#tokens)
- [Components](#components)
- [Motion](#motion)
- [Kandili, the mascot](#kandili-the-mascot)
- [Adding or changing a component](#adding-or-changing-a-component)
- [Using the kit on a page](#using-the-kit-on-a-page)

## Who we design for

Someone on a shared, cracked Android phone, outdoors, reading slowly, maybe in
their second language, maybe with no signal. Every rule comes from them:

| Rule | Why |
|---|---|
| Touch targets 56 px (48 px floor in dense rows; text links padded to 48 px) | A thumb on a small, cracked screen |
| Icon plus word on every action | Helps a reader who cannot read the word, and one who cannot read the icon |
| The verbs are Play, Save and Share, the same on every screen | Plain words for a slow reader |
| Body text 17 px; every text colour 4.5:1 or better on its ground, both themes | Readable in sunlight without zooming |
| Arabic script never tracked or broken mid-word; Ethiopic, Devanagari, Chinese get their own faces and leading | 57 languages, several right-to-left |
| Motion is short, never blocks a tap, uses transform and opacity only, and stops under "reduce motion" | Cheap phones and people who get motion-sick |
| Nothing downloaded: system fonts, inline SVG icons, no animation runtime | It runs off a microSD card with no internet |

## Files

```
app/assets/css/
  tokens.css               every colour, size, curve and duration (--et-*)
  base.css                 reset, page type, helpers, per-script rules
  components/<name>.css    one file per component, classes prefixed et-
  pages/styleguide.css     layout of the style guide page only
app/assets/js/
  ui/icons.js              ET.ui.icon(name): the icon set
  ui/sheet.js              ET.ui.sheet.open(): bottom sheet / dialog
  ui/toast.js              ET.ui.toast.show(): confirmation toasts
  brand/mascot.js          ET.mascot: Kandili's drawing, poses, moves, moods
  features/styleguide.js   the style guide's demos (not used by the app)
  features/onboarding.js   Kandili's first-run funnel (loaded by welcome())
app/styleguide.html        the living style guide
```

All scripts are classic scripts on the global `ET` (they must run from
`file://`; see [decision 0002](../decisions/0002-no-bundler.md)). Each one
registers with the module registry in `core.js`, so `core.js` loads first:
`ET.use('brand/mascot')` and `ET.mascot` are the same object. See
[the module map](../architecture/modules.md).

The new kit uses `--et-` names so it can load beside the old `app.css` during
the migration without either overriding the other. Colours deliberately match
the values `app.css` uses for the same jobs (for example the dark theme's pale
button faces with near-black words, `--on-face` there and `--et-on-*` here).

## Tokens

Three layers in `tokens.css`:

1. **Palette** (`--et-p-*`): raw brand colours. Components never read these
   directly, except for fixed artwork that must not change with the theme
   (generated covers, the QR code, Kandili).
2. **Semantic**: what a colour is for. Light and dark redefine only this layer.
   - Grounds: `--et-bg`, `--et-surface`, `--et-sunk`, `--et-raised`, `--et-scrim`
   - Text: `--et-text`, `--et-text-soft`, `--et-text-brand|go|info|danger`
   - Washes (pale backgrounds): `--et-wash-brand|gold|go|info|danger`
   - Filled controls, each a face, the words on it and the lip under it:
     `--et-fill-*`, `--et-on-*`, `--et-lip-*` for brand, go, gold, info,
     danger, quiet
3. **Scales**: type (`--et-text-2xs` to `--et-text-display`), weights,
   leading; space on a 4 px grid (`--et-space-1` to `-8`); touch sizes
   (`--et-tap` 56 px, `--et-tap-min` 48 px, `--et-tap-lg` 64 px); radius;
   elevation (`--et-shadow-1..3`, tinted purple); motion (durations and
   curves); layers (`--et-z-*`).

Theme follows the phone unless `<html data-theme="light|dark">` is set.
Motion follows the phone unless `<html data-motion="reduce|full">` is set.

The style guide's colour section works out every text and fill pair's
contrast ratio live in the browser, for whichever theme is showing.

## Components

| Component | Classes | Script | Notes |
|---|---|---|---|
| Button | `et-btn` + `--go --gold --info --danger --quiet --ghost`, `--sm --lg --block --icon` | none | Face on a lip; drops on press. `aria-busy`, `aria-pressed`, `.is-done` |
| Chip, badge | `et-chips`, `et-chip`, `et-badge--*` | none | Chips are `<button aria-pressed>`; selected shows a check, not only colour |
| Card, poster, shelf | `et-card`, `et-poster`, `et-shelf` | none | Generated covers in six tones via `data-tone`; a real `<img>` covers it |
| Row | `et-list`, `et-row`, `et-row__main` | none | Whole row is the link; actions sit beside it. `.is-current`, `.is-saved`, `et-row__bar` |
| Fields | `et-search`, `et-field`, `et-switch`, `et-segmented` | none | 17 px text so iOS never zooms on focus |
| Progress | `et-progress`, `et-ring`, `et-skeleton`, `et-spinner` | none | Ring is one element (conic gradient) |
| Banner, empty | `et-banner--*`, `et-empty` | none | Calm; always says what still works |
| Steps | `et-steps`, `et-dots` | none | Done steps show a check and a filled line |
| Sheet | `et-sheet` | `ET.ui.sheet` | Focus trap, Escape, scrim tap, drag-down to close, focus returns |
| Toast | `et-toasts`, `et-toast--*` | `ET.ui.toast` | One polite live region; pauses under a finger |
| App bar, tab bar | `et-appbar`, `et-tabbar` | none | Four destinations at the bottom; `aria-current="page"` |
| QR | `et-qr`, `et-scanner` | none | Code always black on white with a quiet zone; the sharing feature supplies the code and camera |
| Kandili | `et-kandili` | `ET.mascot` | See below |

Each CSS file opens with its markup example. The style guide shows every
state.

## Motion

| Token | Value | Job |
|---|---|---|
| `--et-dur-instant` | 90 ms | Press feedback |
| `--et-dur-fast` | 160 ms | Hover, colour |
| `--et-dur-base` | 240 ms | Toast, chip |
| `--et-dur-slow` | 360 ms | Sheet, page |
| `--et-dur-story` | 700 ms | Mascot one-shots |
| `--et-ease-out` | `cubic-bezier(.2,.8,.2,1)` | Things arriving |
| `--et-ease-in` | `cubic-bezier(.5,0,.75,0)` | Things leaving |
| `--et-ease-inout` | `cubic-bezier(.65,0,.35,1)` | Moving across |
| `--et-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | Playful press, mascot |

Under reduced motion every duration becomes 1 ms (so `transitionend` still
fires and no code waits forever) and every loop stops.

## Kandili, the mascot

Swahili for lantern. Brand brief: `brand/mascot` in the project files
(`kandili-brand-brief.md`). Approach: [decision 0003](../decisions/0003-mascot-cutout-svg.md).

The flat drawing is cut into parts, each its own SVG group: shadow, glow,
handle, flame, cap, arms, body, glass, face (eyes, mouth, cheeks), base, prop,
effects. Three layers of behaviour sit on top:

- **Pose**: which parts are drawn. `neutral, hello, play, saved, share,
  waiting, offline, hooray, thinking, sleeping`.
- **Move**: a one-shot Web Animation, all under 1.2 s. `hop, twirl, fly, wave,
  glow, nod, dim`.
- **Mood**: the CSS loop underneath. `idle` (float, breathe, flicker, blink),
  `doze`, `dim`, `think`, `still`.

Features ask for **moments**, never parts:

| Moment | Pose | Move | Mood |
|---|---|---|---|
| `welcome` | hello | wave | idle |
| `play` | play | hop | idle |
| `saved` | saved | glow | idle |
| `shared` | share | fly (leaves a little flame behind) | idle |
| `milestone` | hooray | twirl | idle |
| `loading` | waiting | | doze |
| `offline` | offline | dim | dim |
| `notfound` | thinking | | think |
| `empty` | sleeping | | doze |
| `ready` | saved | hop | idle |
| `tap` | (keeps pose) | nod | (keeps mood) |

The mood names in decision 0003 (`wave, cheer, fly, think, sad, sleep`) work
as aliases for these moments.

```js
var k = ET.mascot.create(el, { pose: 'hello', size: '8rem', label: '' });
k.moment('saved');                 // returns a Promise
k.play('hop').then(next);
k.pose('offline'); k.mood('dim');
k.destroy();

ET.mascot.markup('share', { size: 48 });   // a still SVG string (toasts, icons)
ET.mascot.mount(document);                  // upgrades every [data-kandili]
```

```html
<div data-kandili data-moment="welcome" data-size="8rem"></div>
```

Rules built in:

- Only transform and opacity animate. Loops pause off screen and in a hidden
  tab. Blinks every 3 to 6 s.
- Reduced motion: no loops, no blinks; `play()` resolves at once and the pose
  simply shows.
- Right-to-left pages mirror the character. Props are held in both hands and
  centred, so a mirrored pose never offers with the left hand alone, and no
  pose carries a direction-sensitive symbol or any text.
- Decorative by default (`aria-hidden`); pass `label` when the lantern says
  something the words beside it do not.
- On a dark ground the glow turns from pale cream into warm brass light
  automatically in the dark theme; an always-dark panel adds `.et-on-dark`.
- Colours are fixed (`--et-k-*` in tokens.css, mirrored in `mascot.js`; a
  test keeps them equal).

**The art** is traced from Ashish's final ChatGPT drawings (`mascot/png/poses`
in the project files): ring handle, cap with three vents, trapezoid glass
between frame bars, banded base on two feet, mitten arms in front. The body
parts (`HANDLE`, `FLAME`, `CAP`, `GLASS`, `BASE`, `EYES`, `MOUTH`, `arm()`,
`PROP`) are drawn in the art's own 200 x 250 frame and `ART` scales them onto
the stage, where the lantern stands on y = 120 with the glass at the origin.
Redrawn art changes only those strings; keep each part's group class and
every pose, move and mood keeps working. Budget: under 30 KB for the script.

**On the live pages**, `ET.lantern(size, pose)` in `core.js` writes a slot
holding the still header drawing, and `ET.loadMascot()` fetches `tokens.css`,
`mascot.css` and `brand/mascot.js` after the page paints, then brings every
slot to life with the moment that pose belongs to (hello waves). There is one
Kandili module; the earlier `kandili.js` is gone.

## Adding or changing a component

1. Write `app/assets/css/components/<name>.css`, opening with a comment that
   shows its markup and lists its modifiers and states.
2. Use tokens only: no hex colours, no bare pixel sizes for anything a token
   covers. `tests/test_design_system.js` fails on a hex colour in a
   component and on any `--et-` variable that `tokens.css` does not define.
3. If it needs behaviour, add `app/assets/js/ui/<name>.js` on `ET.ui`, with a
   header comment saying what it does and what it depends on. Visible text
   comes in from the caller, already translated.
4. Add it to `styleguide.html` in every state, then check light, dark, RTL,
   reduced motion and a 320 px wide phone.
5. Run `npm test` and the accessibility audit (axe plus tap sizes) from the
   speed and accessibility workstream.

## Using the kit on a page

```html
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/base.css">
<link rel="stylesheet" href="assets/css/components/button.css">
<!-- …only the components this page uses… -->
<script src="assets/js/core.js"></script>
<script src="assets/js/ui/icons.js"></script>
<script src="assets/js/brand/mascot.js"></script>
```

A page with a tab bar sets `--et-tabbar-h` on `<body>` so toasts clear it.
When a screen moves to the kit, its files go into the service worker's
`SHELL` list and `VERSION` in `app/sw.js` is bumped. The style guide itself is
not cached by the service worker; it is a team and board page.
