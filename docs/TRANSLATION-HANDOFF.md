# Translation handoff

English is the reference for the interface. The October 2026 editorial review
read the existing wording for all 16 language options, corrected grammar and
meaning where it could be assessed, added a Marathi draft, and researched
partial Kikuyu, Ekegusii, and Maa controls. This was an
AI-assisted review; no fluent local speakers have approved these translations.

## Current coverage

| Language | Interface state |
|---|---|
| English (`en`) | Reference wording; saving, sharing, help, and accessibility copy reviewed. |
| Mandarin (`cmn`) | Existing draft reviewed; grammar, terminology, counts, and device instructions corrected. |
| Hindi (`hi`) | Existing draft reviewed; counted nouns, action labels, and device instructions corrected. |
| Marathi (`mr`) | Full draft covering the main interface, help, and sharing guides. |
| Urdu (`ur`) | Existing draft reviewed; agreement, counts, and action meanings corrected. |
| Swahili (`swh`) | Existing draft reviewed; transfer, offline, and device instructions corrected. |
| Zulu (`zul`) | Existing draft reviewed; grammar and dynamic language-name constructions corrected. |
| Western Punjabi (`pnb`) | Existing Shahmukhi draft reviewed; agreement and action meanings corrected. |
| Cantonese (`yue`) | Existing draft reviewed; Mandarin fragments and mixed-register phrasing corrected. |
| Pashto (`ps`) | Existing draft reviewed; noun agreement and touch-and-hold instructions corrected. |
| Eastern Punjabi (`pa`) | Existing Gurmukhi draft reviewed; count and action meanings corrected. |
| Nepali (`ne`) | Existing draft reviewed; count, action, and recovery instructions corrected. |
| Sindhi (`snd`) | Existing draft reviewed; agreement and receive/send labels corrected. |
| Kikuyu (`kik`) | 144 researched draft controls, short instructions, and headings; 260 reference keys remain in English. |
| Gusii (`guz`) | 25 supported draft controls; 379 reference keys remain in English. Incorrect and unverified old controls and the copied Swahili have been removed. |
| Maasai (`mas`) | 38 supported draft controls, nouns, and counters; 366 reference keys remain in English. The copied Swahili has been removed. |

The three partial languages are labeled **Some menus in English** in both
language selectors and on their shared-library landing pages. English is the fallback for every untranslated key;
selecting Kikuyu, Gusii, or Maasai never silently selects a Swahili interface.
Coverage counts use the 404-key reference, which includes optional singular
variants and older compatible iOS keys. They measure supplied entries, not
fluency or the percentage of a reader's experience that is translated.

These are not complete translations. Fluent Kikuyu, Ekegusii, and Maa speakers
still need to review the short drafts and supply the full device instructions.
Local reviewers of the other drafts can also refine
regional terms, respectful register, Christian terminology, and translated
operating-system menu names.

## Source files

Interface translations live in `app/assets/js/i18n.js`. Longer English help and
sharing instructions also live in `app/assets/js/help.js` and `share.js`, where
`tOrHTML(key, english)` supplies a fallback. Update the corresponding translation
when changing an instruction's meaning.

Help route keys use `help.<device>.<step>.h` / `.p`. Sharing route keys use
`route.<from>-<to>.<step>.h` / `.p`. The current iOS guide uses
`help.ios.downloads` and `help.ios.openfile`; older `help.ios.2` / `.3` entries are
compatibility text. Samsung help and the phone illustration captions have
separate keys.

Marathi uses content code `mar` and interface code `mr`. Kikuyu uses `kik` for
both. The separate computer screenshot guide is explicitly English; its text
and images need a coordinated translation before adding another language.
Resource titles and publisher names are catalogue metadata and were not
rewritten as part of this interface review.

## Research for the partial languages

Kikuyu wording was checked against [Rũthiomi](https://www.ruthiomi.com/),
[Mwananchi Afrika's dictionary](https://www.mwananchiafrika.com/digital-dictionary),
[Rice University's Gĩkũyũ sketch grammar](https://www.ruf.rice.edu/~reng/kik/sketch.pdf),
and [published Kikuyu technical help](https://www.jw.org/ki/uteithio-intaneti-in%C4%A9/kuhuthira-jw-org/etha-ibuku/).
Technical loans and supported actions such as open, read, choose, download,
send, and receive were retained. Uncertain save/completion language and longer
network, installation, and file-sharing instructions remain in English.

Ekegusii controls use [dictionary entries](https://gusii.org/search) and
[published imperative grammar](https://www.cambridge.org/core/journals/phonology/article/grammatical-tone-mapping-in-ekegusii/1190DC66B2E21EC6F9DD218B51AA91D5).
`Inka` is Home, so it was removed from Close/Done; Close is `Kuneka`.
The Scripture category uses `Amariko`, replacing the word for laws/commandments.
Other vocabulary was adapted only as short action labels, with software usage
still requiring local review. The site's simulated translator was not used.

Maa labels were checked against the [Payne and Ole-Kotikash dictionary](https://pages.uoregon.edu/maasai/Maa%20Lexicon/title.htm).
Southern Kenyan forms preserve vowel distinctions and tone marks. Action
labels use attested infinitives; Stop uses an attested command. Nouns and
count-compatible quantifiers supply item and chapter counters. These are
contextual adaptations of lexical entries, not proof of native software usage.
Tone and agreement prevent reliable long instructions from being assembled
by joining dictionary words. Those paragraphs remain in English.

## Meaning checks completed

- The library heading and tagline apply to both website and card use without
  promising that every resource is already available offline.
- Language-library text describes the resource language rather than claiming
  every word on the page is in that language.
- Browser download handoff asks the reader to check the saved file; only a
  completed file-system write claims the file has been saved.
- Sharing errors retain the actual failure, connection check, and retry action.
- Counts keep both `{n}` and `{total}`. All other substitution variables retain
  their exact names, including `{lang}`, `{org}`, `{size}`, and `{device}`.
  Optional `.one` keys supply singular noun and verb agreement for one item;
  languages without number-dependent changes retain their ordinary labels.
- The first-run resource counts also use singular wording. Formatted English
  fallbacks and static translated elements identify English for assistive
  readers; native language names carry their own language attributes.
- Device instructions allow differing download destinations and compatible
  reader/player apps. Current Apple file-sharing and home-screen instructions
  replace the earlier absolute claims.

Device guidance was checked against [Apple's Downloads instructions](https://support.apple.com/en-us/102440),
[Apple's home-screen instructions](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios),
[Apple's Windows file-sharing instructions](https://support.apple.com/en-za/120402),
and [Google's Quick Share instructions](https://support.google.com/android/answer/9286773?hl=en).

## Review and maintenance

Keep app and menu names recognizable: Files, Downloads, AirDrop, Quick Share,
LocalSend, Finder, Apple Devices, and On My iPhone / On My iPad. Preserve runtime
placeholders exactly. Short sentences and clear actions are preferable to
literal translations that obscure the steps.

Run `npm test` for language formatter, variable, accessibility fallback, and
save-status checks. Then switch through every language using the header's
language button. Check the home page, library filters, an item's save dialog,
the sharing guide, and the help page. Confirm direction and fonts in Urdu,
Sindhi, Pashto, and Western Punjabi. Automated checks validate formatting and
coverage; fluent readers must judge language quality.
