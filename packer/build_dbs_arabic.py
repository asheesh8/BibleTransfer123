#!/usr/bin/env python3
"""Build Arabic from its browser audit: one shelf for every Arabic variety DBS lists.

    python3 packer/build_dbs_arabic.py
    python3 packer/build_dbs_audit.py ara       # the same

DBS gives Arabic 27 language pages: Modern Standard Arabic (arb), "Arabic"
(ara, which repeats most of the others) and 25 spoken varieties. Each page,
and every DBS page they list, was rendered in a real browser on 2026-10-07
(catalog/source/dbs-audit-arabic-2026-10-07.json); four of the pages (abv,
acx, ssh, adf) return "not found". Juba Arabic (pga) is a creole with its own
page and is not part of this shelf, but DBS's Arabic GRN collection holds its
Juba programmes, which are carried and named as Juba Arabic.

Modern Standard Arabic leads, with the Van Dyck Bible first. Every item in a
spoken variety names it ("اللهجة المصرية", "الدارجة المغربية" ...), the way
Akan names its dialects. Book names everywhere are the interface's own Van
Dyck names, whatever spelling a DBS picker uses.

The audit's ranged browser check of every file found video.dbs.org
returning 500 for a large share of the Arabic film files (a second, slower
pass returned the same), while DBS's own pages serve those files through
dbs.org/cdn/video/; that copy is carried where video.dbs.org fails. Most LUMO
high-quality files on video2.dbs.org return 404 everywhere. Only files that
returned real media are carried, so a film can have fewer chapters than DBS
lists, and one with nothing that plays is listed in notCarried.

DBS mistakes handled rather than copied:

  · The Modern Standard and Tunisian JESUS pages list the Visual Bible Acts
    chapters as JESUS chapters; only files named as JESUS chapters are taken.
    The Egyptian-voiced JESUS page lists the Sharif chapters (carried on
    their own page).
  · One "Prophets' Story - Arabic" is in Fulfulde (Ajami script) and is left
    out; another has its Arabic title stored as reversed presentation forms.
  · LUMO pages list the same film once per Bible text and restart their
    numbering; the text with the most working files is carried.
  · DBS titles the Hadrami text "الكتاب المقدس بالعامية المصرية" and the
    Davar Egyptian audio Bible "Genesis Portion" (it is all 66 books).
  · The North Levantine Story of Jesus page holds the Algerian recording.
  · AYPWBT is DBS's "Syriac Bible, Peshitto": its text is North Mesopotamian
    Arabic in Arabic script, translated from the Peshitta.
"""
import collections
import re
import urllib.parse

import build_dbs_audit as base
from build_dbs_audit import BOOKS, LOCAL, ROOT, Shelf

AR = LOCAL['ar']
DATE = '2026-10-07'

base.LANGS['ara'] = dict(
    slug='arabic', ui='ar', name='Arabic', native='العربية', region='Middle East & North Africa',
    speakers='~380 million', date=DATE, script='arab', dir='rtl', font='naskh',
    blurb='الكتاب المقدس والأفلام والتسجيلات المسيحية بالعربية الفصحى وباللهجات العربية.',
    chapter='الجزء', part='الجزء', view='اعرضه على DBS',
    full='الفيلم كاملًا (MP4)', chapters_zip='كل الأجزاء (ZIP)',
    tracks_zip='كل التسجيلات (ZIP)', pdf='الكتاب (PDF)',
    film_desc='فيلم مأخوذ من الكتاب المقدس بالعربية.',
    film_desc_chapters='فيلم مأخوذ من الكتاب المقدس بالعربية. اختر الجزء الذي تريد مشاهدته أو حفظه.',
    deaf_desc='الإنجيل بلغة الإشارة للصمّ، مدرج على DBS مع العربية.',
    historic_desc='طبعة قديمة مصوَّرة في ملف PDF. قد يختلف إملاء بعض الكلمات عن إملاء اليوم.',
    grn_desc='قصص من الكتاب المقدس وترانيم ورسائل مسيحية سجّلتها Global Recordings Network.',
)
L = base.LANGS['ara']

# Spoken varieties: English name, and the Arabic name as it follows "بـ".
DIALECTS = {
    'egyptian': ('Egyptian Arabic', 'اللهجة المصرية'),
    'saidi': ("Sa'idi Arabic", 'اللهجة الصعيدية'),
    'sudanese': ('Sudanese Arabic', 'اللهجة السودانية'),
    'juba': ('Juba Arabic', 'عربي جوبا'),
    'chadian': ('Chadian Arabic', 'العربية التشادية'),
    'moroccan': ('Moroccan Arabic', 'الدارجة المغربية'),
    'algerian': ('Algerian Arabic', 'الدارجة الجزائرية'),
    'tunisian': ('Tunisian Arabic', 'الدارجة التونسية'),
    'libyan': ('Libyan Arabic', 'اللهجة الليبية'),
    'libyan-east': ('Eastern Libyan Arabic', 'اللهجة الليبية الشرقية'),
    'libyan-west': ('Western Libyan Arabic', 'اللهجة الليبية الغربية'),
    'hassaniya': ('Hassaniya Arabic', 'الحسانية'),
    'nemadi': ('Nemadi Arabic', 'لهجة النمادي'),
    'levantine': ('Levantine Arabic', 'اللهجة الشامية'),
    'lebanese': ('Lebanese Arabic', 'اللهجة اللبنانية'),
    'palestinian': ('Palestinian Arabic', 'اللهجة الفلسطينية'),
    'jordanian': ('Jordanian Arabic', 'اللهجة الأردنية'),
    'iraqi': ('Iraqi Arabic', 'اللهجة العراقية'),
    'ahwazi': ('Ahwazi Arabic', 'اللهجة الأهوازية'),
    'mosuli': ('Mosuli Arabic', 'اللهجة الموصلية'),
    'mardini': ('Mardini Arabic', 'اللهجة الماردينية'),
    'north-mesopotamian': ('North Mesopotamian Arabic', 'عربية شمال بلاد الرافدين'),
    'gulf': ('Gulf Arabic', 'اللهجة الخليجية'),
    'kuwaiti': ('Kuwaiti Arabic', 'اللهجة الكويتية'),
    'hijazi': ('Hijazi Arabic', 'اللهجة الحجازية'),
    'najdi': ('Najdi Arabic', 'اللهجة النجدية'),
    'yemeni': ('Yemeni Arabic', 'اللهجة اليمنية'),
    'yemeni-north': ('Northern Yemeni Arabic', 'اللهجة اليمنية الشمالية'),
    'sanaani': ("Sana'ani Arabic", 'اللهجة الصنعانية'),
    'taizzi': ("Ta'izzi-Adeni Arabic", 'اللهجة التعزية العدنية'),
    'hadrami': ('Hadrami Arabic', 'اللهجة الحضرمية'),
    'bedouin': ('Bedouin Arabic', 'اللهجة البدوية'),
    'tajiki': ('Tajiki Arabic', 'عربية آسيا الوسطى'),
}

