#!/usr/bin/env python3
"""Build Xhosa, Chichewa, Kinyarwanda, Shona, Kirundi, Akan and Tigrinya from their browser audits.

    python3 packer/build_dbs_audit.py            # all seven, and Arabic
    python3 packer/build_dbs_audit.py sna        # one

Arabic is built by build_dbs_arabic.py, which reuses this Shelf.

Each language's DBS page, and every DBS page it links to, was rendered in a
real browser on 2026-10-06 (catalog/source/dbs-audit-<language>-2026-10-06.json).
That audit also holds each film's DBS record, every audio Bible's book and
chapter list, and a ranged browser check of every file. Only files that check
returned as real media are carried. Everything here is hosted by DBS, so these
shelves need no publisher exceptions in curation.py.

Akan is one shelf built from DBS's three Akan pages (aka, twi and fat), so
it holds Asante Twi, Akuapem Twi and Fante; each film and recording names
its dialect.

Tigrinya is one shelf for Eritrea and Ethiopia. DBS lists two dubs of JESUS
(Eritrean and Ethiopian); each names its country. DBS lists no Tigrinya audio
Bible, and its one text edition (TIRTBI) is the New Testament.

Three DBS mistakes are handled rather than copied:

  · Several JESUS pages share one dialect's chapter files (the Kinyarwanda and
    Kinyamulenge pages list the Rufumbira chapters; Shona lists Karanga). A
    chapter set stays only on the page whose own folder holds it; the others
    keep their own full film.
  · Moved audio Bible pages ("This audio bible has moved") are left out; DBS
    points readers to the current editions, which are carried.
  · DBS's Fante GRN collection holds the same Twi programme files as its Twi
    collection, so those programmes are carried once.

DBS's Tigrinya StoryRunners page links 18 of its 42 stories under file names
its server does not hold (they return 404 however the name is spelled); the
other 24 are carried and the missing ones are listed in notCarried.
"""
import json
import pathlib
import re
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATE = '2026-10-06'

OT = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
      '1Samuel', '2Samuel', '1Kings', '2Kings', '1Chronicles', '2Chronicles', 'Ezra', 'Nehemiah',
      'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'SongofSongs', 'Isaiah', 'Jeremiah',
      'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
      'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi']
NT = ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1Corinthians', '2Corinthians',
      'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1Thessalonians', '2Thessalonians',
      '1Timothy', '2Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1Peter', '2Peter',
      '1John', '2John', '3John', 'Jude', 'Revelation']
BOOKS = OT + NT

