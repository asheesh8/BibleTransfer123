# Testing EasyTransfer

Two kinds of tests, and GitHub runs both on every pull request. A PR merges only when the
**Tests** check is green.

| Command | What runs | Time |
| --- | --- | --- |
| `npm test` | Python `unittest` and Node unit tests: catalogues, every language, analytics, mail, QR counting, server, admin | ~30 s |
| `npm run test:e2e` | Playwright browser tests on six phone and desktop screens, plus two-phone sharing | ~6 min |
| `npm run test:e2e:chromium` | The same, with iPhone screens in Chromium (for machines without WebKit) | ~6 min |
| `npm run test:e2e:report` | Opens the last browser-test report, with a trace of any failure | |

## One-time setup for browser tests

Playwright is a development tool only. It is never shipped to a phone, a card or Vercel.

```sh
npm install
npx playwright install chromium webkit
```

The tests start `packer/serve.py` on port 8095 themselves (the same server a VillageServer
Pi runs), so nothing else needs to be running.

## What the browser tests check

- **`tests/e2e/smoke.spec.js`**: every screen opens on every device with no script error,
  no broken same-site file and no sideways scrolling; the first-visit language picker works;
  every one-language library listed in `app/assets/js/share-libraries.js` opens on the two
  smallest phones, and right-to-left languages set `dir="rtl"`. Controls under 56 px are listed
  in the report as an annotation; this becomes a failure once the design system fixes the size.
- **`tests/e2e/two-phones.spec.js`**: Nearby, phone to phone. An iPhone sends to an Android,
  an Android to an iPhone, and Android to Android, over the Pi server's local signalling. The
  receiver's file must have the same SHA-256 as the sender's. A wrong code must show a message.
- **`tests/e2e/offline-card.spec.js`**: pages open from `file://`, as they do off a microSD card.

## Devices

| Project | Engine | Screen |
| --- | --- | --- |
| `android-small` | Chromium | 360 x 740, the most common phone we serve |
| `android-tiny` | Chromium | 320 x 640 |
| `pixel` | Chromium | Pixel 7 |
| `iphone-se` | WebKit | iPhone SE |
| `iphone-15` | WebKit | iPhone 15 |
| `desktop` | Chromium | 1280 x 720 |
| `two-phones` | both | one sender and one receiver per test |

Run one with `npx playwright test --project=iphone-15`, or one file with
`npx playwright test tests/e2e/two-phones.spec.js`.

## Writing a browser test

Start from `tests/e2e/helpers.js`:

- `asReturningVisitor(page)` skips the first-visit language picker.
- `answerCookieBanner(page)` answers the cookie notice, which otherwise covers the page.
- `watchForProblems(page)` collects script errors and failed requests; expect it to be `[]`.
- `expectNoSidewaysScroll(page)` fails if the page is wider than the phone.

Prefer ids and `data-` attributes the app already uses over visible words, so a test still
passes in every language. Never skip or delete a failing test to get a green check: fix the
cause, or fix the test if the change was intended.

## Before a release

Follow [release-checklist.md](release-checklist.md).