# A film's variety, from the name in its DBS address. First match wins.
FILM_DIALECT = [
    ('eastern-libyan', 'libyan-east'), ('western-libyan', 'libyan-west'), ('cyrenaican', 'libyan-east'),
    ('libyan', 'libyan'), ('egyptian-colloquial', 'egyptian'), ('egyptian-arabic', 'egyptian'),
    ('arabic_egyptian', 'egyptian'), ('saidi', 'saidi'), ("sa'idi", 'saidi'), ('sudanese', 'sudanese'),
    ('moroccan', 'moroccan'), ('palestinian', 'palestinian'), ('lebanese', 'lebanese'),
    ('halebi', 'levantine'), ('levantine', 'levantine'), ('ahwazi', 'ahwazi'), ('baghdadi', 'iraqi'),
    ('arabic_iraqi', 'iraqi'), ('tunisian', 'tunisian'), ('algerian', 'algerian'), ('gulf', 'gulf'),
    ('hijazi', 'hijazi'), ('najdi', 'najdi'), ('chadian', 'chadian'), ('hassaniy', 'hassaniya'),
    ('sanaani', 'sanaani'), ('northern_yemeni', 'yemeni-north'), ('taizzi', 'taizzi'),
    ('hadrami', 'hadrami'), ('arabic_yemeni', 'yemeni'), ('mardini', 'mardini'), ('bedouin', 'bedouin'),
]
# Three Modern Standard recordings that need telling apart from the plain one.
FILM_VOICE = {
    'modern-standard-egyptian': ('Egyptian voices', 'بأصوات مصرية'),
    'modern-standard-sharif': ('Sharif text', 'نص ترجمة الشريف'),
    'iraqi-reading': ('Iraqi reader', 'بصوت قارئ عراقي'),
}

# A GRN recording's variety, from its folder name. First match wins; none is Modern Standard.
GRN_DIALECT = [
    ('Juba', 'juba'), ('Khartoum', 'sudanese'), ('Kordofan', 'sudanese'), ('Nomad', 'sudanese'),
    ('Western Sudanic', 'chadian'), ('Chadian', 'chadian'), ("Sa'idi", 'saidi'), ('Egyptian', 'egyptian'),
    ('العامية المصرية', 'egyptian'), ('Bedouin', 'bedouin'), ('Moroccan', 'moroccan'), ('Algerian', 'algerian'),
    ('Tunisian', 'tunisian'), ('Beiruti', 'lebanese'), ('Lebanese', 'lebanese'), ('Jordanian', 'jordanian'),
    ('Mashriqi', 'jordanian'), ('Damascus', 'levantine'), ('Aleppo', 'levantine'), ('Calamon', 'levantine'),
    ('Khuzestan', 'ahwazi'), ('Baghdadi', 'iraqi'), ('Mardini', 'mardini'), ('Hijazi', 'hijazi'),
    ('كويتي', 'kuwaiti'), ('خليجي', 'gulf'), ("Sana'ani", 'sanaani'), ("Ta'izzi", 'taizzi'),
    ('Hassaniyya', 'hassaniya'), ('Nemadi', 'nemadi'), ('Tajiki', 'tajiki'),
]

# Programmes by GRN name: English title, Arabic title. "Look, Listen & Live"
# and "Words of Life" take their number from the folder.
GRN_NAMES = {
    'Good News': ('Good News', 'الأخبار السارة'),
    'Words of Life': ('Words of Life', 'كلمات الحياة'),
    'The Living Christ': ('The Living Christ', 'المسيح الحي'),
    'المسيحِ الحي': ('The Living Christ', 'المسيح الحي'),
    'Portrait of Jesus': ('Portrait of Jesus', 'صورة يسوع'),
    'John': ('Gospel of John', 'إنجيل يوحنا'),
    'Luke': ('Gospel of Luke', 'إنجيل لوقا'),
    'Questions Arabs Have about the Christians': ('Questions Arabs Ask about Christians',
                                                  'أسئلة يطرحها العرب عن المسيحيين'),
    'The Story of the Word': ('The Story of the Word', 'قصة الكلمة'),
    'يسوع اللاجئ': ('Jesus the Refugee', 'يسوع اللاجئ'),
    'Becoming a Friend of God': ('Becoming a Friend of God', 'أن تصير صديقًا لله'),
    'How Can I Know God': ('How Can I Know God?', 'كيف أعرف الله؟'),
    'Can I Know God': ('Can I Know God?', 'هل أستطيع أن أعرف الله؟'),
    'مغفرة من السماء': ('Forgiveness from Heaven', 'مغفرة من السماء'),
    'الطريق الى السماء': ('The Way to Heaven', 'الطريق إلى السماء'),
    'رسل الله': ("God's Messengers", 'رسل الله'),
    'أقوال وقصص رائعة': ('Wonderful Sayings and Stories', 'أقوال وقصص رائعة'),
    'خطة الله لك': ("God's Plan for You", 'خطة الله لك'),
    'Allah Adda Elhayah Lerohi': ('God Gave Life to My Spirit', 'الله أعاد الحياة لروحي'),
    'أغاني نحن ننظر في الثقة': ('Songs of Trust', 'ترانيم الثقة'),
    'ترانيم سودانية': ('Sudanese Hymns', 'ترانيم سودانية'),
    'كلمات الفرح للنساء': ('Words of Joy for Women', 'كلمات الفرح للنساء'),
    'المسيح هو رجاؤنا (للنساء)': ('Christ Is Our Hope (for women)', 'المسيح هو رجاؤنا (للنساء)'),
    'Words of Peace for Women': ('Words of Peace for Women', 'كلمات السلام للنساء'),
    'Jesus Story': ('The Story of Jesus', 'قصة يسوع'),
}
LLL = ('Look, Listen & Live', 'انظر واسمع وعِش', [
    'البداية مع الله', 'رجال الله الأقوياء', 'النصرة بالله', 'خدّام الله', 'المحاكمة من أجل الله',
    'يسوع المعلّم والشافي', 'يسوع الرب والمخلّص', 'أعمال الروح القدس'])