# Every reader-facing word below is in the shelf's own language. `chapter` is a
# film or Bible chapter, `part` one recording in a programme.
LANGS = {
    'xho': dict(slug='xhosa', ui='xh', name='Xhosa', native='isiXhosa', region='South Africa',
                speakers='~8.2 million',
                blurb='IiBhayibhile, iifilimu neerekhodingi zobuKristu ngesiXhosa.',
                chapter='Isahluko', part='Inxalenye', view='Bona kwi-DBS',
                full='Ifilimu epheleleyo (MP4)', chapters_zip='Zonke izahluko (ZIP)',
                tracks_zip='Zonke iirekhodingi (ZIP)', pdf='Incwadi (PDF)',
                film_desc='Ifilimu esekelwe eBhayibhileni ngesiXhosa.',
                film_desc_chapters='Ifilimu esekelwe eBhayibhileni ngesiXhosa. Khetha isahluko ofuna ukusibukela okanye ukusigcina.',
                deaf_desc='Ivangeli ngolwimi lwezandla lwabangevayo, ekhutshwe kunye neXhosa kwi-DBS.',
                historic_desc='Ushicilelo oludala olukhutshelwe kwi-PDF. Upelo lwamagama lunokwahluka kolwanamhlanje.',
                grn_desc='Amabali eBhayibhile, iingoma nemiyalezo yobuKristu erekhodiweyo ngu-Global Recordings Network.',
                ),
    'nya': dict(slug='chichewa', ui='ny', name='Chichewa', native='Chichewa', region='Malawi & Zambia',
                speakers='~14.4 million',
                blurb='Baibulo, mafilimu ndi zomvetsera zachikhristu m’Chichewa (Chinyanja).',
                chapter='Mutu', part='Gawo', view='Onani pa DBS',
                full='Filimu yonse (MP4)', chapters_zip='Mitu yonse (ZIP)',
                tracks_zip='Zomvetsera zonse (ZIP)', pdf='Buku (PDF)',
                film_desc='Filimu yochokera m’Baibulo m’Chichewa.',
                film_desc_chapters='Filimu yochokera m’Baibulo m’Chichewa. Sankhani mutu woti muonere kapena kusunga.',
                deaf_desc='Uthenga Wabwino m’chinenero cha manja cha anthu osamva, wotulutsidwa pamodzi ndi Chichewa pa DBS.',
                historic_desc='Buku lakale losindikizidwa, lojambulidwa kukhala PDF. Kalembedwe ka mawu kakhoza kusiyana ndi ka lero.',
                grn_desc='Nkhani za m’Baibulo, nyimbo ndi mauthenga achikhristu ojambulidwa ndi Global Recordings Network.',
                ),
    'kin': dict(slug='kinyarwanda', ui='rw', name='Kinyarwanda', native='Ikinyarwanda', region='Rwanda',
                speakers='~12.1 million',
                blurb='Bibiliya, filime n’amajwi bya gikristo mu Kinyarwanda.',
                chapter='Igice', part='Igice', view='Reba kuri DBS',
                full='Filime yose (MP4)', chapters_zip='Ibice byose (ZIP)',
                tracks_zip='Amajwi yose (ZIP)', pdf='Igitabo (PDF)',
                film_desc='Filime ishingiye kuri Bibiliya mu Kinyarwanda.',
                film_desc_chapters='Filime ishingiye kuri Bibiliya mu Kinyarwanda. Hitamo igice ushaka kureba cyangwa kubika.',
                deaf_desc='Ubutumwa bwiza mu rurimi rw’amarenga rw’abatumva, bwashyizwe hamwe n’Ikinyarwanda kuri DBS.',
                historic_desc='Igitabo cya kera cyacapwe, cyafotowe kiba PDF.',
                grn_desc='Inkuru za Bibiliya, indirimbo n’ubutumwa bya gikristo byafashwe amajwi na Global Recordings Network.',
                ),
    'sna': dict(slug='shona', ui='sn', name='Shona', native='chiShona', region='Zimbabwe & Mozambique',
                speakers='~7.2 million',
                blurb='Bhaibheri, mafirimu nezvinonzwika zvechiKristu muchiShona.',
                chapter='Chitsauko', part='Chikamu', view='Ona paDBS',
                full='Firimu rose (MP4)', chapters_zip='Zvitsauko zvose (ZIP)',
                tracks_zip='Zvose zvakarekodhwa (ZIP)', pdf='Bhuku (PDF)',
                film_desc='Firimu rinobva muBhaibheri muchiShona.',
                film_desc_chapters='Firimu rinobva muBhaibheri muchiShona. Sarudza chitsauko chaunoda kuona kana kuchengeta.',
                deaf_desc='Evhangeri nemutauro wezviratidzo wematsi, yakaburitswa pamwe chete nechiShona paDBS.',
                historic_desc='Bhuku rekare rakadhindwa, rakatorwa mifananidzo kuva PDF. Kunyorwa kwemamwe mazwi kunogona kusiyana nekwanhasi.',
                grn_desc='Nyaya dzeBhaibheri, nziyo nemashoko echiKristu zvakarekodhwa neGlobal Recordings Network.',
                ),
    'run': dict(slug='kirundi', ui='rn', name='Kirundi', native='Ikirundi', region='Burundi',
                speakers='~10.8 million',
                blurb='Bibiliya, filime n’amajwi vy’Ubutumwa Bwiza mu Kirundi.',
                chapter='Igice', part='Igice', view='Raba kuri DBS',
                full='Filime yose (MP4)', chapters_zip='Ibice vyose (ZIP)',
                tracks_zip='Amajwi yose (ZIP)', pdf='Igitabu (PDF)',
                film_desc='Filime ishingiye kuri Bibiliya, mu Kirundi.',
                film_desc_chapters='Filime ishingiye kuri Bibiliya, mu Kirundi. Hitamwo igice ushaka kuraba canke kubika.',
                deaf_desc='Ubutumwa Bwiza mu rurimi rw’ibimenyetso rw’abatumva, buri ku rutonde rw’Ikirundi kuri DBS.',
                historic_desc='',
                grn_desc='Inkuru za Bibiliya, indirimbo n’inyigisho z’Ubutumwa Bwiza vyafashwe amajwi na Global Recordings Network.',
                plain=('kirundi', 'rundi'),
                ),
    'aka': dict(slug='akan', ui='ak', name='Akan', native='Twi (Akan)', region='Ghana',
                speakers='~11 million',
                blurb='Twerɛ Kronkron, sini, ne Kristosom nsɛm a wobɛtie, wɔ Twi ne Fante mu.',
                chapter='Ti', part='Ɔfa', view='Hwɛ wɔ DBS so',
                full='Sini no nyinaa (MP4)', chapters_zip='Ti no nyinaa (ZIP)',
                tracks_zip='Nne a wɔakyere no nyinaa (ZIP)', pdf='Nwoma (PDF)',
                film_desc='Sini a egyina Twerɛ Kronkron so, wɔ Akan kasa mu.',
                film_desc_chapters='Sini a egyina Twerɛ Kronkron so, wɔ Akan kasa mu. Yi ti a wopɛ sɛ wohwɛ anaa wokora.',
                deaf_desc='',
                historic_desc='Tete nwoma a wɔatintim, na wɔayɛ no PDF. Ebia nsɛmfua bi kyerɛw kwan nte sɛ nnɛ deɛ.',
                grn_desc='Twerɛ Kronkron mu nsɛm, nnwom ne Kristofo nkra a Global Recordings Network akyere.',
                plain=('twi',),
                ),
    'tir': dict(slug='tigrinya', ui='ti', name='Tigrinya', native='ትግርኛ', region='Eritrea & Ethiopia',
                speakers='~9.9 million',
                blurb='መጽሓፍ ቅዱስ፣ ፊልምታትን ናይ ክርስትና ናይ ድምጺ ቅዳሓትን ብትግርኛ።',
                chapter='ምዕራፍ', part='ክፋል', view='ኣብ DBS ርኣዩ',
                full='ምሉእ ፊልም (MP4)', chapters_zip='ኩለን ምዕራፋት (ZIP)',
                tracks_zip='ኩሎም ቅዳሓት (ZIP)', pdf='መጽሓፍ (PDF)',
                film_desc='ኣብ መጽሓፍ ቅዱስ ዝተመርኮሰ ፊልም ብትግርኛ።',
                film_desc_chapters='ኣብ መጽሓፍ ቅዱስ ዝተመርኮሰ ፊልም ብትግርኛ። ክትርእይዎ ወይ ክትዕቅብዎ እትደልዩ ምዕራፍ ምረጹ።',
                deaf_desc='',
                historic_desc='ቀደም ዝተሓትመ መጽሓፍ፡ ብስካን ናብ PDF ዝተቐየረ። ኣጻሕፋ ገለ ቃላት ካብ ናይ ሎሚ ክፈላለ ይኽእል።',
                grn_desc='ዛንታታት መጽሓፍ ቅዱስ፣ መዝሙራትን ናይ ክርስትና መልእኽትታትን፡ ብGlobal Recordings Network ዝተቐድሑ።',
                plain=('tigrinya', 'tigrigna'), script='ethi', font='ethiopic',
                ),
}

# Tigrinya films name the country of their dub: by the folder in the DBS address.
COUNTRY = {'tigrinya-eritrea': ('Eritrea', 'ኤርትራ'), 'tigrinya-ethiopia': ('Ethiopia', 'ኢትዮጵያ')}

# Akan dialects, by the name in each DBS page or file address.
DIALECT = {'asante-twi': 'Asante Twi', 'akan-asante': 'Asante Twi', 'akan-akuapem-twi': 'Akuapem Twi',
           'fante': 'Fante', 'twi': 'Twi'}

# Book names come from the interface's own LOCAL_BOOKS, so a film, an audio
# Bible and the book picker all say the same thing.
def local_books():
    src = (ROOT / 'app/assets/js/core.js').read_text()
    out = {}
    for ui in ('xh', 'ny', 'rw', 'sn', 'rn', 'ak', 'ti', 'ar'):
        block = re.search(r'\n    ' + ui + r': (\{.*?\n\})', src, re.S)[1]
        out[ui] = json.loads(block)
    return out

LOCAL = local_books()

