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

## The offline copy

```bash
npm run card          # download the media into ./card  (~21 GB, resumable)
npm run verify:card   # every file present and the right size
npm run serve:card    # serve it on this machine's network
```

`serve:card` prints a LAN address as well as localhost — anyone who joins the
same Wi-Fi opens that address and has the whole library with no internet at all.
That is what a VillageServer Pi does; this is the same thing on a laptop.

If you put the card on a Pi, serve it with `packer/serve.py`, not a bare
`python3 -m http.server`. Python's built-in server ignores byte-range requests,
and **iOS Safari will not play video from a server that can't answer one** —
every iPhone in the room would get a dead player. `serve.py` answers ranges
properly (206, suffix ranges, 416), and it is also what introduces two phones
for Nearby with no internet. nginx or Apache serve ranges too, but not Nearby.

`./card` is gitignored. Tens of gigabytes of media belongs on a microSD card,
never in the repo and never in a Vercel deploy.

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

## Languages — content follows the one you choose

Choosing **English**, **اردو** or **سنڌي** picks two things at once: the language
of the interface, and the language the films, Scripture and audio are *spoken
or written in*. Home and the library open on that language only; the others are
one tap away under "Other languages". Every item says **Spoken in English** /
**Written in Urdu** before anyone presses play.

This fixes a real bug: the GawahiiTV catalogue had no English at all, so an
English reader tapped an English title and heard Sindhi.

English comes from `packer/build_english.py`, which writes
`catalog/english.json`. DBS hosts the same films under the same URL patterns
with the language code swapped, so it builds the matching set — *JESUS* (61
chapters), *Gospel of John*, *The HOPE*, *iBible*, *Story of Jesus* audio, three
public-domain Bibles (World English, Berean Standard, King James) and two
Wycliffe manuscripts — then **probes every URL** and keeps only what the server
actually serves. `catalog.load()` merges any sibling catalogue into
GawahiiTV's, so that copy stays untouched and refreshable.

### Complete DBS catalogue audit

The DBS language pages were audited from their rendered browser output on
2026-09-24. The audit covers 12 DBS language records mapped into the nine
libraries above: **1,415 clickable Bible, film, audio, historic scan, and
publisher entries**, all represented in the app. It adds 891 searchable records
after the richer curated entries are deduplicated.

Run `npm run dbs:import` to rebuild the supplement and the web catalogue. The
captured inventory is in `catalog/source/dbs-rendered-2026-09-24.json`; verified
DBS file and audio patterns are in
`catalog/source/dbs-direct-files-2026-09-24.json`. Direct reading, playback, and
download buttons are added only for URLs that passed the probe. Every other
entry still opens its DBS or publisher page.

Mandarin and Cantonese resources imported from Larry's local folders also have
verified DBS web fallbacks. Their original files are used on a packed card;
the same rows stream or open from DBS when the visitor has Wi-Fi. Run
`packer/enrich_local_online.py` to refresh those pairings, or use
`npm run dbs:import`, which runs it automatically. The rendered media capture
and its 539-file probe are stored beside the main audit in `catalog/source/`.

### Share one language with someone

Larry's sharing screen is `/share-libraries`. It lists every collection with
its resource count and gives him two large choices: **Open library** or **Email
link**. The email is prefilled with the public address and a short explanation.

The public language addresses are:

- `/english`
- `/mandarin`
- `/hindi`
- `/urdu`
- `/swahili`
- `/western-punjabi` (also `/shahmukhi`)
- `/cantonese`
- `/pashto` (also `/northern-pashto`)
- `/eastern-punjabi` (also `/punjabi`)
- `/nepali`
- `/sindhi`
- `/gusii` (also `/ekegusii` and `/kisii`)

Anyone arriving anywhere else sees a full-screen language chooser first, with
their phone's own language suggested at the top and each library's size shown.
Each address above skips that: it opens directly in that language, removes the language picker, and
shows only that language's resources and resource types. Resource, help, and
nearby-transfer links carry the same language lock. If someone edits an item
link to name a resource from another language, the app rejects it and returns
them to the shared collection. The full catalogue remains available separately
at `/library.html` for administrators and direct visitors.