EXCLUDED = {
    'https://globalrecordings.net/en/program/67597': 'GRN “اهلا و مرحبا بكم في الولايات المتحدة” is a resettlement welcome, not a Christian resource.',
    'https://globalrecordings.net/en/program/67202': 'GRN “مرحبا بكم في الولايات المتحدة الأمريكية” is a resettlement welcome, not a Christian resource.',
    'https://globalrecordings.net/en/program/67633': 'GRN “After the Earthquake” gives no Christian subject; not confirmed as a Christian resource.',
    'https://globalrecordings.net/en/program/65954': 'GRN “After the War” (بعد الحرب) is a single untitled question track; not confirmed as a Christian resource.',
    'https://globalrecordings.net/en/program/4141': 'GRN “Songs” (Sa’idi) gives no subject; not confirmed as Christian songs.',
    'https://globalrecordings.net/en/program/38024': 'GRN “الأمثال للفلاحين” (proverbs for farmers) gives no Christian subject; not confirmed as a Christian resource.',
}
base.EXCLUDED['ara'] = EXCLUDED
base.EXCLUDED_IDS |= {u.rsplit('/', 1)[1] for u in EXCLUDED}

base.TRADITIONAL['ara'] = ['https://dbs.org/bibles/ARBVDV', 'https://dbs.org/bibles/audio/ARBVDV_ISA_FB_N']

FCBH, DAVR = 'Faith Comes By Hearing', 'Davar Partners International'
# Text editions: English title, Arabic title, variety, publisher.
TEXT = {
    'ARBVDV': ('Arabic Van Dyck Bible', 'الكتاب المقدس، ترجمة فان دايك', None, 'American Bible Society'),
    'ARBNAV': ('New Arabic Version (Ketab El Hayat)', 'كتاب الحياة', None, 'Biblica'),
    'ARBONAV': ('Open New Arabic Version', 'كتاب الحياة (النسخة المفتوحة)', None, 'Biblica'),
    'ARBERV': ('Arabic Easy-to-Read Version', 'الكتاب المقدس: الترجمة العربية المبسّطة', None, 'Bible League International'),
    'ARZVDV': ('Egyptian Arabic Bible', 'الكتاب المقدس بالعامية المصرية', 'egyptian', 'Wycliffe Bible Translators'),
    'AYHWBT': ('Hadrami Arabic Scripture', 'الكتاب المقدس باللهجة الحضرمية', 'hadrami', 'Wycliffe Bible Translators'),
    'AYPWBT': ('The Peshitta Gospel in North Mesopotamian Arabic', 'ترجمة النسخة السريانية للإنجيل المعروفة بالبسيطة',
               'north-mesopotamian', 'Digital Bible Society'),
}
# Audio editions: English title, Arabic title, variety, publisher.
AUDIO = {
    'ARBVDV_ISA_FB_N': ('Arabic Van Dyck Bible', 'الكتاب المقدس، ترجمة فان دايك', None, 'International Scripture Association'),
    'ARBNAV_FCBH_FB_N': ('New Arabic Version (Ketab El Hayat)', 'كتاب الحياة', None, FCBH),
    'ARZVDV_FCBH_FB_N': ('Egyptian Arabic Bible', 'الكتاب المقدس بالعامية المصرية', 'egyptian', FCBH),
    'ARZPOR_DAVR_FB_N': ('Egyptian Arabic Bible', 'الكتاب المقدس', 'egyptian', DAVR),
    'APDSIM_FCBH_NT_N': ('Sudanese Arabic New Testament', 'العهد الجديد', 'sudanese', FCBH),
    'APCSAB_FCBH_NP_N': ('Gospel of Mark', 'إنجيل مرقس', 'lebanese', FCBH),
    'ACMTSC_FCBH_PO_N': ('Psalms and the Gospel of Luke', 'المزامير وإنجيل لوقا', 'ahwazi', FCBH),
    'AEBANT_FCBH_NT_N': ('Tunisian Arabic New Testament', 'العهد الجديد', 'tunisian', FCBH),
    'AYLELA_FCBH_NP_N': ('Gospel of Mark', 'إنجيل مرقس', 'libyan-east', FCBH),
    'SHUATA_DAVR_FB_N': ('Chadian Arabic Bible', 'الكتاب المقدس', 'chadian', DAVR),
    'MEYPBT_FCBH_NT_N': ('Hassaniya New Testament', 'اكتاب مولانا المقدس: العهد الجديد', 'hassaniya', FCBH),
    'AYPABT_FCBH_NP_D': ('New Testament Books', 'أسفار من العهد الجديد', 'mosuli', FCBH),
}

