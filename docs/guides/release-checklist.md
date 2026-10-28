# Release checklist

Run this before anything goes to the live site or onto cards. If the GitHub **Tests** check is
green, the automated part is done; the rest takes about 20 minutes with two phones (an iPhone
and a cheap Android).

## Automated (GitHub check is green)

- [ ] Unit tests pass (`npm test`)
- [ ] Browser tests pass on every device, including two-phone sharing (`npm run test:e2e`)
- [ ] `VERSION` in `app/sw.js` bumped if any shell file changed

## iPhone, on the Vercel preview

- [ ] Home opens; the language picker works; switch to Swahili and back
- [ ] Play a film for 30 seconds and seek; read a Bible chapter; play an audio chapter
- [ ] Save a file to Files and open it again from Files
- [ ] Share a library link to WhatsApp; the preview card shows the right language
- [ ] Add to Home Screen, turn on airplane mode: the app still opens and a saved item plays

## Cheap Android

- [ ] The same five checks in Chrome, on a slow connection
- [ ] Dark mode and the largest system font: nothing is cut off

## Phone to phone

- [ ] iPhone sends a film to the Android with Nearby; the Android sends one back
- [ ] With QR sharing: scan the sender's code with each phone's own camera app, indoors and in daylight

## Card and Pi (only when the packer or the app shell changed)

- [ ] `npm run card`, then `npm run verify:card`
- [ ] Open the card's `index.html` on a laptop with Wi-Fi off
- [ ] `npm run serve:card`; two phones on that Wi-Fi play the same film and use Nearby

## After merging to main

- [ ] Live site: home, one language page and one `?src=qr` link open on both phones
- [ ] `/admin` loads and today's numbers move
- [ ] Note the release and its `sw.js` VERSION in the PR description
