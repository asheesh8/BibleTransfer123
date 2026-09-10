# Translation handoff

**Everything Urdu and Sindhi in this app is an unreviewed draft.** This is the
one thing standing between the build and real field use. It needs a native
speaker of each — Gawahi's own staff are the obvious reviewers.

## What to review

All of it lives in one file: `app/assets/js/i18n.js`.

| Block | State |
|---|---|
| `STRINGS.en` | Authoritative. Change this only if the English is wrong. |
| `STRINGS.ur` | Complete draft, **unreviewed**. |
| `STRINGS.snd` | Complete draft, **unreviewed**. |

Roughly 60 keys per language. English is the fallback for anything missing, so
the file is safe to ship at any point while it improves.

## What is still English only

The share wizard (`app/assets/js/share.js`) and the help page
(`app/assets/js/help.js`) carry the longest and most operationally important
prose in the app — about 45 short paragraphs. They are not in `i18n.js` yet.

They do not need to be moved. Both call `tOr(key, english)`: **add the key to
`STRINGS` and it is translated**, with no change to any other file. The keys are
printed in the source next to each string:

- Share routes: `route.<from>-<to>.<n>.h` and `.p`
  e.g. `route.card-android.3.h`, `route.card-android.3.p`
- Help sections: `help.android.2.h`, `help.ios.1.p`, `help.trouble.0.h`, …

## Notes for the translator

- **Resource titles and publisher names stay in English.** They are catalogue
  data, not interface text — "JESUS", "Jesus Film Project", "LUMO". The app
  already renders them in a Latin face with their own direction.
- **App names stay in their original form** — Files, Downloads, AirDrop, Quick
  Share, LocalSend, On My iPhone. Someone hunting for a button on a phone needs
  the string that is actually printed on it.
- **Never start a string with a digit.** `کل 112 میں سے 112`, not
  `112 میں سے…`. A leading number in an RTL run reorders unpredictably.
- `{n}`, `{total}`, `{org}`, `{size}` are substituted at runtime. Keep them
  exactly as they are; move them wherever the sentence needs them.
- Keep it plain. This is read slowly, outdoors, by people who may not read much.
  Short sentences beat correct-but-formal ones.

## Checking the work

```bash
python3 packer/easytransfer.py preview
python3 packer/serve.py 8080
```

Switch language with the globe in the header. Check especially: the home
screen, a film's page, the share wizard end to end, and the help page — those
are the four screens that carry the load.