# Historic scans: Arabic title, variety. None leaves a scan out (see SCAN_LEFT_OUT).
SCANS = {
    'Arabic-1590-Typographia-Medicea-Gospels-WDL-9918': ('الإنجيل المقدس، مطبعة ميديتشي (1590)', None),
    'Arabic-1600-ca.-Psalter-of-David-the-Prophet-WDL-17590': ('مزامير داود النبي (نحو 1600)', None),
    'Arabic-1687-Zacharia-Gospels-WDL-4088': ('الأناجيل الأربعة (1687)', None),
    'Arabic-1700-ca.-Coptic-John-WDL-11348': ('إنجيل يوحنا، مخطوط قبطي عربي (نحو 1700)', None),
    'Arabic-1700-ca.-Coptic-Luke-WDL-11347': ('إنجيل لوقا، مخطوط قبطي عربي (نحو 1700)', None),
    'Arabic-1700-ca.-Coptic-Mark-WDL-11346': ('إنجيل مرقس، مخطوط قبطي عربي (نحو 1700)', None),
    'Arabic-1748-Coptic-Old-Testament-Historicl-Books-WDL-11345': ('أسفار تاريخية من العهد القديم، مخطوط قبطي عربي (1748)', None),
    'Arabic-1789-Yusuf-al-Bani-Revelation-WDL-4086': ('العنوان العجيب في رؤيا الحبيب: سفر الرؤيا (1789)', None),
    'Arabic-1800-ca.-Coptic-Pentateuch-WDL-11342': ('أسفار موسى الخمسة، مخطوط قبطي عربي (نحو 1800)', None),
    'Arabic-1867-Van-Dyck-New-Testament': ('العهد الجديد، ترجمة فان دايك (1867)', None),
    'Arabic-1908-New-Testament-handwritten': ('العهد الجديد، مخطوط بخط اليد (1908)', None),
    'Arabic-Bible-Gospel-of-John': ('إنجيل يوحنا (1867)', None),
    'Egypt-Arabic-1992-Standard-Genesis-Portion': ('سفر التكوين بالعامية المصرية (1992)', 'egyptian'),
    'Arabic-North-Levantine-Genesis-Portion': ('سفر التكوين باللهجة الشامية الشمالية', 'levantine'),
    'Shuwa-Luke-print': ('إنجيل لوقا بالعربية التشادية (الشُّوا)', 'chadian'),
}
SCAN_LEFT_OUT = {
    "Arabic-1300-ca.-Nyssa's-Song-of-Solomon-WDL-4168": 'The manuscript also holds a letter attributed to Hermes the Sage and an ascetic treatise; not a Bible scan.',
    'Tajiki-1992-Genesis-Portion': 'The scan is Genesis in Tajik (Cyrillic script), not Arabic.',
}

FILMS_LEFT_OUT = {
    'https://dbs.org/video/ps/arb_ps_adamawa_fulfulde_of_nigeria_arabic': 'This “Prophets’ Story - Arabic” is in Fulfulde (Ajami script), not Arabic.',
}

# Film titles, by DBS film series.
FILM_NATIVE = {
    'jesus': 'يسوع', 'magdalena': 'المجدلية', 'savior': 'المخلّص', 'storyjesus': 'قصة يسوع للأطفال',
    'john': 'إنجيل يوحنا', 'ps': 'قصة الأنبياء', 'rock': 'ملك المجد',
    'lumo-acts': 'LUMO: أعمال الرسل', 'lumo-covenant': 'LUMO: العهد',
    'acts_vb': 'الكتاب المقدس المرئي: أعمال الرسل', 'matthew': 'الكتاب المقدس المرئي: إنجيل متى',
    'john_slides': 'إنجيل يوحنا بالصور', 'bible_slides': 'الكتاب المقدس بالصور', 'hope': 'الرجاء',
    'ibible': 'iBible: قصة يسوع الحقيقية', 'deafproject': 'الإنجيل بلغة الإشارة',
    'c2c': 'من الخليقة إلى المسيح', 'genesis': 'سفر التكوين',
}
FILM_TITLE = {
    'storyjesus': 'Story of Jesus for Children', 'ibible': 'iBible: The Real Story of Jesus',
    'ps': "The Prophets' Story", 'rock': 'King of Glory', 'genesis': 'The Book of Genesis',
}
# Scenes DBS titles only in English.
SCENES = {
    'The Bread of Life': 'خبز الحياة', 'Jesus Heals a Man Born Blind': 'يسوع يشفي المولود أعمى',
    'Jesus Raises Lazarus': 'يسوع يقيم لعازر', 'The Vine and the Branches': 'الكرمة والأغصان',
    'Jesus Prays for His Followers': 'يسوع يصلّي لأجل تلاميذه', 'Jesus at the Sea of Galilee': 'يسوع عند بحر الجليل',
    'The Conversion of Saul': 'اهتداء شاول',
    'Creation': 'الخليقة', 'The Garden of Eden': 'جنة عدن', 'The Fall': 'السقوط', 'Cain and Abel': 'قايين وهابيل',
    'Cain Murders Abel': 'قايين يقتل هابيل', 'Noah and the Ark': 'نوح والفلك', 'The Great Flood': 'الطوفان العظيم',
    'God Calls Abram': 'الله يدعو أبرام', 'Abram and Lot Separate': 'أبرام ولوط يفترقان',
    'Abram Rescues Lot': 'أبرام ينقذ لوطًا', "God's Covenant with Abram": 'عهد الله مع أبرام',
    'Hagar and Ishmael': 'هاجر وإسماعيل', 'The Sign of the Covenant': 'علامة العهد',
    'The Three Visitors': 'الزوار الثلاثة', 'The Destruction of Sodom': 'خراب سدوم',
    'Abraham and Abimelech': 'إبراهيم وأبيمالك', 'The Birth of Isaac': 'ميلاد إسحاق',
    "Abraham's Test": 'امتحان إبراهيم', 'Joseph the Dreamer': 'يوسف صاحب الأحلام', 'Judah and Tamar': 'يهوذا وثامار',
    "Joseph in Potiphar's House": 'يوسف في بيت فوطيفار', "The Prisoners' Dreams": 'حلما السجينين',
    "Pharaoh's Dream": 'حلم فرعون', "Joseph's Brothers Go to Egypt": 'إخوة يوسف يذهبون إلى مصر',
    'Benjamin Goes to Egypt': 'بنيامين يذهب إلى مصر', "Joseph's Cup": 'كأس يوسف',
    'Joseph Revealed': 'يوسف يكشف نفسه لإخوته', "Jacob's Journey to Egypt": 'رحلة يعقوب إلى مصر',
    'The Famine Intensifies': 'اشتداد المجاعة', "Jacob Blesses Joseph's Sons": 'يعقوب يبارك ابنَي يوسف',
    'Jacob Blesses His Sons': 'يعقوب يبارك بنيه', 'The Death of Joseph': 'موت يوسف',
    # Creation to Christ
    'The Most High God and His Creation': 'الله العلي وخليقته', 'Sin and Separation from God': 'الخطية والانفصال عن الله',
    'God Gives Ten Commandments & the Sacrifices': 'الله يعطي الوصايا العشر والذبائح', 'God Gives Jesus': 'الله يعطي يسوع',
    "Jesus' Death and Resurrection": 'موت يسوع وقيامته', 'The Wandering Son': 'الابن الضال',
    'Coming Home to God': 'العودة إلى الله',
}

