# EasyTransfer

Packs a media library onto a microSD card, together with an offline app that
opens itself, plays what is on the card, saves files to a phone, and teaches the
person holding it how to pass it on.

Built for the **VillageServer Initiative**, whose distribution unit is a verified
applicant receiving a microSD card in the post, with every other piece of
hardware sourced locally.

---

## Where this sits

Three pieces, of which this is the middle one:

| | What it does | Where it lives |
|---|---|---|
| **GawahiiTV** | Catalogues the material — 112 Digital Bible Society resources in Sindhi and Urdu, with stream and download URLs | `01-Active-Client-Work/GawahiiTV` |
| **EasyTransfer** | Turns that catalogue into a card somebody can hold, and is the app on it | here |
| **VillageServer** | The field programme — vetting, posting cards, the printed guides | `01-Active-Client-Work/project-bible-runners-site` |

GawahiiTV streams from `dbs.org`. That is the right answer for a website and the
wrong one for a village with no signal. EasyTransfer is what closes that gap.

---

## Quick start

```bash
python3 packer/easytransfer.py plan --profile standard
```

Sizes every file against the live CDNs and tells you what would fit. Writes
nothing, downloads nothing. Run this first, always.

```bash
python3 packer/easytransfer.py build --profile standard --out /Volumes/LIBRARY
```

Downloads the media, copies the app, writes the catalogue and a manifest.
Interrupt it and re-run the same line — finished files are skipped and partial
ones resume.

```bash
python3 packer/easytransfer.py verify --out /Volumes/LIBRARY
```

Checks every file in the manifest is present and the right size. Run it before
a card goes in an envelope.

To look at the app without downloading anything:

```bash
npm run preview     # build a catalogue with nothing packed, then serve it
```

then open <http://localhost:8080>. `npm run dev` serves what is already there.

There are **no dependencies and no build step** — `package.json` is a handful of
script aliases and nothing else, for hands that reach for `npm run dev` by
reflex. The underlying commands work on their own:

```bash
python3 packer/easytransfer.py preview
python3 packer/serve.py 8080
```

---

## The profiles

| Profile | Card | What goes on it |
|---|---|---|
| `pocket` | 8 GB | All Scripture, scans and audio, plus the films that fit |
| `standard` | 32 GB | The working field library — the usual choice |
| `full` | 64 GB | Everything packable at low bandwidth |
| `everything` | no cap | HD where it exists. Hundreds of gigabytes |

Measured against the live catalogue: `standard` comes to **55 resources, 20.9 GB**
— 73% of a 32 GB card's usable space. `pocket --lang snd` is 16 resources, 3.4 GB.

Selection is deliberate, not "whatever fits". Scripture, scans and audio are
packed first because they are small and get used daily; films go last because
one film in HD costs more than every PDF on the card together. A resource is
included only if **all** of its files fit — a film that stops at chapter 12 is
worse than a film that was never on the card, because it teaches the person
holding it that the card lies.

Add `--lang snd` or `--lang urd` to pack one language.

---

## What ends up on the card

```
START-HERE.html      the obvious thing to tap in a file manager
index.html           the same, for a Raspberry Pi serving the card as a web root
app/                 the offline app
  index.html         home — categories and three verbs
  library.html       search and filter
  item.html          play, read, save, share one resource
  share.html         the step-by-step transfer wizard
  help.html          where saved files go, and how to find them again
  data/catalog.js    the catalogue  (generated)
media/<id>/…         the media itself
manifest.json        what is meant to be here, for `verify`
README.txt           plain-text instructions for whoever opens the card
```

Resources with no downloadable file — the 52 partner links — stay in the app
marked **needs internet** rather than being hidden. A Raspberry Pi with an uplink
can still reach them, and hiding them would misrepresent what the library holds.

---

## Two constraints that shape everything

The app is opened straight off a microSD card at least as often as it is served
over HTTP. That means it runs on `file://`, where:

**ES modules do not load.** `<script type="module">` is fetched under CORS rules
and the `file://` origin is opaque, so a module graph fails with a console error
and a blank page. Every script in `app/assets/js/` is therefore a classic script
hanging one global, `ET`, off `window`.

**`fetch()` of local data does not work.** Same reason. The catalogue is
generated as `data/catalog.js`, which assigns `window.LIBRARY` and is loaded by a
plain `<script>` tag. This single decision is what lets one build work both off a
card and off a Pi.

If either looks like something to modernise: put a card in a phone and open it
from the file manager first. That is how it is actually used.

There is no build step, no framework, no dependency, and nothing loaded from a
CDN — including fonts. All of that is deliberate.

---

## The app

Designed for a cracked shared phone, in sunlight, held by someone who may be
reading slowly.