# Film titles, by the DBS film series in each page's address.
def film_native(code, series, meta):
    b = LOCAL[LANGS[code]['ui']]
    gospel = {
        'xho': lambda n: 'Ivangeli ngokuka' + n,
        'nya': lambda n: 'Uthenga Wabwino wa ' + n,
        'kin': lambda n: 'Ivanjili uko yanditswe na ' + n,
        'sna': lambda n: 'Evhangeri ya' + n,
        'run': lambda n: 'Ubutumwa Bwiza nk’uko bwanditswe na ' + n,
        'aka': lambda n: n + ' Asɛmpa',
        'tir': lambda n: 'ወንጌል ' + n,
    }[code]
    words = {
        'jesus': {'xho': 'UYesu', 'nya': 'Yesu', 'kin': 'Yesu', 'sna': 'Jesu', 'run': 'Yesu', 'aka': 'Yesu',
                  'tir': 'ኢየሱስ'},
        'savior': {'tir': 'መድሓኒ'},
        'magdalena': {'xho': 'Magdalena', 'nya': 'Magdalena', 'kin': 'Magdalena', 'sna': 'Magdalena',
                      'run': 'Magdalena', 'aka': 'Magdalena', 'tir': 'መግደላዊት'},
        'storyjesus': {'xho': 'Ibali likaYesu labantwana', 'nya': 'Nkhani ya Yesu ya Ana',
                       'kin': 'Inkuru ya Yesu y’Abana', 'sna': 'Nyaya yaJesu yeVana',
                       'run': 'Inkuru ya Yesu y’abana', 'tir': 'ዛንታ ኢየሱስ ንቖልዑ'},
        'deafproject': {'xho': 'Ivangeli ngolwimi lwezandla', 'nya': 'Uthenga Wabwino m’chinenero cha manja',
                        'kin': 'Ubutumwa bwiza mu rurimi rw’amarenga', 'sna': 'Evhangeri nemutauro wezviratidzo',
                        'run': 'Ubutumwa Bwiza mu rurimi rw’ibimenyetso'},
        'lumo-covenant': {'xho': 'LUMO: UMnqophiso', 'nya': 'LUMO: Pangano', 'kin': 'LUMO: Isezerano',
                          'sna': 'LUMO: Sungano', 'aka': 'LUMO: Apam no'},
        'bp': {'kin': 'BibleProject: Incamake z’ibitabo bya Bibiliya'},
        'rock': {'nya': 'Mfumu ya Ulemelero'},
    }
    if series in words:
        return words[series][code]
    m = re.match(r'lumo-(matthew|mark|luke|john)$', series)
    if m:
        return 'LUMO: ' + gospel(b[m[1].title()])
    if series == 'john':
        return gospel(b['John'])
    if series == 'lumo-acts':
        return 'LUMO: ' + b['Acts']
    if series in ('matthew', 'acts_vb'):
        bible_film = {'xho': 'IBhayibhile ngefilimu', 'nya': 'Baibulo mu filimu',
                      'kin': 'Bibiliya mu mashusho', 'sna': 'Bhaibheri mufirimu',
                      'run': 'Bibiliya mu mashusho', 'aka': 'Twerɛ Kronkron a wɔayɛ no sini',
                      'tir': 'መጽሓፍ ቅዱስ ብፊልም'}[code]
        return bible_film + ': ' + b['Matthew' if series == 'matthew' else 'Acts']
    if series == 'ibible':
        return 'iBible: ' + meta['title_vernacular'].replace("'", '’')
    raise ValueError(series)

# Global Recordings programme names. Titles already in the language stay.
GRN = {
    'Good News': {'xho': 'Iindaba Ezilungileyo', 'nya': 'Uthenga Wabwino', 'kin': 'Inkuru Nziza', 'sna': 'Mashoko Akanaka'},
    'Words of Life': {'xho': 'Amazwi oBomi', 'nya': 'Mawu a Moyo', 'kin': 'Amagambo y’Ubugingo', 'sna': 'Mashoko eUpenyu'},
    'Words of Life for Children': {'xho': 'Amazwi oBomi abantwana'},
    'The Living Christ': {'xho': 'UKristu Ophilayo'},
    'Songs by Newborn Gospel Choir w Sesotho': {'xho': 'Iingoma zeNewborn Gospel Choir (kunye nesiSuthu)'},
    'Songs': {'sna': 'Nziyo'},
    'Testimony Songs': {'run': 'Ubuhamya n’indirimbo'},
    'Ikiganiro Co Gukomeza Imitima': {'run': 'Ikiganiro co gukomeza imitima'},
    'Portrait of Jesus': {'aka': 'Sɛnea Yesu te'},
    'Asempa': {'aka': 'Asɛmpa'},
}
GRN['Good News'].update(run='Inkuru Nziza', aka='Asɛmpa')
GRN['Words of Life'].update(run='Amajambo y’Ubuzima', aka='Nkwa Nsɛm', tir='ቃላት ሕይወት')
GRN['Eta Mealtj Keriba Ala'] = {'tir': 'እታ መዓልቲ ቀሪባ ኣላ'}
# English titles for programmes GRN names only in the language.
GRN_TITLE = {'Eta Mealtj Keriba Ala': 'The Day Is Coming'}
LLL = {  # Look, Listen & Live 1-8
    'xho': ('Jonga, Mamela, Phila', ['Ukuqala noThixo', 'Amadoda kaThixo anamandla', 'Uloyiso ngoThixo',
            'Abakhonzi bakaThixo', 'Ukuvavanywa ngenxa kaThixo', 'UYesu, uMfundisi noMphilisi',
            'UYesu, iNkosi noMsindisi', 'Izenzo zoMoya oyiNgcwele']),
    'nya': ('Penya, Mvera, Khala ndi Moyo', ['Chiyambi ndi Mulungu', 'Anthu amphamvu a Mulungu',
            'Kupambana mwa Mulungu', 'Atumiki a Mulungu', 'Kuzengedwa mlandu chifukwa cha Mulungu',
            'Yesu, Mphunzitsi ndi Mchiritsi', 'Yesu, Ambuye ndi Mpulumutsi', 'Ntchito za Mzimu Woyera']),
    'kin': ('Reba, Umva, Ubeho', ['Gutangirana n’Imana', 'Abagabo b’intwari b’Imana', 'Gutsinda ku bw’Imana',
            'Abagaragu b’Imana', 'Kugeragezwa ku bw’Imana', 'Yesu, Umwigisha n’Umukiza w’indwara',
            'Yesu, Umwami n’Umukiza', 'Ibyakozwe n’Umwuka Wera']),
    'sna': ('Tarisa, Teerera, Rarama', ['Kutanga naMwari', 'Varume vane simba vaMwari', 'Kukunda kubudikidza naMwari',
            'Varanda vaMwari', 'Kutongwa nokuda kwaMwari', 'Jesu, Mudzidzisi noMurapi',
            'Jesu, Ishe noMuponesi', 'Mabasa oMweya Mutsvene']),
    'run': ('Raba, Wumve, Ubeho', ['Gutangura n’Imana', 'Abagabo b’intwari b’Imana', 'Gutsinda ku bw’Imana',
            'Abasavyi b’Imana', 'Gucirwa urubanza bazira Imana', 'Yesu, Umwigisha n’Umuvuzi',
            'Yesu, Umwami n’Umukiza', 'Ivyakozwe na Mpwemu Yera']),
    'aka': ('Hwɛ, Tie, na Nya Nkwa', ['Yɛde Onyankopɔn Fi Ase', 'Onyankopɔn Akatakyie', 'Nkonim a ɛnam Onyankopɔn so',
            'Onyankopɔn nkoa', 'Wɔbuu wɔn atɛn Onyankopɔn nti', 'Yesu, Ɔkyerɛkyerɛfoɔ ne Ɔyaresafoɔ',
            'Yesu, Awurade ne Agyenkwa', 'Honhom Kronkron Nnwuma']),
    'tir': ('ርኣ፣ ስማዕ፣ ንበር', ['ምስ ኣምላኽ ምጅማር', 'ሓያላት ሰብኡት ኣምላኽ', 'ብኣምላኽ ዝመጽእ ዓወት',
            'ኣገልገልቲ ኣምላኽ', 'ምእንቲ ኣምላኽ ኣብ ፍርዲ', 'ኢየሱስ፡ መምህርን ፈዋስን',
            'ኢየሱስ፡ ጐይታን መድሓኒን', 'ግብሪ መንፈስ ቅዱስ']),
}