## The web edition streams

A resource that is not packed on a card carries its publisher's URLs instead,
so the same app **plays locally off a card and streams on Vercel**. 58
resources play or open on the web: chaptered films, single films with a
low-data / HD switch, audio collections, PDFs in the page, and the four audio
Bibles with a book-and-chapter picker that carries on into the next chapter.

Every DBS CDN answers with `access-control-allow-origin: *`, which is what makes
in-page saving and phone-to-phone relaying possible from any site. (If you test
with `curl`, send a browser user-agent — the CDN refuses curl's.) Create
International's films sit in an S3 bucket whose dotted name breaks the
virtual-host certificate, so `build.secure()` rewrites them to path-style HTTPS.

## Saving, step by step, inside the page

**Save to my phone** opens a four-step sheet: what → where → saving → done.

The Library also has **Download several things**. It turns every downloadable
row into a large checkbox, lets the reader select several whole films, audio
collections, or books, and saves them as one guided batch. The batch chooser
prefers a complete compact ZIP when the catalogue has one; otherwise it saves
the complete video, PDF, or every chapter. Chapter filenames include the
resource title so two selected films cannot overwrite one another.

- **Where** offers *Choose a folder* and *Choose the name and place* on browsers
  with the File System Access API (Chrome and Edge on computers), writing
  straight to disk and remembering the folder for next time; everywhere else it
  is *Save to Downloads*, and step 4 says in words where the file went.
- **Saving** is a real progress bar — bytes fetched in the page — with Stop.
- **All 61 chapters** saves as 61 files into the chosen folder.
- Files over 400 MB on a browser without folder access go to the browser's own
  download manager rather than into memory, which would crash a phone's tab.

## Nearby — phone to phone, from the page

**Send to a phone nearby**: one phone taps Send and shows a 6-digit code, the
other taps Receive and types it. The receiver sees what is coming and its size,
accepts (optionally into a folder), both watch the progress, and the receiver
gets **Send it to someone else** — which makes what just arrived the next thing
it sends. The chain, built in.

WebRTC joins the two browsers directly; **the file never touches a server**.
Only the few hundred bytes that introduce the phones travel through a
middleman, and which one depends on where the page is served:

| Served from | Introduced by | Needs internet |
|---|---|---|
| `packer/serve.py` (a Pi, a laptop) | `serve.py` itself — `/signal/` | **no** |
| Vercel | PeerJS's free public broker | yes |
| A card (`file://`) | nothing — the page says so and offers the guides | — |

The broker is spoken to through the official PeerJS client, vendored at
`app/assets/vendor/peerjs.min.js` (MIT, 1.5.4). An earlier hand-written version
of its protocol connected fine and then had every relayed message silently
dropped; the official client works first time. It is a third-party service: it
sees the pairing, never the file.

Verified with two and three browsers: a 10,024,538-byte PDF arrives
byte-for-byte, over both the local and the broker path, and onward through a
second hop.

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

The app is a PWA — `manifest.webmanifest`, a service worker, and real icons. It
then opens full screen from its own icon. Where that works is not uniform, and
the difference matters in the field:

| Served from | Android install | iOS Add to Home Screen |
|---|---|---|
| Vercel (HTTPS) | yes — prompt, plus the in-app button | yes, via the Safari share sheet |
| A Pi over plain HTTP | **no** — service workers need a secure context | yes |
| A microSD card (`file://`) | no | no |

Service workers require HTTPS or localhost, so a Pi serving plain HTTP over a LAN
IP cannot register one and Chrome will not offer to install. Registration is
guarded and fails quietly; **the library itself works exactly the same either
way** — installing only changes how it is launched. `help.html` walks through
both platforms by hand, because iOS never fires `beforeinstallprompt` and a
button that appears on half the phones in a room is worse than none.

The service worker caches **an explicit allow-list of the app's own files and
nothing else**. It used to cache any same-origin GET, which silently broke
Nearby: the "any messages for me?" poll has the same URL every time, so the
worker kept replaying the first answer. Media is excluded for a second reason —
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
