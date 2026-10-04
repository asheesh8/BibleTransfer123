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

## French — 2026-10-03

The French shelf uses content code `fra`, interface `fr`, and `/french`, with
`/francais` and `/fra` aliases. It contains 172 resources from all 196 unique
URLs on the expanded [DBS French listing](https://dbs.org/discover/languages/fra).
Repeated publisher rows are deduplicated; every listed URL is represented by
a resource, an edition/programme alias, or an explicit exclusion in the audit.
Regional recordings are labeled for France, Canada, Africa, Central Africa,
North Africa, West Africa and Gitan; the Guernesey edition is labeled separately.

French copy covers library navigation, player/save controls, bulk downloads,
nearby transfer, help and the device sharing guides. Book names and resource
and recording titles are in French. The separate Mac/Windows screenshot guide
remains in English and is disclosed. These translations have been reviewed
for meaning and grammar by the implementation agent; they are not certified
by a native-speaking reviewer. Publisher names and original edition titles
may also appear as source metadata.

There are four current audio Bibles, seven downloadable text editions,
19 historic scans, 27 film resources, 39 audio resources, 42 teaching books
and guides, 33 additional edition directory cards, and the French BibleProject
website. Edition directory cards explicitly say that their files are available
through the publisher's links. BibleProject's 73 overviews and 86 studies each
have distinct captured MP4 links and corrected French titles. DBS's truncated
or mismatched French headings are not repeated. Segond 21 is correctly named;
the DBS directory's misleading “King James” title is not used. The Apostles’ Creed
lesson numbers and subjects follow the actual PDF title pages, correcting
DBS’s shifted numbering; Utley’s second volume is correctly identified as
Mark and 1–2 Peter, and his Acts volume is labeled as a complete commentary. The legacy
GotQuestions topic “fishing” is corrected to “le péché”.

All 4,496 canonical audio Bible chapter URLs were checked with range requests.
There are 4,494 available files: Chouraqui and Trésorsonore each lack a separate
Malachi 4 file. The missing files are disabled and disclosed without altering
the recordings or biblical text. The curated Global Recordings collection
contains 987 recordings: ten public-service recordings without confirmed
Christian content and one Arabic recording are excluded. Its unfiltered ZIP
is not offered. Story of Jesus has nine recordings; StoryRunners has 42; ROCK's
Way of Righteousness has 100 published recordings. The separate French West
African StoryRunners folder is linked through its published pCloud download
interface, with the Internet requirement disclosed; expiring file URLs are
not guessed.

All seven text Bible ZIPs and EPUBs were downloaded through the browser and
passed complete archive integrity checks (14 archives). The four French ROCK
PDFs were also downloaded and their PDF signatures checked. Direct file probes
cover more than 6,200 source URLs. DBS and ROCK block some command-line requests
with 403/406 responses; these are recorded as protected, not as successful byte
checks. Browser media checks verify representative playback across the French
players. Chapter files remain individually downloadable; large film collection
ZIPs that have not been fully downloaded and checked stay on the original DBS
pages. The Saurin scan's direct PDF is empty, so its card links to DBS's source
page instead of offering that file.

Curation continues to exclude known LGBTQ-affirming/gender-inclusive editions,
sectarian translations and editions that cut Scripture. French exclusions are
persisted so a fresh import cannot restore excluded rows. The removed source
rows include the Jefferson edition, an OT-only Rabbinat edition, a placeholder,
two editions whose Christian/full-Scripture scope is unconfirmed, a retired audio
edition, foreign-language study texts, an unavailable image directory, two GRN
programme links without eligible recordings, and retired Lifewords product URLs. Ordinary biblical references to
sexuality are not grounds for removal. This is source/edition metadata curation,
not a verse-by-verse theological certification of every publisher's edition.

Publisher exceptions are exact URLs scoped to French. Existing 862 resources
retain their previous records. The browser captures, file checks and exclusions
are retained in `catalog/source/dbs-*-french-2026-10-03.json` and
`catalog/source/dbs-french-external-2026-10-03.json`; `packer/build_french.py`
reproduces the shelf from these captured sources.

## Amharic — 2026-10-03

The Amharic shelf uses content code `amh`, interface `am`, native name `አማርኛ`,
and the `/amharic` route (`/amh` alias). All five sections of the expanded
[DBS Amharic listing](https://dbs.org/discover/languages/amh) were captured:
71 rows, representing 62 distinct source URLs. Duplicate Savior part links
and duplicate film/publisher listings share their existing cards.

The library has 46 entries: 19 film collections or full films, three audio
Bibles, three main audio collections, 12 individual GRN programmes, one
readable New Testament, six additional Bible edition directory cards, and
two historic PDF scans. Publisher names retain their proper names.
Native titles, 66 book names, menus, player/save/share controls, consent
copy, device sharing routes and troubleshooting instructions use Amharic.
The native interface has 411 strings. English phone menu names such as
Files, Downloads and File Transfer are kept so readers can find those
controls on their devices. The separate Mac/Windows screenshot guide is
in English, and the page discloses this. The translation is a draft requiring
review by a fluent Amharic speaker; automated checks cannot certify idiom.

The three audio Bibles expose 1,859 published chapter MP3s, all checked by
binary range requests. AMHSDV contains Psalms and the 27 New Testament books
(410 files), rather than every Old Testament book. Its selector and saved
chapter generation both honor that 28-book list. AMHNHS has the full 66-book
Bible (1,189 files), and AMHBSE has the New Testament (260 files). The third
letter of John is correctly labeled `3ኛ ዮሐንስ`; the DBS selector repeats the
second letter's name. The broken language autonym and Arabic Bible headings
on the DBS listing are not shown as native interface titles.

The BibleProject collections contain 72 overviews and 23 themes. Each
episode was opened separately, its dialog title checked against the
selected card, and its actual SD player source and HD download link saved.
The distinct episode links are tested to prevent many labels pointing to
one video. Additional films include the director's cut of Magdalena and the
published Savior trailer plus eight parts. Legacy arc.gt links were followed
to their actual MP4 destinations; no film URL was inferred from a filename.

The GRN collection contains 281 Christian recordings. The twelve individual
programme cards reuse exactly those files, including zero-padded programme
IDs 01420 and 01421. The public-service recording “Welcome to USA” is omitted,
as is the unfiltered GRN ZIP containing it. The DBS-listed programme 2011
is identified by GRN as Deme with an Amharic song, without identifying a
separate Amharic track; it is explicitly excluded rather than represented
as a wholly Amharic programme. Story of Jesus has nine recordings and
StoryRunners has 58. Some StoryRunners filenames contain conflicting English
and Amharic subjects, so the app retains their published order with neutral
story/song numbers instead of guessing subjects from those filenames.

The AMHUBS HTML ZIP and EPUB were downloaded through the browser and passed
complete archive CRC checks; the EPUB also has the correct mimetype. The
New Testament PDF and both historic scan PDFs passed signature checks.
Large film ZIPs and the unverified historic flip-book archive remain
available on their original DBS pages; the app offers the captured individual
videos and checked text downloads. Edition directory cards point to current
find.bible pages. The obsolete AMHZZZP Catholic placeholder was resolved
through the current Amharic directory to the matching AMHBSE edition.

The existing Bible curation policy remains in force. Amharic publisher
exceptions and the excluded Deme programme use exact URLs scoped to `amh`.
No identified LGBTQ-affirming edition or theology was added. This source
and publisher check is not a verse-by-verse theological assessment.
The existing 1,034 resources are unchanged. Captures, file probes, archive
results and browser media checks are retained in
`catalog/source/dbs-*-amharic-2026-10-03.json`; `packer/build_amharic.py`
rebuilds the resource catalog and the exact publisher allowlist.

Browser checks loaded representative media for all 19 film entries, all
three audio Bibles and the three main audio collections, including final
chapters/tracks. They check media readiness, source URLs and durations,
not complete viewing of every recording. Native filtering, search, help,
USB sharing instructions and chapter-saving labels were checked. The app's
EPUB save flow produced an Amharic filename; that downloaded file passed
CRC and EPUB mimetype checks. The scoped catalog is approximately 45 KB
when gzipped and does not download the entire multilingual catalog on startup.

## Portuguese — 2026-10-03

The Portuguese shelf uses content code `por`, interface `pt`, native name
`Português` and `/portuguese` (`/portugues` and `/por` aliases). All five
sections of the expanded [DBS Portuguese listing](https://dbs.org/discover/languages/por)
were captured: 406 rows, representing 382 distinct source URLs. All 338
external publisher pages were opened; the three remaining external URLs
are direct legacy videos. Every distinct listed source is included, merged
with its matching resource, or covered by a persisted exclusion reason.

The shelf has 112 entries: six audio Bibles, 14 text Bible or edition entries,
28 films or film collections, 33 audio collections or programmes, five
historic scans, 25 Portuguese studies and a current BibleProject publisher
link. Native titles and 66 book names accompany the 411 Portuguese interface
strings, including help, saving, sharing and device instructions. Regional
variants identify Brazil, Portugal and Mozambique. Proper publisher names
and phone menu names retain their published spelling. The separate screenshot
guide is disclosed as English. The wording is a translation draft; automated
checks do not replace review by a fluent Portuguese speaker.

The six audio Bibles have 5,945 playable chapters. The dramatized Bible for
Everyone Old Testament divides Joel into four chapters and Malachi into
three, as confirmed on the DBS selectors. Its app selector and saved chapter
URL follow that division, instead of omitting Joel 4 or offering a nonexistent
Malachi 4. Both testament scope and chapter counts survive catalog generation.
The 824 Christian GRN recordings are reused by their 30 individual programme
cards. The COVID public-service recording and its unfiltered collection ZIP
are omitted. The Tupari programme with some Portuguese is clearly labeled
multilingual and links to its publisher rather than assigning unidentified
tracks to Portuguese. Story of Jesus contains the full recording plus eight
parts, nine files in total.

The JESUS Brazil chapter list actually points to Acts, and the Portugal list
points to Brazil recordings. Those 134 mismatched chapter URLs are omitted;
each regional full film retains the actual DBS-published SD and HD sources.
Published LUMO and Visual Bible chapters remain individually selectable and
downloadable. Large unverified film archives remain on the original source
pages. The Portuguese New Testament for Translators archive contains 27 New
Testament books, rather than a complete Bible. That HTML ZIP, its EPUB and
the Free Bible HTML ZIP passed complete archive CRC checks; the Free Bible
archive contains all 66 books. Text and historic PDF signatures were checked.
The 1869 scan is explicitly labeled Portuguese/English bilingual.

The retained binary audit covers 7,276 URLs: 6,840 valid file signatures,
435 protected responses and the obsolete Malachi 4 URL returning 404.
Protected requests are recorded separately from successful binary checks.
Browser checks loaded media with positive durations for all 28 film entries,
all six audio Bibles and both main audio collections. The final tracks of both
collections were also checked. These checks verify representative playback,
not complete viewing of every recording. Native search, filtering, link copying,
help, device sharing instructions and a mobile layout without page overflow
were checked. The scoped catalog is approximately 76 KB when gzipped. The app save flow fetches the selected chapter
and displays the native book/chapter label; browser download-event observation
was unavailable, so it is not recorded as an archive integrity result.

The 258 excluded original URLs include all 240 retired Mundo Cristão retailer
links, seven retired Lifewords store links, foreign-language study material,
missing legacy directories, two GRN programmes without identified Portuguese
recordings, a ROCK link actually in Pulaar, and three study pages served with
broken character encoding. The old BibleProject URL was replaced by its
observed current Portuguese page. The 16 legacy find.bible aliases were resolved
through its current Portuguese directory; matching editions share cards and
additional editions use native edition names.

The existing source curation policy remains in force, with exact publisher
exceptions scoped only to Portuguese. No identified LGBTQ-affirming edition
or theology was added. This is a source and edition check, not a verse-by-verse
theological assessment. The existing 1,080 resource records are unchanged.
Language-scoped audited exclusions now survive a fresh rendered import,
preventing retired or excluded original rows from returning. Source captures,
file probes, archive results and exclusions are retained in
`catalog/source/dbs-*-portuguese-2026-10-03.json`. Rebuild with
`python3 packer/build_portuguese.py`, then run `npm run dbs:import`.

## Yoruba — 4 October 2026

The complete rendered DBS Yoruba inventory has 48 rows and 42 unique original
URLs. The library now has 38 Yoruba cards: 12 films, four playable audio Bible
editions, three audio collections, six historic scans, one modern text Bible,
two additional edition directories and ten GRN programme cards. Every original
URL is represented or has an explicit exclusion. The retired YORBIB audio page
is excluded; it lists different replacement editions. The blocked arc.gt short
link is excluded, while its children's film is retained through the working
DBS film page. Four legacy find.bible query links were resolved through the
publisher's current Yoruba search results.

The UI has 411 Yoruba strings, native resource titles, native download labels,
and 66 published Yoruba book names. Phone file instructions retain the English
names users may see on their devices, including Files, Downloads and On My
iPhone. “Tí fáìlì náà kò bá ṣí” explicitly means “if the file does not open”.
The wording is a translation draft requiring native-speaker review; passing
formatter tests is not native-speaker certification. The separate computer
screenshot guide and privacy notice remain English, with an English disclosure.

Scope is preserved: the Okun New Testament is labeled Okun; Iyara/Ijumu, Abunu,
Aworo, Ekiti, Igbomina and Yagba programmes retain their regional identity.
The GRN collection has all 171 recordings, and its ten DBS-listed programme
cards cover 170 of them. The additional recording, programme 68155, is also
included: GRN identifies it as Christian stories and teaching, rather than
public-service material. Story of Jesus has nine MP3 files; StoryRunners has
38 stories followed by ten songs, labeled separately. Historic Genesis and
Psalms/portions are not described as complete Bibles.

All 2,898 canonical chapter URLs in four audio Bible editions were checked.
2,883 returned valid audio. The old 1879 recording lacks 1 Chronicles 1–15;
the DBS selector starts at chapter 16 and the app disables the missing options,
automatically selecting 16. Its chapter save flow uses the same selection.
The other three audio filesets have no missing chapter URLs. Of 3,388 binary
range probes in total, 3,125 returned recognized file signatures, 248 refused
the non-browser request, and 15 returned 404 (those same missing chapters).
Protected requests are retained only where published in the observed DBS UI;
they are not counted as valid binary probes.

The actual modern Bible HTML ZIP and EPUB downloaded through the browser and
passed full archive CRC checks; both cover 66 books. Both GRN quality ZIPs
also downloaded and passed CRC checks for all 171 MP3s, including MP3 signatures
and matching high-quality filenames. Large unverified film, historic and Bible
audio bundles remain available through the original DBS page rather than being
promoted as verified app bundle downloads. Individual published files remain
available. Browser verification loaded all 12 film players with media metadata
and no media errors, played samples from all four Bible audio editions, loaded
all three audio collections, and checked regional programme samples. These
checks do not mean every recording was watched or listened to in full.

Search, film filtering, native help, the Android-to-iPhone guide, scoped email
links and copy acknowledgment were checked. The browser clipboard readback was
not reliable, so copy verification relies on the visible acknowledgment and
existing clipboard instrumentation tests. The chapter save flow fetched the
selected 1 Chronicles 16 MP3 and reached its native browser-download handoff;
it is not described as a verified archive download. A phone-sized layout has
no horizontal overflow. The scoped catalogue compresses to about 26 KB.

The existing 1,192 resource records are unchanged. Existing theology curation
remains in force; no identified LGBTQ-affirming edition or theology was added.
This is an edition/source check, not a verse-by-verse theological assessment.
Exact publisher exceptions and source exclusions are Yoruba-only and survive
fresh rendered imports. Rebuild with `python3 packer/build_yoruba.py`, then
`npm run dbs:import`. Audits are retained in
`catalog/source/dbs-*-yoruba-2026-10-04.json`.

## Nigerian Pidgin — 4 October 2026

All 15 sources in the rendered DBS Nigerian Pidgin inventory are represented:
one text Bible, ten films, two audio collections and two GRN programmes.
The GRN collection has 14 recordings; programmes 33050 and 33051 contain
12 and two of those same recordings. Story of Jesus has the whole recording
and eight separate parts. There are 23 unique MP3 URLs across these collections.
The film players preserve all 271 published chapter URLs and the separate
iBible film. DBS source links retain access to additional bundle formats.

The interface has 411 Nigerian Pidgin strings, native resource and recording
titles, native download labels, a localized privacy notice, and 66 book names
from the published Bible archive. Phone instructions retain recognizable device
labels such as Files, Downloads, File Transfer and On My iPhone. “If di file
no open” explicitly refers to the file. The interface is a translation draft
requiring native-speaker review; it is not certified by a native reviewer.
The separate computer screenshot guide remains English, with a disclosure.

The Bible HTML ZIP downloaded through the browser and passed complete CRC
checks. It contains 66 books and all 31 verses of Genesis 1. The DBS legacy
app-json-study reader omitted Genesis 1:3–25 from its rendered output, so the
card uses DBS's listed inScript reader and the complete HTML archive instead.
inScript rendered Nigerian Pidgin Scripture successfully. The downloadable
edition keeps DBS's 2012 date. DBS's linked YouVersion page and both Android
app pages loaded; current Wycliffe publisher pages identify a 2020 text edition,
which is not claimed to be the same edition as the 2012 DBS archive.

The GRN low-quality ZIP and Story of Jesus ZIP downloaded through the browser
and passed complete CRC checks, including valid signatures for all 14 and
eight MP3 files respectively. Of 350 binary Range probes, 61 returned recognized
file signatures and 289 refused non-browser requests with HTTP 403. Protected
responses are not counted as successful binary checks. Browser checks loaded
usable media with finite durations for all ten film players, the final chapter
of each of the nine chaptered films, and the JESUS next-chapter transition.
Samples played from both GRN programmes and from the full and first-part Story
of Jesus recordings. This verifies representative playback, not every chapter
or complete viewing/listening. Large film bundles were not downloaded in full;
their additional formats remain accessible through their DBS pages.

Search, filters, scoped email links, native save screens, help and the
computer-to-Android transfer guide were checked. The regular browser viewport
had no horizontal page overflow. The requested phone viewport override did
not apply in this browser, so no phone-sized layout verification is claimed.

The existing 1,230 resource records are unchanged. Existing theology curation
remains in force; no identified LGBTQ-affirming edition or theology was added.
This is an edition/source check, not a verse-by-verse theological assessment.
Publisher exceptions are exact URLs scoped only to Nigerian Pidgin. Rebuild
with `python3 packer/build_nigerian_pidgin.py`, then `npm run dbs:import`.
Audits and browser evidence are retained in
`catalog/source/dbs-*-nigerian-pidgin-2026-10-04.json`.

## Lingala — 4 October 2026

The complete rendered DBS Lingala inventory contains 46 rows and 44 unique
source URLs. It produces 40 resources: 12 films, two audio Bibles, a full text
Bible, two historic scans, two audio collections, 20 GRN programme cards and
one edition directory. Two find.bible references are aliases on the matching
audio Bibles. Duplicate rows are folded. The retired LINBIB audio page is
excluded rather than substituted with a different edition; the public-health
AIDS education programme 81699 is excluded under the Christian-resource scope.
All original URLs are either represented (including aliases) or explained.

The interface has 411 Lingala strings covering controls, help, sharing,
transfer routes and singular counts, plus a localized privacy notice, native
resource/download titles and 66 published Bible book names. “Soki fichier
efungwami te” explicitly refers to a file that does not open. Device labels
such as Files, Downloads, On My iPhone and File Transfer remain recognizable.
This is a translation draft requiring native-speaker review, not a certified
translation. The separate computer screenshot guide remains English and is
explicitly disclosed. The language picker, home page and /lingala, /lin and
/ln routes map UI code ln to content code lin.

Both LINDRC and LINBSC audio selectors contain all 66 Bible books, despite the
older DBS New Testament labels. Both editions divide Malachi into three
chapters; this was confirmed in DBS's own selectors and is preserved through
build and playback. All 1,188 published MP3 chapter URLs per edition returned
recognized binary signatures. The extra canonical Malachi 4 probes returned
404 and are not exposed as missing chapters in these editions. App samples
played from Genesis 1, Malachi 3 and Revelation 22 for both Bibles. Revelation
22 from LINDRC also downloaded through the app save flow as a 2,185,086-byte
MP3 with a valid ID3 header and a Lingala filename.

All 12 film players loaded with finite durations, including the final part of
each of the eight chaptered/partitioned films. Their playlists retain all
194 published parts. JESUS was played through the native video controls.
This checks representative playback and boundaries, not every complete film.
The separate Magdalena director's cut resolves to the observed Mux MP4.
Additional formats remain accessible from the DBS film pages; large film
bundles were not downloaded in full.

The GRN collection retains 332 Christian recordings from 17 programmes,
excluding the 13 public-health tracks. Its original aggregate ZIP includes
those excluded tracks and is not advertised as an app download. The related
Kiyansi: Banningville programme retains its two mixed-language recordings
with explicit scope and descriptions. For the Monjombo and Pomo programmes,
only the one explicitly identified Lingala song file from each is retained.
The other-language files are not presented as Lingala. These four additional
files plus nine Story of Jesus recordings give 345 unique non-Bible MP3 URLs.
The collection and all 20 programme players loaded first/last samples with
finite durations; most were played, with playback states retained in evidence.
GRN programme 34561's publisher page was blocked by the browser, so its card
uses the working DBS collection/recording and preserves the original listed
URL for inventory coverage without promoting a blocked publisher link.

The HTML Bible ZIP and EPUB downloaded through the browser and passed full
CRC checks, each with 66 books. Story of Jesus ZIP likewise passed CRC and
signature checks for all eight part MP3s. inScript rendered Lingala Scripture,
and the linked YouVersion edition page loaded with the correct native Bible
name. PDF signatures were valid for the modern Bible and both historic scans.
The in-app browser's native PDF preview was blank, so native PDF rendering
is not claimed; full PDF links and the working inScript reader are available.
Of 3,753 binary Range probes, 3,540 returned recognized signatures, 211 refused
non-browser requests with HTTP 403, and two were the unused Malachi 4 URLs.
Protected responses are not counted as successful binary checks.

Search, the 12-film filter, native save flow, library/resource clipboard links,
scoped email links, help, nearby role controls and the computer-to-Android
transfer guide were checked. The regular browser viewport had no horizontal
page overflow. No phone-sized layout or two-device transfer is claimed.
Existing theology curation remains in force; no identified LGBTQ-affirming
edition or theology was added. This is an edition/source check, not a
verse-by-verse theological assessment. All 1,245 existing resource records
are unchanged. Exact publisher exceptions and exclusions apply only to
Lingala. Rebuild with `python3 packer/build_lingala.py`, then `npm run dbs:import`.
Audits and browser evidence are retained in
`catalog/source/dbs-*-lingala-2026-10-04.json` and
`catalog/source/dbs-lingala-external-2026-10-04.json`.