# StoryRunners story titles, by number. DBS's file names are English (and French).
STORY_TITLES = {
    'aeb': ['خلق العالم', 'دخول الخطية إلى العالم', 'قايين وهابيل', 'إبراهيم', 'إبراهيم وهاجر وإسماعيل',
            'عهد الله مع إبراهيم والابن الموعود', 'يعقوب وعيسو', 'أحلام يوسف في صباه',
            'يوسف في بيت فوطيفار وفي السجن', 'تحقُّق أحلام يوسف', 'ميلاد موسى', 'دعوة موسى',
            'الضربات والفصح والخروج', 'العجل الذهبي', 'الله يختار داود', 'داود وجليات',
            'شاول والعرّافة', 'خطية داود', 'يونان', 'ميلاد يسوع', 'تجربة يسوع', 'يسوع والمرأة السامرية',
            'يسوع يشفي: أيّ سلطان هذا؟', 'يسوع يشفي امرأة ويقيم ابنة يايرس',
            'يسوع يُشبع الخمسة آلاف ويمشي على الماء', 'يسوع يُخرج روحًا شريرًا من صبي',
            'يسوع والمرأة التي أُمسكت في زنى', 'المولود أعمى (1)', 'المولود أعمى (2)', 'يسوع يقيم لعازر',
            'محاكمة يسوع وموته', 'قيامة يسوع', 'يوم الخمسين', 'الروح القدس لا يُشترى بالمال', 'كرنيليوس',
            'الكنيسة في أنطاكية', 'بولس وسيلا', 'معجزات بولس'],
    'shu': ['خلق العالم', 'العالم الروحي', 'دخول الخطية إلى العالم', 'نوح والطوفان', 'الله يدعو إبراهيم',
            'تحقيق وعد الله لإبراهيم', 'مسح داود ملكًا', 'إيليا وأنبياء البعل الكذبة', 'الله معنا: شفاء حزقيا',
            'العبد المتألم', 'ميلاد يسوع', 'معمودية يسوع', 'يسوع والمرأة السامرية عند البئر',
            'المفلوج الذي دُلّي من السقف', 'يسوع والمرأة الخاطئة', 'مثل الزارع', 'مثل الزوان',
            'يسوع يهدّئ العاصفة', 'يسوع يُخرج الشياطين', 'ابنة يايرس والمرأة نازفة الدم', 'يسوع يمشي على الماء',
            'مَن يقول الناس إني أنا؟', 'يسوع يعلّمنا الصلاة', 'دخول يسوع إلى أورشليم', 'العشاء الأخير',
            'القبض على يسوع ومحاكمته', 'صلب يسوع', 'قيامة يسوع', 'الإرسالية العظمى', 'الله يعطي روحه',
            'بطرس ويوحنا يشفيان رجلًا أعرج', 'رؤساء الدين يهددون بطرس ويوحنا', 'استشهاد استفانوس',
            'فيلبس والخصي الحبشي', 'اهتداء بولس', 'الكنيسة تمتد إلى أنطاكية', 'إرسال بولس وبرنابا',
            'روح الله يقود بولس', 'العبادة في القيود', 'الله يعمل في أفسس', 'سماء جديدة وأرض جديدة'],
}

# Story of Jesus: the recording's variety, by page. DBS's North Levantine page holds the Algerian files.
SOJ_DIALECT = {'arb': None, 'arz': 'egyptian', 'ary': 'moroccan', 'apc': 'algerian', 'aeb': 'tunisian'}


def chapters_in(src):
    m = re.search(r"\n  var BOOKS = \{(.*?)\n  \};", src, re.S)
    return {k: int(n) for k, n in re.findall(r"\[\d+,'(\w+)',(\d+)\]", m[1])}


CHAPTERS = chapters_in((ROOT / 'app/assets/js/core.js').read_text())
ARABIC = re.compile(r'[؀-ۿ]')
DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def first(table, text):
    return next((v for k, v in table if k in text), None)


def label(key):
    """(English suffix, Arabic suffix, langName) for a variety; Modern Standard has none."""
    if not key:
        return None
    eng, ar = DIALECTS[key]
    return eng, ar, f"{L['native']} · {ar}"


def ref(text):
    """'Genesis 1:1–2:3' → 'التكوين 1: 1–2: 3', with the interface's book names."""
    m = re.match(r'((?:[123] )?[A-Z][A-Za-z]*(?: of [A-Z][a-z]+)?)\s*(.*)$', text.strip())
    if not m or m[1].replace(' ', '') not in AR:
        return None
    rest = m[2].replace('-', '–').replace(':', ': ')
    return (AR[m[1].replace(' ', '')] + ' ' + rest).strip()