# Programmes DBS lists without anything that shows they are Christian.
# The library's rule (curation.py) is to leave such items out.
EXCLUDED = {
    'kin': {
        'https://globalrecordings.net/en/program/67900': 'GRN “Ikaze muri Leta Zunze Ubumwe za Amerika” is a resettlement welcome, not a Christian resource.',
        'https://globalrecordings.net/en/program/85249': 'GRN “Helper” gives no subject; not confirmed as a Christian resource.',
        'https://globalrecordings.net/en/program/79090': 'GRN “Filmstrip” tracks are untitled messages; not confirmed as a Christian resource.',
        'https://globalrecordings.net/en/program/81791': 'GRN “Songs” tracks are untitled; not confirmed as Christian songs.',
    },
    'run': {
        'https://globalrecordings.net/en/program/67169': 'GRN “Kaze muri Leta zunze Ubumwe za Amerika” is a resettlement welcome (withdrawn by GRN), not a Christian resource.',
    },
}
EXCLUDED_IDS = {u.rsplit('/', 1)[1] for v in EXCLUDED.values() for u in v}


TRADITIONAL = {
    'nya': ['https://dbs.org/bibles/audio/NYACCB.00333_DAVR_FB_N', 'https://dbs.org/bibles/audio/NYACCB.15171_FCBH_NP_N'],
    'sna': ['https://dbs.org/bibles/SNAOLD', 'https://dbs.org/bibles/audio/SNABSZ_FCBH_NT_N'],
    # The Bible Society of Burundi New Testament (the Guillebaud line).
    'run': ['https://dbs.org/bibles/RUNBSB'],
    # Bible Society of Ghana editions: Asante Twi, Akuapem, the 1964 Asante
    # New Testament and Psalms, and the Mfantse Bible.
    'aka': ['https://dbs.org/bibles/audio/TWIBSG.00360_DAVR_FB_N', 'https://dbs.org/bibles/audio/AKABSG_FCBH_FB_N',
            'https://dbs.org/bibles/audio/AKAUBS_FCBH_NT_N', 'https://dbs.org/bibles/audio/TWINTP_DAVR_FB_N',
            'https://dbs.org/bibles/audio/FATBSG_DAVR_OT_N'],
    # The Bible Society of Ethiopia New Testament.
    'tir': ['https://dbs.org/bibles/TIRTBI'],
}

# Akan editions, by DBS fileset or ID: the dialect, and a native title where
# DBS gives none or a garbled one.
AKAN_EDITIONS = {
    'AKABIB': ('Asante Twi', 'Nkwa Asɛm: Apam Foforɔ ne Nnwom'),
    'AKABSG': ('Akuapem Twi', 'Kyerɛw Kronkron'),
    'AKAAKA': ('Akuapem Twi', 'Nkwa Asɛm'),
    'AKAUBS': ('Asante Twi', 'Apam Foforɔ (1964)'),
    'TWIBIB.02272': ('Akuapem Twi', 'Nkwa Asɛm'),
    'TWINTP': ('Twi', 'Twerɛ Kronkron (1964)'),   # DBS's title says NT and Psalms; the audio is all 66 books
    'TWIBSG.00360': ('Asante Twi', 'Twerɛ Kronkron'),
    'FATBSG': ('Fante', 'Baebol Mfantse'),
    'AKAOCB': ('Asante Twi', 'Nkwa Asɛm'),
    'TWIOCB': ('Akuapem Twi', 'Nkwa Asɛm'),
}
# DBS's own subtitles for the Akan scans are machine-made; these say what each is.
AKAN_SCANS = {
    'Akan-1964-Genesis-Portion-Mose-Nhoma-a-Edi-Kan-Anaa': '1 Mose (1964)',
    'Akuapem-Bible-book': 'Kyerɛw Kronkron, Akuapem (1871)',
    'Akuapem-New-Testament-book': 'Apam Foforɔ, Akuapem (1870)',
    'Asante-1905-New-Testament-Fante-Tshi': 'Apam Foforɔ, Asante (1905, Fante ne Twi)',
    'Asante-Bible-book': 'Twerɛ Kronkron, Asante (1964)',
    'Asante-Bible-Gospel-of-John': 'Yohane Asɛmpa, Asante (bɛyɛ 1870)',
    'Asante-Bible-New-Testament': 'Apam Foforɔ, Asante (1905)',
    'Twi-Asante-1964-Genesis-Portion': '1 Mose, Asante Twi (1964)',
    'Fante-John-print': 'Yohan, Mfantse',
}
# DBS's subtitles for the Tigrinya scans mix scripts ("ጀኔሲስ ክፍል", "ንዉድ ኪዳን").
TIGRINYA_SCANS = {
    'Tigrigna-1998-Genesis-Portion': 'ዘፍጥረት (1998)',
    'Tigrinya-New-Testament-book': 'ሓድሽ ኪዳን (ትርጉም 1909)',
}
# StoryRunners' Tigrinya file names: a few are in Amharic, cut short or misspelt.
STORY_TITLES = {'tir': {
    0: 'ጉጅለ ዛንታ ብኸመይ ትመርሑ', 10: 'ኢየሱስ ብናሕሲ ንዘውረድዎ ሰብኣይ ፈወሶ',
    20: 'ምምላስ እቲ ዝጠፍአ ወዲ', 28: 'እግዚኣብሄር መንፈሱ ይህብ',
    30: 'መራሕቲ ሃይማኖት ንሃዋርያት ጴጥሮስን ዮሃንስን ኣፈራርሕዎም', 32: 'ፊልጶስን እቲ ኢትዮጵያውን',
    33: 'ድሕነት ሃዋርያ ጳውሎስ', 39: 'ኢየሱስን ሳምራዊት ሰበይትን (መዝሙር)', 40: 'ኣምላኽ መንፈሱ ይህብ (መዝሙር)',
}}


