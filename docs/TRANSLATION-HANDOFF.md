# Translation handoff

English is the reference for the interface. The October 2026 editorial review
read the existing wording for all 16 language options, corrected grammar and
meaning where it could be assessed, added a Marathi draft, and researched
partial Kikuyu, Ekegusii, and Maa controls. This was an
AI-assisted review; no fluent local speakers have approved these translations.

## Plain-language pass following reader feedback

The October 2 follow-up reviewed the ten Asian-language interfaces: Nepali,
Hindi, Marathi, Urdu, Sindhi, Pashto, Gurmukhi Punjabi, Shahmukhi Punjabi,
Mandarin, and Cantonese. A Nepali reader found some of the earlier help text
hard to understand. This pass names the file explicitly, separates opening
a file from installing an app, and replaces long literal explanations with
short actions.

Nepali uses `सेभ गर्नुहोस्` for saving and `फाइल खुलेन भने` for a file that will
not open. Its recovery heading now says `सेभ गरेको फाइल भेटिएन`. The reader
is directed to Files, Downloads, or the folder they chose. The other nine
interfaces received corresponding corrections to troubleshooting, file
locations, and the choice between sending and receiving on a phone. Punjabi
home-page counts now include the missing noun, with a singular form too.

Hindi save terminology was compared with
[Google's Hindi file instructions](https://support.google.com/chromebook/answer/1700055?hl=hi).
Cantonese consistently uses `儲存` for file saving, matching the terminology in
[Apple's Hong Kong file instructions](https://support.apple.com/zh-hk/102570).
Operating-system app and menu names remain recognizable. Browser handoff
messages still ask readers to confirm the download; they do not claim it is
already complete. This remains an AI-assisted wording review. Feedback from
fluent readers is still needed to confirm regional vocabulary and naturalness.

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

## Luganda addition — 2026-10-02

Luganda uses content code `lug` and interface code `lg` (including the `lg-UG`
phone locale). Short controls were adapted from
[published Luganda interface labels](https://www.jw.org/lg/): language selection,
search, read, watch, download, copy-link and email actions. Longer help,
installation and sharing instructions retain English with the existing explicit
“Some menus in English” notice. These controls are a researched draft, not a
fluent-speaker-approved translation. No Swahili text is inherited.

All 66 book names come directly from the DBS Luganda Bible audio selector.
The captured [Ganda inventory](https://dbs.org/discover/languages/lug), complete
film chapter URLs and both LUMO Mark translations are recorded in
`catalog/source/dbs-*-2026-10-02.json`. The moved LUGREVBSU audio page is retired;
the Contemporary Bible's linked LUGBIB audio edition is included instead.
The site's existing DBS-hosted curation continues to exclude outside publishers.
The audio collection includes all 215 individual MP3 downloads and both ZIP
archives. Its ZIPs reject automated requests, but complete browser downloads
were inspected and each contains all 215 MP3s. All seven PDFs were also
downloaded and their PDF headers verified. Bible ZIPs and EPUB are omitted
when the file verifier and browser cannot confirm them. Three full audio
Bible editions remain available for streaming.

## Luo and Oromo additions — 2026-10-03

Dholuo uses content and interface code `luo`, with `/luo` and `/dholuo` routes.
Afaan Oromoo uses content code `orm` and interface code `om`, with `/oromo` and
`/afaan-oromoo` routes. Both include native filters, resource actions, help,
file troubleshooting, saving, and all ten device-sharing guides. Their book
selectors use the published DBS names; Oromo preserves each audio edition's
own book labels. Short controls were compared with published
[Dholuo](https://www.jw.org/luo/) and [Oromo](https://www.jw.org/om/) interfaces.
The longer instructions are AI-assisted drafts and still need fluent local
review. The language selectors and landing pages disclose this. The separate
computer screenshot guide and privacy notice remain English. No resources
from those vocabulary reference sites were imported.

The [DBS Dholuo inventory](https://dbs.org/discover/languages/luo) produces 24
resources: three films, two text editions, one complete audio Bible, the
complete Dholuo recordings, fourteen publisher programmes, Story of Jesus,
and two current Bible directory entries. Two retired audio editions and two
Luhya programme rows are excluded. The recordings player has all 299 Dholuo
tracks. Its published ZIP additionally contains 22 Luhya/Lunyore tracks; the
download label and description explicitly disclose this. Five complete ZIP
downloads were checked in the browser and their contents and CRCs inspected.
The PDF, all Dholuo tracks and film chapter endpoints were probed; native
players and the audio chapter save flow were checked in the browser.

Oromo combines DBS's four listings: [West Central](https://dbs.org/discover/languages/gaz),
[general Oromo](https://dbs.org/discover/languages/orm),
[Eastern/Harar](https://dbs.org/discover/languages/hae), and
[Borana, Arsi and Guji](https://dbs.org/discover/languages/gax). The 93 distinct
listed URLs map to 86 resources after combining aliases and excluding three
retired audio editions. Regional varieties remain identified on the shelves.
There are 20 films, four current audio Bibles, six readable PDFs, six audio
collections, 44 named GRN programmes, five current Bible directory entries,
and the ROCK lesson page. Several DBS audio headings said New Testament
even though their selectors contained the Old Testament or the full Bible;
the catalogue labels follow the actual books.

All individual DBS audio files and the six PDF signatures were verified.
The complete Eastern Oromo low-quality ZIP was downloaded in the browser;
all 14 MP3 files and their ZIP CRCs were verified.
Publisher pages, current film provider downloads and current Bible editions
were captured from their rendered pages. The general Oromo player excludes
1,067 Orma and Afan Munyoyaya tracks from the mixed collection, retaining all
725 Oromo tracks; its unmodified publisher ZIP is labeled with all three
languages. ROCK's 100 lesson links are available through the publisher page,
whose individual MP3 downloads rejected verification; they are not advertised
as verified direct downloads. The confirmed ROCK PDF is directly readable.
Unconfirmed EPUBs, Bible ZIPs and broken legacy endpoints are omitted.

`catalog/source/dbs-*-2026-10-03.json` records the Oromo inventories, detail
pages, direct-file results and exact external allowlist. `packer/build_oromo.py`
rebuilds the native catalogue from these captures. The external exceptions
are exact URLs scoped to Oromo or Luo; existing languages retain their prior
curation. The startup home and language catalogues remain slim.


## Igbo — 2026-10-03

The Igbo shelf (`ibo`, interface `ig`, `/igbo`) has 28 resources from the
[rendered DBS inventory](https://dbs.org/discover/languages/ibo): 13 films,
three current audio Bibles, the contemporary text reader and checked HTML ZIP,
six historic PDF scans, the complete GRN collection (29 recordings), three GRN
programmes (18 Union, four Asaa, six Ohafia/Union tracks), and the Union Bible
directory. Four YouTube rows refer to LUMO films already carried on DBS; those
URLs remain in `dbsListedUrls`. One retired IBOBSN audio edition is excluded.
`packer/build_igbo.py` rebuilds this shelf from the saved rendered evidence.

The 398 Igbo strings cover the library, item controls, saving, nearby transfer,
help and all ten sharing routes. Published Igbo UI vocabulary was compared with
https://www.jw.org/ig/; that page is only a language reference, not a library
resource. All 66 book names use DBS’s own Union/contemporary Bible selectors.
The interface is a translation draft requiring review by a fluent Igbo speaker.
OS menu names remain recognizable (Files, Downloads, Finder, File Transfer,
Trust, AirDrop). The computer screenshot guide and privacy controls remain in
English, as disclosed in the language note. “If the file does not open” refers
to the file, not the app. The New Testament scan is labeled “Agba Ọhụrụ” rather
than DBS’s misleading “Ọhụrụ Ọrụ”.

All 2,638 published audio chapter paths were checked: 2,637 respond with MP3;
Contemporary Judges 18 returns 404 and is also absent from DBS’s own selector.
The disabled chapter is labeled unavailable; old bookmarks cannot request it,
and autoplay stops with an explanation after Judges 17 instead of silently
skipping Scripture. The Union edition includes the chapter. All 29 recording
MP3s and six PDF signatures passed probes. Both complete GRN ZIPs (29 MP3s each)
and the contemporary HTML Bible ZIP (74 entries) passed full-download CRC
checks. DBS’s video CDN rejects command-line probes with 403; browser metadata
checks cover the in-app film players and chapter boundaries instead.

DBS’s Ehugbo and Igbo JESUS pages incorrectly link Enuani chapters/ZIPs. The
shelf uses the respective, verified full-film SD/HD provider files for those
two varieties. Enuani retains its 61 chapters. The exact 14 publisher page and
media URLs are allowed only for the Igbo shelf; other curation is unchanged.
Unverified optional archives stay accessible from each original DBS page.
The existing 834 raw and compiled resources were compared and remain unchanged.