- **Three verbs, always the same, always the same colours** — Play, Save, Share.
- **Touch targets of 56px and up.** Thumbs, not cursors.
- **Chunky buttons that look pressable** — a solid face on a darker edge that
  collapses when pressed. A flat rectangle does not read as a control at arm's
  length outdoors.
- **Icons and words together**, never an icon alone.
- **English, اردو and سنڌي**, switchable anywhere, with the choice remembered
  and applied before first paint so RTL never flashes.
- **Light and dark**, following the device unless the reader overrides it.

### Installable, and locked in place

The app is a PWA — `manifest.webmanifest`, a service worker, and real icons. Over
HTTPS (Vercel) or from a VillageServer Pi, Android offers **Install** and iOS
offers **Add to Home Screen** from the Safari share sheet. It then opens full
screen from its own icon. `help.html` walks through both by hand, because iOS
never fires `beforeinstallprompt` and a button that appears on half the phones in
a room is worse than none.

The service worker caches the **app shell only**. Media is explicitly excluded —
copying a packed card's tens of gigabytes into the Cache API would duplicate the
library into the phone's own storage and fill the device. `easytransfer build`
stamps the worker's cache name, so a rebuilt card is never shadowed by an
installed copy of the old one.

**The layout cannot be dragged, pinched or knocked off centre.** `touch-action:
pan-y` allows one axis and kills pinch- and double-tap-zoom, `overscroll-behavior:
none` stops rubber-banding and pull-to-refresh, `overflow-x: clip` means nothing
can push the page sideways, and every page ships `user-scalable=no`. Verified at
320px in both directions: `scrollWidth === clientWidth` on every page, nothing
overflowing.

The trade is real: pinch-to-zoom is gone, which costs low-vision users something.
It is paid for by a 17px base size, 56px minimum touch targets and a ~14:1
contrast floor — the page is built to be read without zooming rather than to be
readable once you have zoomed.

### Arabic script

Two of the three languages join their letters, and several habits that are
invisible in Latin actively break them. `app/assets/css/app.css` switches off
letter-spacing and mid-word breaking wherever the interface is Urdu or Sindhi,
scales leading to size (Nastaliq hangs far below the baseline), gives controls
room for descenders, and isolates numerals so `112 of 112` does not reorder.
English catalogue data — titles, publisher names — carries a `.latin` class that
keeps a Latin face and its own direction inside an RTL page.

These rules are carried over from GawahiiTV, where they were worked out the hard
way. They are not stylistic preferences.

### ⚠ The translations need a native speaker

English is authoritative. **The Urdu and Sindhi strings in
`app/assets/js/i18n.js` are a working draft that no native speaker has
reviewed.** They are good enough to build and demo against and not good enough
to ship to the people this is for. Gawahi's own staff are the obvious reviewers.

The share wizard and the help page are **English only** so far. Both call
`tOr(key, english)`: add the key to `STRINGS` in `i18n.js` and it is translated,
with no other change. Missing keys fall back to English, so a partly-reviewed
file is safe to ship as it improves.

---

## Deploying the web version

`vercel.json` serves `app/` as the site root. There is no build step and nothing
to install — `app/data/catalog.js` is committed, so a deploy is just the static
files.

The deployed version is the **preview** catalogue: nothing is packed, so every
resource streams from `dbs.org` and the partner CDNs exactly as GawahiiTV does.
That makes it a browsable web edition of the library, and the surface people
install from. The card build is the offline edition of the same app.

To refresh what the site lists after the catalogue changes:

```bash
npm run catalog        # regenerate app/data/catalog.js
git commit -am "refresh catalogue" && git push
```

## Licensing

The material comes from the Digital Bible Society and its publishing partners —
Jesus Film Project, LUMO, BibleProject, Global Recordings Network, Mars Hill,
ROCK International, Create International — who publish it free of charge.

**Free of charge is not the same as licensed for redistribution.** GawahiiTV
deliberately re-hosts nothing for exactly this reason. EasyTransfer copies files
onto a card, which is redistribution. Confirm terms with each publisher before
cards go out. One item (`URDOUB`) is explicitly CC BY-SA 4.0; the rest are not
marked.

Nothing on a card should ever be sold.

---

## Layout

```
catalog/resources.json    the source catalogue (copied from GawahiiTV)
packer/
  easytransfer.py         the CLI — plan, build, verify, preview, list
  serve.py                local server for reviewing the app
  et/
    catalog.py            catalogue -> flat asset list
    fetch.py              size probing and resumable downloads
    profiles.py           card profiles and the selection rule
    build.py              assembles the card
    util.py               filename sanitising, sizes
app/                      the app, copied onto every card
docs/                     field notes
art/                      artwork manifest
```

To pack a different library, replace `catalog/resources.json` and adjust
`et/catalog.py`. Nothing else knows what Gawahi is.