def secure(u):
    return 'https://' + u[len('http://'):] if u.startswith('http://') else u


class Shelf:
    def __init__(self, code):
        self.code, self.L = code, LANGS[code]
        self.date = self.L.get('date', DATE)
        self.audit = json.loads((ROOT / f"catalog/source/dbs-audit-{self.L['slug']}-{self.date}.json").read_text())
        self.files = self.audit['files']
        self.out = []
        self.missing = {}
        self.listed = {r['url']: r['label'] for rows in self.audit['sections'].values() for r in rows}

    def ok(self, u):
        return bool((self.files.get(u) or {}).get('valid'))

    def make(self, slug, kind, title, native, source, org, desc, **extra):
        r = dict(id=f'{self.code}-{slug}', lang=self.code, type=kind, title=title, native=native,
                 langName=self.L['native'], source=source, org=org, desc=desc, downloads=[],
                 links=[{'url': source, 'label': self.L['view']}], **extra)
        self.out.append(r)
        return r

    def download(self, r, u, label):
        u = secure(u)
        assert self.ok(u), u
        if all(d['url'] != u for d in r['downloads']):
            r['downloads'].append({'url': u, 'label': label})

    # ------------------------------------------------------------ Bibles
    def year(self, url):
        m = re.search(r'\b(1[89]\d\d|20\d\d) · ', self.listed.get(url, ''))
        return int(m[1]) if m else None

    def text_bible(self, url, page):
        abbr = url.rsplit('/', 1)[1]
        label = self.listed[url]
        title = label.split(' ' + abbr)[0].strip().rstrip(',')
        native = re.split(r' (Read|Study|Download|Audio|Print) ', label.split(abbr, 1)[1] + ' ')[0].strip()
        native = native if native and native != abbr else {'SNAIBS': 'Bhaibheri muchiShona'}.get(abbr, title)
        dialect = None
        if abbr in AKAN_EDITIONS:
            dialect, native = AKAN_EDITIONS[abbr]
        # RUNBSB's "Bibliya Yera" file holds the New Testament only (checked in the
        # EPUB and PDF: Matayo to Ivyahishuriwe). Its John 1:1 reads "uwo Jambo yari
        # Imana", the Bible Society text, whatever DBS's About paragraph says.
        if abbr == 'RUNBSB':
            native = 'Bibiliya Yera: Isezerano Rishasha'
        # TIRTBI holds the 27 New Testament books only (checked in the EPUB).
        if abbr == 'TIRTBI':
            native = 'መጽሓፍ ቅዱስ: ሓድሽ ኪዳን'
        files = list(dict.fromkeys(l['url'] for l in page['links']))
        org = {'NYAOGW': 'Biblica', 'SNAIBS': 'Bible Society of Zimbabwe',
               'SNAOLD': 'British and Foreign Bible Society', 'RUNBSB': 'Bible Society of Burundi',
               'AKAOCB': 'Biblica', 'TWIOCB': 'Biblica',
               'TIRTBI': 'Bible Society of Ethiopia'}.get(abbr, 'Digital Bible Society')
        bible = {'xho': 'IBhayibhile', 'nya': 'Baibulo', 'kin': 'Bibiliya', 'sna': 'Bhaibheri',
                 'run': 'Isezerano Rishasha', 'aka': 'Twerɛ Kronkron', 'tir': 'ሓድሽ ኪዳን'}[self.code]
        desc = {
            'nya': 'Baibulo lonse m’Chichewa. Werengani mu pulogalamu kapena sungani PDF, EPUB kapena HTML.',
            'sna': 'Bhaibheri rose muchiShona. Rinogona kuverengwa pasina indaneti kana rachengetwa.',
            'run': 'Isezerano Rishasha ryose mu Kirundi. Risome muri porogaramu canke ubike PDF, EPUB canke HTML.',
            'aka': 'Twerɛ Kronkron no nyinaa wɔ ' + (dialect or 'Twi') + ' mu. Wobɛtumi akenkan wɔ app no mu anaa akora.',
            'tir': 'ምሉእ ሓድሽ ኪዳን ብትግርኛ። ኣብቲ ኣፕ ኣንብብዎ፡ ወይ PDF፣ EPUB ወይ HTML ዓቅቡ።',
        }[self.code]
        r = self.make('text-' + abbr.lower(), 'scripture', title, native, url, org, desc,
                      year={'NYAOGW': 2016, 'SNAOLD': 1949}.get(abbr) or self.year(url))
        if dialect:
            r['scope'] = dialect
            if dialect != 'Twi':
                r['langName'] = f"{self.L['native']} · {dialect}"
        pdf = next((u for u in files if u.endswith('.pdf') and self.ok(u)), None)
        cand = [f'https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf', f'https://bibles.dbs.org/{abbr}/epub/{abbr}.epub',
                f'https://bibles.dbs.org/{abbr}/html_{abbr}.zip']
        pdf = pdf or (cand[0] if self.ok(cand[0]) else None)
        if pdf:
            r['read'] = {'kind': 'pdf', 'url': pdf}
            self.download(r, pdf, bible + ' (PDF)')
        if self.ok(cand[1]):
            self.download(r, cand[1], bible + ' (EPUB)')
        if self.ok(cand[2]):
            offline = {'nya': 'Baibulo lowerenga popanda intaneti (HTML ZIP)',
                       'sna': 'Bhaibheri rinoverengwa pasina indaneti (HTML ZIP)',
                       'run': 'Isezerano Rishasha ryo gusoma ata interineti (HTML ZIP)',
                       'aka': 'Twerɛ Kronkron a wobɛkenkan bere a intanɛt nni hɔ (HTML ZIP)',
                       'tir': 'ብዘይ ኢንተርነት ዝንበብ ሓድሽ ኪዳን (HTML ZIP)'}[self.code]
            self.download(r, cand[2], offline)
        study = f'https://bibles.dbs.org/{abbr}/app-json-study/index.html'
        if any(l['url'] == study for l in page['links']):
            r['links'].append({'url': study, 'label': {'nya': 'Werengani pa intaneti', 'sna': 'Verenga paindaneti',
                                                     'run': 'Soma kuri interineti', 'aka': 'Kenkan wɔ intanɛt so',
                                                     'tir': 'ብኢንተርነት ኣንብቡ'}[self.code]})

    def audio_bible(self, url, page):
        info = self.audit['audio_bibles'].get(url) or {}
        if not info.get('books'):
            return False      # a moved edition: DBS lists its replacements, carried below
        assert not info['bad'], url
        books = info['books']
        fileset = url.rsplit('/', 1)[1]
        dirs = []
        keys, names, counts = [], {}, {}
        for b in books:
            m = re.search(r'/cdn/audio/[^/]+/((OT|NT)_[^/]+)/(\d\d)_([^/]+)/', b['sample'])
            if m[1] not in dirs:
                dirs.append(m[1])
            key = BOOKS[int(m[3]) - 1]
            assert m[4] == key, (m[4], key)
            keys.append(key)
            name = b['name']
            local = LOCAL[self.L['ui']][key]
            if self.code == 'aka' and (name.isupper() or name == key or name.replace(' ', '').lower() == key.lower()):
                # Akan editions spell names their own way (Akuapem "Atemmufoɔ"),
                # so a capitalised name keeps its spelling; the Fante Old
                # Testament lists only English keys, which take the Twi names.
                name = local if name.replace(' ', '').lower() == key.lower() else \
                    ' '.join(w if w[0].isdigit() else w[:2] + w[2:].lower() if w[0] == '(' else w[:1] + w[1:].lower()
                             for w in name.split(' '))
            elif name.lower() == local.lower():
                name = local      # DBS capitalises every word ("Gusubira Mu Vyagezwe")
            # DBS writes a few names in capitals; use the interface's form.
            names[key] = local if name.isupper() or ',' in name else name
            counts[key] = len(b['chapters'])
        testaments = [t for t in ('OT', 'NT') if any(d.startswith(t + '_') for d in dirs)]
        version = dirs[0].split('_', 1)[1]
        label = self.listed[url]
        abbr = fileset.split('_', 1)[0]
        title = label.split(' ' + abbr)[0].strip()
        native = re.split(r' Audio · ', label.split(abbr, 1)[1])[0].strip() or None
        org = 'Faith Comes By Hearing' if '_FCBH_' in fileset else 'Davar Partners International'
        scope_words = {
            'xho': None,
            'nya': ('Baibulo lonse', 'Chipangano Chatsopano', 'Uthenga Wabwino wa Luka'),
            'kin': ('Bibiliya yose', 'Isezerano Rishya', None),
            'sna': (None, 'Testamende Itsva', None),
            'run': ('Bibiliya yose', 'Isezerano Rishasha', None),
            'aka': ('Twerɛ Kronkron no nyinaa', 'Apam Foforɔ', None),
        }[self.code]
        whole = 'OT' in testaments and len(keys) == 66
        what = scope_words[0] if whole else scope_words[2] if keys == ['Luke'] else scope_words[1]
        if self.code == 'aka' and testaments == ['OT']:
            what = 'Apam Dedaw'
        listen = {'nya': 'Mvetserani', 'kin': 'Umva', 'sna': 'Teerera', 'run': 'Umviriza', 'aka': 'Tie'}[self.code]
        count = sum(counts.values())
        desc = {
            'nya': f'{what} momvetsera: mabuku {len(keys)}, mitu {count}. Sankhani buku ndi mutu woti mumvetsere kapena kusunga.',
            'kin': f'{what} mu majwi: ibitabo {len(keys)}, ibice {count}. Hitamo igitabo n’igice ushaka kumva cyangwa kubika.',
            'sna': f'{what} inonzwika: mabhuku {len(keys)}, zvitsauko {count}. Sarudza bhuku nechitsauko chaunoda kuteerera kana kuchengeta.',
            'run': f'{what} mu majwi: ibitabu {len(keys)}, ibice {count}. Hitamwo igitabu n’igice ushaka kwumviriza canke kubika.',
            'aka': f'{what} a wobɛtie: nwoma {len(keys)}, ati {count}. Yi nwoma ne ti a wopɛ sɛ wotie anaa wokora.',
        }[self.code]
        dialect = None
        if self.code == 'aka':
            dialect, native = AKAN_EDITIONS[abbr]
        native = native or what
        if keys == ['Luke']:
            native = f'{native} — {LOCAL[self.L["ui"]]["Luke"]}'
        # The DBS row gives 2001 for the edition it titles "2004 Kinyarwanda Bible".
        year = {'KINBIR_DAVR_FB_N': 2004}.get(fileset, self.year(url))
        r = self.make('ab-' + fileset.lower().replace('.', '-').replace('_', '-'), 'audio-bible', title,
                      native, url, org, desc, year=year)
        if dialect:
            r['scope'] = dialect
            if dialect != 'Twi':
                r['langName'] = f"{self.L['native']} · {dialect}"
        play = {'kind': 'audio-bible', 'fileset': fileset, 'version': version, 'testaments': testaments,
                'bookNames': names, 'saveChapter': True}
        if len(keys) not in (27, 39, 66):
            play['books'] = keys
        r['play'] = play
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                zipname = {'nya': 'Mitu yonse (ZIP)', 'kin': 'Ibice byose (ZIP)', 'sna': 'Zvitsauko zvose (ZIP)',
                           'run': 'Ibice vyose (ZIP)', 'aka': 'Ati no nyinaa (ZIP)'}[self.code]
                self.download(r, l['url'], zipname)
        return True

    # ------------------------------------------------------------ films
    def film(self, url, page):
        meta = self.audit['films'][url]
        series, ident = url.split('/video/', 1)[1].split('/', 1)
        L = self.L
        native = film_native(self.code, series, meta)
        title = meta['title'] if meta['title'] != 'The Story of Jesus for Children' else 'Story of Jesus for Children'
        if series.startswith('lumo-') and not title.startswith('LUMO'):
            title = 'LUMO: ' + title
        # Name the dialect where one shelf carries several dubs of one film.
        dialect = re.match(r'[a-z]{3}_([a-z]+)_', ident)
        scope = None
        if self.code == 'aka':
            # Every Akan film is one dialect's dub; DBS's Twi Visual Bible names it last.
            scope = next((v for k, v in sorted(DIALECT.items(), key=lambda kv: -len(kv[0]))
                          if ident[4:].startswith(k)), 'Twi')
        elif self.code == 'tir':
            country = next((v for k, v in COUNTRY.items() if ident[4:].startswith(k)), None)
            scope = country and country[0]
        elif dialect and dialect[1] not in ('xhosa', 'chichewa', 'kinyarwanda', 'shona', 'kirundi'):
            scope = dialect[1].title()
        if scope:
            title += f' ({scope})'
            native += f" ({country[1] if self.code == 'tir' else scope})"
        if self.code == 'tir' and title == 'Gospel of John':
            title = 'The Gospel of John'
        own_folder = '/' + ident.rsplit('_', 1)[0] + '/' if series == 'jesus' else None
        items = [i for s in meta['sections'] for i in s['items']]
        chapters = []
        for i in items:
            u = (i['media'] or {}).get('low') or (i['media'] or {}).get('high')
            if not u or not self.ok(u):
                continue
            if own_folder and own_folder not in u:
                continue      # another dialect's chapters, misfiled on this page
            chapters.append((i['n'], u, i.get('title')))
        full = meta['full'][0]['media'] if meta['full'] else {}
        sd = (full.get('low') or {}).get('url')
        hd = (full.get('high') or {}).get('url')
        sd, hd = (sd if sd and self.ok(sd) else None), (hd if hd and self.ok(hd) else None)
        deaf = series == 'deafproject'
        desc = L['deaf_desc'] if deaf else L['film_desc_chapters'] if chapters else L['film_desc']
        duration = (meta.get('summary') or {}).get('duration_human')
        r = self.make('film-' + ident.lower().replace('_', '-'), 'film', title, native, url,
                      meta['org'] or 'Digital Bible Society', desc, duration=duration, year=meta.get('year'))
        if scope:
            r['scope'] = scope
            if self.code == 'tir':
                r['langName'] = f"{L['native']} · {country[1]}"
            elif scope != 'Twi':
                r['langName'] = f"{L['native']} · {scope}"
        if series == 'bp':
            # BibleProject overviews are separate videos, not chapters of one film.
            r['play'] = {'kind': 'chapters', 'base': '', 'items': [
                {'n': n, 'file': u, 'title': f'{n}. {LOCAL[L["ui"]].get(t.replace(" ", ""), t)}'}
                for n, u, t in chapters]}
            for i in r['play']['items']:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        elif chapters:
            word = L['part'] if series in ('rock', 'lumo-acts') else L['chapter']
            r['play'] = {'kind': 'chapters', 'base': '', 'items': [
                {'n': n, 'file': u, 'title': f'{word} {n}'} for n, u, _ in chapters]}
            for i in r['play']['items']:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        elif sd or hd:
            r['play'] = {'kind': 'file', **({'sd': sd} if sd else {}), **({'hd': hd} if hd else {})}
        if chapters or not own_folder:
            for d in meta['downloads']:
                if d['url'] and self.ok(d['url']) and (not own_folder or own_folder in d['url']):
                    self.download(r, d['url'], L['chapters_zip'] if 'chapter' in d['url'] else L['full'].replace('MP4', 'ZIP'))
        for u, q in ((sd, 'SD'), (hd, 'HD')):
            if u:
                self.download(r, u, f"{L['full']} · {q}")
        assert r.get('play'), url

    # ------------------------------------------------------------ scans
    def historic(self, url, page):
        pdf = next(l['url'] for l in page['links'] if l['url'].endswith('.pdf'))
        text = page['text']
        m = re.search(r'Historic Bibles\n\|\n(.+?)\n', text)
        title = m[1].strip().replace('-(', ' (').replace(')-(', ') (').replace('-', ' ') if m else url.rsplit('/', 1)[1]
        title = re.sub(r'\s+', ' ', title)
        year = re.search(r'\nDate\n(\d{4})', text)
        sub = re.search(r'\n' + re.escape(m[1].strip()) + r'\n\n(.+?)\n', text) if m else None
        native = (sub[1].strip() if sub else None) or title
        native = re.sub(r'^texts(?=[A-Z])', '', native)
        native = re.sub(r'^(Shona|Nyanja|Chichewa|Xhosa) (- |\(\d{4}\) )', '', native)
        native = AKAN_SCANS.get(url.rsplit('/', 1)[1], native)
        native = TIGRINYA_SCANS.get(url.rsplit('/', 1)[1], native)
        r = self.make('scan-' + url.rsplit('/', 1)[1].lower(), 'historic', title, native, url,
                      'Digital Bible Society', self.L['historic_desc'], year=int(year[1]) if year else None)
        r['read'] = {'kind': 'pdf', 'url': pdf}
        self.download(r, pdf, self.L['pdf'])

    # ------------------------------------------------------------ recordings
    def tracks(self, r, entries):
        r['play'] = {'kind': 'audio-collection', 'sample': entries[0][0],
                     'items': [{'n': n, 'file': u, 'title': t} for n, (u, t) in enumerate(entries, 1)]}
        for u, t in entries:
            self.download(r, u, t + ' (MP3)')

    def grn(self, url, page):
        L, code = self.L, self.code
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        groups = {}
        for u in mp3:
            parts = urllib.parse.unquote(u).split('/')
            groups.setdefault((parts[-3], parts[-2]), []).append(u)
        carried = 0
        for (dialect, folder), urls in groups.items():
            ident = folder.rsplit(' ', 1)[1].lstrip('0') or '0'
            if ident in EXCLUDED_IDS or any(r['id'] == f'{code}-grn-{ident}' for r in self.out):
                continue      # left out, or the same programme already carried from another DBS page
            carried += 1
            series = folder[len(dialect) + 1:].rsplit(' ', 1)[0]
            lll = re.match(r'LLL (\d)', series)
            if lll:
                head, names = LLL[code]
                native = f'{head} {lll[1]}: {names[int(lll[1]) - 1]}'
            else:
                numbered = re.match(r'(.+?) (\d)$', series)
                base, num = (numbered[1], ' ' + numbered[2]) if numbered else (series, '')
                native = GRN.get(base, {}).get(code, base) + num
            scope = None if dialect.lower() in (L['native'].lower(), L['name'].lower()) + L.get('plain', ()) else dialect
            # GRN's bare "Songs" reads as unconfirmed elsewhere; the Shona tracks are hymns.
            title = ('Hymns' if series == 'Songs' and code == 'sna' else GRN_TITLE.get(series, series)) + (f' — {scope}' if scope else '')
            r = self.make('grn-' + ident, 'audio', title, native, page['resolved'],
                          'Global Recordings Network', L['grn_desc'])
            r['dbsListedUrl'] = url
            if scope:
                r['scope'] = scope
                r['langName'] = f"{L['native']} · {scope}"
            r['stats'] = str(len(urls))
            self.tracks(r, [(u, f'{native} · {L["part"]} {n}') for n, u in enumerate(urls, 1)])
        return carried

    def story_of_jesus(self, url, page):
        L = self.L
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        full = {'sna': 'Nyaya yose', 'run': 'Inkuru yose', 'aka': 'Asɛm no nyinaa', 'tir': 'ምሉእ ዛንታ'}[self.code]
        native = {'sna': 'Nyaya yaJesu inonzwika', 'run': 'Inkuru ya Yesu mu majwi', 'aka': 'Yesu ho asɛm a wobɛtie',
                  'tir': 'ዛንታ ኢየሱስ ብድምጺ'}[self.code]
        entries = [(u, full if u.endswith('_full.mp3') else
                    f'{L["part"]} {int(re.search(r"(?:Part_|/)(\d+)\.mp3$", u)[1])}') for u in mp3]
        r = self.make('story-jesus', 'audio', 'Story of Jesus', native, page['resolved'], 'Story of Jesus',
                      {'sna': 'Nyaya yaJesu inonzwika: rekodhi rimwe rakazara nezvikamu zvisere. Teerera kana kuchengeta chaunoda.',
                       'run': 'Inkuru ya Yesu mu majwi, yose uko yakabaye canke mu bice umunani. Umviriza canke ubike ico ushaka.',
                       'aka': 'Yesu ho asɛm a wobɛtie: ne nyinaa bom, ne ne nkyekyɛmu awotwe. Tie anaa kora nea wopɛ.',
                       'tir': 'ዛንታ ኢየሱስ ብድምጺ፡ ብሓደ ምሉእ ቅዳሕ ወይ ብሸውዓተ ክፋላት። ዝደለኹምዎ ስምዑ ወይ ዓቅቡ።'}[self.code])
        r['dbsListedUrl'] = url
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], L['tracks_zip'] if not l['url'].endswith('_full.zip') else full + ' (ZIP)')

    def storyset(self, url, page):
        L = self.L
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        entries, missing = [], []
        for u in mp3:
            name = urllib.parse.unquote(u).rsplit('/', 1)[1][:-4]
            try:
                # The Tigrinya file names are UTF-8 read as code page 437 ("ßììßîÑ…").
                name = name.encode('cp437').decode('utf-8')
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            _, n, story = re.match(r'(.+?)-(\d+)-(.+)$', name).groups()
            local = story.split('-')[0].replace('_', ' ').strip()
            local = STORY_TITLES.get(self.code, {}).get(int(n), local)
            if not self.ok(u):
                missing.append(f'{int(n)}. {story.rsplit("-", 1)[-1].replace("_", " ")}')
                continue
            entries.append((u, f'{int(n)}. {local}'))
        native = {'nya': 'Nkhani za m’Baibulo', 'sna': 'Nyaya dzeBhaibheri', 'tir': 'ዛንታታት መጽሓፍ ቅዱስ'}[self.code]
        desc = {'nya': f'Nkhani {len(entries)} za m’Baibulo kuyambira pa chilengedwe, zojambulidwa ndi StoryRunners.',
                'sna': f'Nyaya {len(entries)} dzeBhaibheri kubva pakusikwa kwezvinhu, dzakarekodhwa neStoryRunners.',
                'tir': f'{len(entries)} ዛንታታት መጽሓፍ ቅዱስ ካብ ፍጥረት ክሳብ ሓድሽ ሰማይን ሓድሽ ምድርን፡ ብStoryRunners ዝተቐድሑ።'}[self.code]
        r = self.make('storyset', 'audio', 'StoryRunners Bible story set', native, page['resolved'],
                      'StoryRunners', desc, stats=str(len(entries)))
        r['dbsListedUrl'] = url
        self.tracks(r, entries)
        if missing:
            self.missing[url] = f'DBS links {len(missing)} StoryRunners stories its server does not hold (404): ' + '; '.join(missing) + '.'

    def finish(self):
        pass

    def other_site(self, url):
        return 'Not hosted by DBS; its DBS-hosted media is carried where DBS has it.'

    # ------------------------------------------------------------ build
    def build(self):
        pages = self.audit['pages']
        order = []
        for section in ('Bibles', 'Films', 'Audio Collections', 'Historic Bible (Scans)'):
            order += [row['url'] for row in self.audit['sections'].get(section, [])]
        # The traditional (Union / Buku Lopatulika) editions lead their shelves.
        first = TRADITIONAL.get(self.code, [])
        order.sort(key=lambda u: first.index(u) if u in first else len(first))
        skipped = {}
        for url in order:
            page = pages[url]
            if '/bibles/audio/' in url:
                if not self.audio_bible(url, page):
                    skipped[url] = 'DBS says this audio Bible has moved and lists current editions instead.'
            elif '/bibles/historic/' in url:
                self.historic(url, page)
            elif '/bibles/' in url:
                self.text_bible(url, page)
            elif '/video/' in url:
                self.film(url, page)
            elif '/collections/grn/' in url:
                if not self.grn(url, page):
                    skipped[url] = 'DBS lists the same GRN programme files here as on its other collection page, where they are carried.'

            elif '/collections/soj/' in url:
                self.story_of_jesus(url, page)
            elif '/collections/srun/' in url:
                self.storyset(url, page)
            else:
                raise ValueError(url)
        for u in self.audit['sections'].get('Links to Other Sites', []):
            skipped[u['url']] = EXCLUDED.get(self.code, {}).get(u['url'], self.other_site(u['url']))
        for u, why in EXCLUDED.get(self.code, {}).items():
            skipped[u] = why
        skipped.update(self.missing)
        # Two programmes with one name (Shona has two "Words of Life") get their GRN number.
        titles = {}
        for r in self.out:
            titles.setdefault(r['title'], []).append(r)
        for same in titles.values():
            if len(same) > 1 and all(r['id'].startswith(self.code + '-grn-') for r in same):
                for r in same:
                    n = r['id'].rsplit('-', 1)[1]
                    r['title'] += f' ({n})'
                    r['native'] += f' ({n})'
        self.finish()
        ids = [r['id'] for r in self.out]
        assert len(ids) == len(set(ids)), ids
        L = self.L
        lang = {k: L[k] for k in ('name', 'native', 'region', 'speakers', 'blurb')}
        lang.update(code=self.code, script=L.get('script', 'latn'), dir=L.get('dir', 'ltr'), font=L.get('font', 'latin'))
        (ROOT / f"catalog/{L['slug']}.json").write_text(json.dumps({
            'generated': f"DBS rendered {L['name']} inventory — {self.date}",
            'languages': {self.code: lang}, 'resources': self.out,
            'notCarried': skipped}, ensure_ascii=False, indent=1) + '\n')
        kinds = {}
        for r in self.out:
            kinds[r['type']] = kinds.get(r['type'], 0) + 1
        print(f"{L['name']}: {len(self.out)} resources {kinds}; {len(skipped)} listed links not carried")


def main():
    for code in (sys.argv[1:] or list(LANGS) + ['ara']):
        if code == 'ara':
            import build_dbs_arabic      # Arabic has its own module: many varieties, one shelf
            build_dbs_arabic.ArabicShelf().build()
            continue
        Shelf(code).build()


if __name__ == '__main__':
    main()