class ArabicShelf(Shelf):
    def __init__(self):
        super().__init__('ara')
        # DBS's "Arabic" GRN page repeats most dialect pages; read it last so each
        # programme is credited to its own variety's page.
        rows = self.audit['sections']['Audio Collections']
        rows.sort(key=lambda r: r['url'].endswith('/ara_GlobalRecordings_arabic'))
        self.missing = {}

    def other_site(self, url):
        if url.startswith('https://libraries.dbs.org/'):
            return ('DBS lists this partner-library file among its links to other sites, not in its Arabic '
                    'catalogue; it is outside this audit.')
        return super().other_site(url)

    def tag(self, r, key):
        lab = label(key)
        if lab:
            r['scope'] = lab[0]
            r['langName'] = lab[2]
            # A title that already names its variety is not named twice.
            if lab[0] not in r['title']:
                r['title'] += f' ({lab[0]})'
            if lab[1].split()[-1] not in r['native']:
                r['native'] += f' ({lab[1]})'

    # ------------------------------------------------------------ Bibles
    def text_bible(self, url, page):
        abbr = url.rsplit('/', 1)[1]
        title, native, key, org = TEXT[abbr]
        files = [f'https://bibles.dbs.org/{abbr}/pdf/{abbr}.pdf', f'https://bibles.dbs.org/{abbr}/epub/{abbr}.epub',
                 f'https://bibles.dbs.org/{abbr}/html_{abbr}.zip']
        lab = label(key)
        where = 'بالعربية' if not lab else 'ب' + lab[1]
        desc = f'نص الكتاب المقدس {where}. اقرأه في التطبيق أو احفظه لتقرأه دون إنترنت.'
        r = self.make('text-' + abbr.lower(), 'scripture', title, native, url, org, desc, year=self.year(url))
        self.tag(r, key)
        if self.ok(files[0]):
            r['read'] = {'kind': 'pdf', 'url': files[0]}
            self.download(r, files[0], 'الكتاب المقدس (PDF)')
        if self.ok(files[1]):
            self.download(r, files[1], 'الكتاب المقدس (EPUB)')
        if self.ok(files[2]):
            self.download(r, files[2], 'الكتاب المقدس للقراءة دون إنترنت (HTML ZIP)')
        assert r['downloads'], url
        study = f'https://bibles.dbs.org/{abbr}/app-json-study/index.html'
        if any(l['url'] == study for l in page['links']):
            r['links'].append({'url': study, 'label': 'اقرأه على الإنترنت'})

    def audio_bible(self, url, page):
        info = self.audit['audio_bibles'].get(url) or {}
        if not info.get('books'):
            return False      # a moved edition: DBS lists its replacements, carried here
        assert not info['bad'], url
        fileset = url.rsplit('/', 1)[1]
        title, native, key, org = AUDIO[fileset]
        dirs, keys, counts, missing = {}, [], {}, {}
        for b in info['books']:
            m = re.search(r'/cdn/audio/[^/]+/([^/]*?(OT|NT)_[^/]+)/(\d\d)_([^/]+)/', b['sample'])
            dirs[m[2]] = urllib.parse.unquote(m[1])
            k = BOOKS[int(m[3]) - 1]
            assert m[4] == k, (m[4], k)
            keys.append(k)
            last = max(b['chapters'])
            if last != CHAPTERS[k]:
                counts[k] = last
            gaps = sorted(set(range(1, last + 1)) - set(b['chapters']))
            if gaps:
                missing[k] = gaps
        testaments = [t for t in ('OT', 'NT') if t in dirs]
        version = dirs[testaments[0]].split('_', 1)[1]
        total = sum(len(b['chapters']) for b in info['books'])
        what = ('الكتاب المقدس كاملًا' if len(keys) == 66 else 'العهد الجديد' if len(keys) == 27 and testaments == ['NT']
                else 'أسفار من الكتاب المقدس')
        desc = (f'{what} مسموعًا. عدد الأسفار: {len(keys)}، وعدد الإصحاحات: {total}. '
                'اختر السفر والإصحاح للاستماع أو الحفظ.')
        if missing:
            desc += ' بعض الإصحاحات غير مسجّلة على DBS.'
        r = self.make('ab-' + fileset.lower().replace('_', '-'), 'audio-bible', title, native, url, org, desc,
                      year=self.year(url))
        if 'linkedFrom' in next(row for row in self.audit['sections']['Bibles'] if row['url'] == url):
            r['dbsListedUrl'] = next(row['linkedFrom'] for row in self.audit['sections']['Bibles'] if row['url'] == url)
        self.tag(r, key)
        play = {'kind': 'audio-bible', 'fileset': fileset, 'version': version, 'testaments': testaments,
                'bookNames': {k: AR[k] for k in keys}, 'saveChapter': True}
        if any(d != f'{t}_{version}' for t, d in dirs.items()):
            play['dirs'] = dirs
        if len(keys) not in (27, 39, 66):
            play['books'] = keys
        if counts:
            play['chapterCounts'] = counts
        if missing:
            play['missingChapters'] = missing
        r['play'] = play
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], 'كل الإصحاحات (ZIP)')
        return True

    # ------------------------------------------------------------ films
    def film(self, url, page):
        if url in FILMS_LEFT_OUT:
            self.missing[url] = FILMS_LEFT_OUT[url]
            return
        meta = self.audit['films'][url]
        series, ident = url.split('/video/', 1)[1].split('/', 1)
        voice = first(FILM_VOICE.items(), ident)
        key = None if voice else first(FILM_DIALECT, ident)
        title = FILM_TITLE.get(series, meta['title'])
        if series.startswith('lumo-') and not title.startswith('LUMO'):
            title = 'LUMO: ' + title
        native = FILM_NATIVE.get(series)
        if series.startswith('lumo-') and not native:
            native = 'LUMO: إنجيل ' + AR[series[5:].title()]
        if series == 'bp':
            native = ('BibleProject: نظرة عامة على أسفار الكتاب المقدس' if 'overview' in ident
                      else 'BibleProject: مواضيع كتابية')
            title = 'BibleProject: ' + ('Book Overviews' if 'overview' in ident else 'Themes')

        # Items: one Bible text for LUMO (the one with the most working files),
        # each file once, and only JESUS's own chapters on a JESUS page.
        sections = meta['sections']
        if series.startswith('lumo-') and len(sections) > 1:
            sections = [max(sections, key=lambda s: sum(bool(self.media(i)) for i in s['items']))]
        own_folder = '/' + ident.rsplit('_', 1)[0] + '/' if series == 'jesus' else None
        items, seen = [], set()
        for s in sections:
            for i in s['items']:
                u = self.media(i)
                if not u or u in seen:
                    continue
                if series == 'jesus' and ('_jesus_chapter_' not in u or own_folder not in u):
                    continue      # Acts chapters, or another recording's, misfiled on this page
                seen.add(u)
                items.append((i, u))
        renumber = series in ('hope', 'rock', 'lumo-acts', 'bible_slides') or len(sections) > 1
        chapters = [(n if renumber else i['n'], u, self.item_title(series, i, n if renumber else i['n']))
                    for n, (i, u) in enumerate(items, 1)]

        full = meta['full'][0]['media'] if meta['full'] else {}
        sd = (full.get('low') or {}).get('url')
        hd = (full.get('high') or {}).get('url')
        sd, hd = self.pick(sd), self.pick(hd)
        if not (chapters or sd or hd):
            self.missing[url] = ('DBS’s server returned an error or “not found” for every file this page lists'
                                  + (' (its chapters are another recording’s)' if own_folder and meta['sections'] else '')
                                  + '; nothing here plays.')
            return
        lab = label(key)
        where = 'بالعربية' if not lab else 'ب' + lab[1]
        if series == 'deafproject':
            desc = 'الإنجيل بلغة الإشارة للصمّ، مدرج على DBS مع ' + (lab[1] if lab else 'العربية') + '.'
        else:
            desc = f'فيلم مأخوذ من الكتاب المقدس {where}.'
            if len(chapters) > 1:
                desc += ' اختر الجزء الذي تريد مشاهدته أو حفظه.'
        duration = (meta.get('summary') or {}).get('duration_human')
        slug = re.sub(r'[^a-z0-9]+', '-', ident.lower()).strip('-')
        r = self.make('film-' + slug, 'film', title, native, url, meta['org'] or 'Digital Bible Society', desc,
                      duration=duration, year=meta.get('year'))
        if voice:
            r['title'] += f' ({voice[0]})'
            r['native'] += f' ({voice[1]})'
        self.tag(r, key)
        if chapters:
            r['play'] = {'kind': 'chapters', 'base': '', 'items': [
                {'n': n, 'file': u, 'title': t} for n, u, t in chapters]}
            for i in r['play']['items']:
                self.download(r, i['file'], i['title'] + ' (MP4)')
        else:
            r['play'] = {'kind': 'file', **({'sd': sd} if sd else {}), **({'hd': hd} if hd else {})}
        for d in meta['downloads']:
            u = self.pick(d['url'])
            if u and (not own_folder or own_folder in u):
                self.download(r, u, L['chapters_zip'] if 'chapter' in u else L['full'].replace('MP4', 'ZIP'))
        for u, q in ((sd, 'SD'), (hd, 'HD')):
            if u:
                self.download(r, u, f"{L['full']} · {q}")

    def pick(self, u):
        """The file, or DBS's own copy of it: video.dbs.org returns 500 for many files
        that DBS's pages serve through dbs.org/cdn/video."""
        if not u:
            return None
        if self.ok(u):
            return u
        cdn = u.replace('https://video.dbs.org/', 'https://dbs.org/cdn/video/')
        return cdn if cdn != u and self.ok(cdn) else None

    def media(self, item):
        m = item.get('media') or {}
        return next((self.pick(u) for u in (m.get('low'), m.get('high')) if self.pick(u)), None)

    def item_title(self, series, i, n):
        tv = (i.get('title_vernacular') or '').strip()
        en = (i.get('title') or '').strip()
        if series == 'bp':
            if i.get('reference') in ('Complete OT', 'Complete NT'):
                return f"{n}. نظرة عامة: العهد {'القديم' if i['reference'] == 'Complete OT' else 'الجديد'}"
            book = ref(en)
            if book:
                return f'{n}. نظرة عامة: {book}'
            text = re.sub(r'\s+', ' ', re.sub(r'^[^؀-ۿ]*', '', tv)).strip()
            assert text, en
            return f'{n}. {text}'
        if series in ('john_slides', 'bible_slides', 'genesis'):
            scene, where = en.split(' — ')
            return f'{n}. {SCENES[scene]} ({ref(where)})'
        if series == 'c2c':
            return f"{n}. {SCENES[en.split(' - ', 1)[1]]}"
        if re.match(r'lumo-(matthew|mark|luke|john)$', series) and i.get('reference') and ref(i['reference']):
            return ref(i['reference'])
        if series in ('john', 'hope', 'lumo-acts', 'lumo-covenant') and ARABIC.search(tv):
            return f'{n}. {tv}'
        return f"{L['chapter']} {n}"

    # ------------------------------------------------------------ scans
    def historic(self, url, page):
        name = url.rsplit('/', 1)[1]
        if name in SCAN_LEFT_OUT:
            self.missing[url] = SCAN_LEFT_OUT[name]
            return
        native, key = SCANS[name]
        pdf = next(l['url'] for l in page['links'] if l['url'].endswith('.pdf'))
        m = re.search(r'Historic Bibles\n\|\n(.+?)\n', page['text'])
        title = re.sub(r'\s*\(WDL-\d+\)', '', m[1].strip()).replace('Historicl', 'Historical').replace('Chaldian', 'Chadian')
        year = re.search(r'\((\d{4})', title)
        r = self.make('scan-' + re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'), 'historic', title, native, url,
                      'Digital Bible Society', L['historic_desc'], year=int(year[1]) if year else None)
        if key:
            r['scope'], r['langName'] = DIALECTS[key][0], f"{L['native']} · {DIALECTS[key][1]}"
        r['read'] = {'kind': 'pdf', 'url': pdf}
        self.download(r, pdf, L['pdf'])

    # ------------------------------------------------------------ recordings
    def grn(self, url, page):
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        groups = collections.OrderedDict()
        for u in mp3:
            parts = urllib.parse.unquote(u).split('/')
            groups.setdefault((parts[-3], parts[-2]), []).append(u)
        carried = 0
        for (folder, programme), urls in groups.items():
            ident = programme.rsplit(' ', 1)[1].lstrip('0') or '0'
            if ident in base.EXCLUDED_IDS or any(r['id'] == f'ara-grn-{ident}' for r in self.out):
                continue
            urls = [u for u in urls if self.ok(u)]
            if not urls:
                self.missing.setdefault(url, f'GRN programme {ident}: DBS’s server returned an error for every file.')
                continue
            carried += 1
            # GRN cuts long folder names short ("... North Lebanese Literar Good New").
            series = (programme[len(folder) + 1:] if programme.startswith(folder + ' ') else
                      re.sub(r'^.*? (Good New)$', r'\1', programme.rsplit(' ', 1)[0]) + ' 0')
            series = series.rsplit(' ', 1)[0].translate(DIGITS)
            series = re.sub(r'\s*\((عربي جوبا|شمال كر)\)?$', '', series).strip()
            en, ar = self.grn_name(series)
            key = first(GRN_DIALECT, folder)
            r = self.make('grn-' + ident, 'audio', en, ar, page['resolved'], 'Global Recordings Network',
                          L['grn_desc'])
            r['dbsListedUrl'] = url
            if key:
                eng, arname = DIALECTS[key]
                r['title'] += f' — {eng}'
                r['native'] += f' ({arname})'
                r['scope'], r['langName'] = eng, f"{L['native']} · {arname}"
            r['stats'] = str(len(urls))
            entries = []
            for n, u in enumerate(urls, 1):
                name = urllib.parse.unquote(u).rsplit('/', 1)[1][:-4]
                track = re.match(r'.*? \d{3} (.*) \d+$', name)
                track = track[1].strip() if track else ''
                entries.append((u, f'{n}. {track}' if ARABIC.search(track) and not re.search('[A-Za-z]', track)
                                else f"{ar} · {L['part']} {n}"))
            self.tracks(r, entries)
        return carried

    def grn_name(self, series):
        lll = re.match(r'(?:LLL|انظر،? اسمع،? و ?(?:الحياه|احياه|احيا|عش))\s*(\d)?', series)
        if lll:
            if not lll[1]:
                return LLL[0], LLL[1]
            n = int(lll[1])
            return f'{LLL[0]} {n}', f'{LLL[1]} {n}: {LLL[2][n - 1]}'
        if re.match(r'(Good News?|الأخبار السارة|الخببار السارة|خبار الخير|Good New)$', series):
            return GRN_NAMES['Good News']
        wol = re.match(r'(?:Words of Life|كلمات الحياة)(?: w .*)?(?: (\d))?$', series)
        if wol:
            n = f' {wol[1]}' if wol[1] else ''
            return 'Words of Life' + n, 'كلمات الحياة' + n
        return GRN_NAMES[series]

    def story_of_jesus(self, url, page):
        iso = url.rsplit('/', 1)[1][:3]
        key = SOJ_DIALECT[iso]
        mp3 = [u for u in dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')) if self.ok(u)]
        entries = [(u, 'القصة كاملة' if u.endswith('_full.mp3') else
                    f"{L['part']} {int(re.search(r'(\d+)\.mp3$', u)[1])}") for u in mp3]
        entries.sort(key=lambda e: (e[1] != 'القصة كاملة', e[1]))
        r = self.make('story-jesus-' + iso, 'audio', 'Story of Jesus', 'قصة يسوع مسموعة', page['resolved'],
                      'Story of Jesus', 'قصة يسوع مسموعة: تسجيل للقصة كاملة وأجزاؤها. استمع أو احفظ ما تريد.')
        r['dbsListedUrl'] = url
        self.tag(r, key)
        self.tracks(r, entries)
        for l in page['links']:
            if l['url'].endswith('.zip') and self.ok(l['url']):
                self.download(r, l['url'], 'القصة كاملة (ZIP)' if l['url'].endswith('_full.zip') else L['tracks_zip'])

    def storyset(self, url, page):
        iso = url.rsplit('/', 1)[1][:3]
        mp3 = list(dict.fromkeys(l['url'] for l in page['links'] if l['url'].endswith('.mp3')))
        entries, missing = [], []
        for u in mp3:
            n = int(re.search(r'-(\d+)-', urllib.parse.unquote(u).rsplit('/', 1)[1])[1])
            if not self.ok(u):
                missing.append(str(n))
                continue
            entries.append((u, f'{n}. {STORY_TITLES[iso][n - 1]}'))
        key = {'aeb': 'tunisian', 'shu': 'chadian'}[iso]
        r = self.make('storyset-' + iso, 'audio', 'StoryRunners Bible story set', 'قصص من الكتاب المقدس',
                      page['resolved'], 'StoryRunners',
                      f'قصص من الكتاب المقدس من الخليقة إلى الكنيسة الأولى، سجّلتها StoryRunners '
                      f'ب{DIALECTS[key][1]}. عدد القصص: {len(entries)}.', stats=str(len(entries)))
        r['dbsListedUrl'] = url
        self.tag(r, key)
        self.tracks(r, entries)
        if missing:
            self.missing[url] = (f'DBS links {len(mp3)} StoryRunners stories; its server returned an error for '
                                 f'{len(missing)} of them (stories {", ".join(missing)}), so those are not carried.')

    # ------------------------------------------------------------ build
    def finish(self):
        # A few films DBS lists twice with one title (two Modern Standard dubs of
        # Visual Bible Acts, two Chadian Prophets' Story recordings): number them.
        titles = collections.defaultdict(list)
        for r in self.out:
            titles[r['title']].append(r)
        for same in titles.values():
            if len(same) > 1 and all(r['type'] == 'film' for r in same):
                for k, r in enumerate(same[1:], 2):
                    r['title'] += f' ({k})'
                    r['native'] += f' ({k})'


def main():
    ArabicShelf().build()


if __name__ == '__main__':
    main()
