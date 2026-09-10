/* ============================================================================
   Interface strings, and the machinery that swaps them.

   ⚠ TRANSLATION STATUS
   English is authoritative. The Urdu and Sindhi strings are a working draft and
   HAVE NOT BEEN REVIEWED BY A NATIVE SPEAKER. They are good enough to build and
   demo against; they are not good enough to put in front of the people this is
   for. Get both passed by a speaker — Gawahi's own staff are the obvious
   reviewers — before any card ships. Anything missing falls back to English,
   so a partly-reviewed file is safe to ship as it improves.

   Adding a language: add a block to STRINGS, add it to LANGS, done. Set `dir`
   and `font` correctly — the stylesheet keys its Arabic-script rules off them.
   ========================================================================= */

(function (ET) {
  'use strict';

  var LANGS = [
    { code: 'en',  name: 'English', native: 'English', dir: 'ltr' },
    { code: 'ur',  name: 'Urdu',    native: 'اردو',    dir: 'rtl' },
    { code: 'snd', name: 'Sindhi',  native: 'سنڌي',    dir: 'rtl' }
  ];

  var STRINGS = {
    en: {
      'app.name': 'The Library',
      'app.tagline': 'Films, Scripture and audio you can keep — no internet needed.',

      'home.greet': 'What would you like today?',
      'home.offline': '{n} of {total} work with no internet',
      'home.browse': 'Browse everything',
      'home.browse.sub': 'All {n} items',
      'home.share': 'Show me how to share',
      'home.share.sub': 'Pass anything here to another phone',
      'home.install': 'Put this on my home screen',
      'home.install.sub': 'Opens like an app, with one tap',
      'home.help': 'How do I open what I saved?',
      'home.help.sub': 'Where files go, and how to find them again',
      'home.pick': 'Choose your language',
      'home.pick.sub': 'You can change this any time',

      'lib.title': 'Everything on this card',
      'lib.search': 'Search by name',
      'lib.all': 'All',
      'lib.count': 'Showing {n} of {total}',
      'lib.none': 'Nothing matches that',
      'lib.none.sub': 'Try a shorter word, or tap All.',
      'lib.kind': 'Kind',
      'lib.lang': 'Language',
      'lib.clear': 'Clear',

      'type.film': 'Films',
      'type.audio-bible': 'Audio Bibles',
      'type.audio': 'Audio',
      'type.scripture': 'Scripture',
      'type.historic': 'Old scans',
      'type.link': 'Needs internet',

      'item.play': 'Play',
      'item.read': 'Read',
      'item.save': 'Save to my phone',
      'item.share': 'Share this',
      'item.chapters': 'Chapters',
      'item.chapter': 'Chapter {n}',
      'item.files': 'What you can save',
      'item.offline': 'Works with no internet',
      'item.online': 'Needs internet',
      'item.online.why': 'This one is not stored on the card. It opens only when the device has a connection.',
      'item.by': 'From {org}',
      'item.back': 'Back',
      'item.openfile': 'Open this file',
      'item.openfile.sub': 'It opens in whatever app your phone uses for this kind of file.',

      'save.title': 'Saving to your phone',
      'save.tap': 'Tap the button below. Your phone will ask where to put it, or drop it straight into Downloads.',
      'save.where': 'Where did it go?',
      'save.android': 'Android — open Files, then Downloads.',
      'save.ios': 'iPhone or iPad — open the Files app, then On My iPhone, then Downloads.',
      'save.computer': 'Computer — look in your Downloads folder.',
      'save.check': 'Open it once now, before you need it. A file you have not opened is a file you do not know you have.',
      'save.go': 'Save it',
      'save.big': 'This is {size}. On a slow card it can take a few minutes.',

      'share.title': 'Share this with someone',
      'share.lead': 'Answer two questions and you get the steps for exactly those two devices.',
      'share.from': 'What are you sharing FROM?',
      'share.to': 'What are you sharing TO?',
      'share.result': 'Do this',
      'share.again': 'Pick different devices',
      'share.golden': 'Send one small file first',
      'share.golden.body': 'Test with a single PDF or one audio file before you move anything large. A test file shows you a broken connection in ten seconds instead of forty minutes.',
      'share.teach': 'Now let them do it',
      'share.teach.body': 'Ask the person you just shared with to send the same file to somebody else, right now, while you watch. That is the moment it becomes theirs instead of something you did for them.',

      'dev.iphone': 'iPhone or iPad',
      'dev.android': 'Android phone',
      'dev.computer': 'Computer',
      'dev.card': 'This card',

      'help.title': 'Opening what you saved',
      'help.back': 'Back to the library',

      'ui.close': 'Close',
      'ui.cancel': 'Cancel',
      'ui.lang': 'Language',
      'ui.needsnet': 'Needs internet'
    },

    ur: {
      'app.name': 'لائبریری',
      'app.tagline': 'فلمیں، کلامِ مُقدّس اور آڈیو — انٹرنیٹ کے بغیر۔',

      'home.greet': 'آج آپ کیا دیکھنا چاہیں گے؟',
      'home.offline': 'ان میں سے {n} کو انٹرنیٹ کی ضرورت نہیں',
      'home.browse': 'سب کچھ دیکھیں',
      'home.browse.sub': 'کل {n} چیزیں',
      'home.share': 'مجھے بتائیں کیسے بھیجوں',
      'home.share.sub': 'یہاں سے کوئی بھی چیز دوسرے فون پر بھیجیں',
      'home.install': 'اسے میری ہوم اسکرین پر رکھیں',
      'home.install.sub': 'ایک ہی ٹیپ سے ایپ کی طرح کھلے گی',
      'home.help': 'محفوظ کی ہوئی چیز کیسے کھولوں؟',
      'home.help.sub': 'فائلیں کہاں جاتی ہیں اور دوبارہ کیسے ملیں گی',
      'home.pick': 'اپنی زبان چنیں',
      'home.pick.sub': 'آپ اسے کسی بھی وقت بدل سکتے ہیں',

      'lib.title': 'اس کارڈ پر موجود سب کچھ',
      'lib.search': 'نام سے تلاش کریں',
      'lib.all': 'سب',
      'lib.count': 'کل {total} میں سے {n} دکھائی جا رہی ہیں',
      'lib.none': 'اس سے کوئی چیز نہیں ملی',
      'lib.none.sub': 'چھوٹا لفظ لکھ کر دیکھیں، یا "سب" پر دبائیں۔',
      'lib.kind': 'قسم',
      'lib.lang': 'زبان',
      'lib.clear': 'صاف کریں',

      'type.film': 'فلمیں',
      'type.audio-bible': 'آڈیو بائبل',
      'type.audio': 'آڈیو',
      'type.scripture': 'کلامِ مُقدّس',
      'type.historic': 'پرانے نسخے',
      'type.link': 'انٹرنیٹ درکار ہے',

      'item.play': 'چلائیں',
      'item.read': 'پڑھیں',
      'item.save': 'اپنے فون میں محفوظ کریں',
      'item.share': 'یہ بھیجیں',
      'item.chapters': 'ابواب',
      'item.chapter': 'باب {n}',
      'item.files': 'جو چیزیں محفوظ کی جا سکتی ہیں',
      'item.offline': 'انٹرنیٹ کے بغیر چلتی ہے',
      'item.online': 'انٹرنیٹ درکار ہے',
      'item.online.why': 'یہ چیز کارڈ پر محفوظ نہیں ہے۔ یہ صرف اُس وقت کھلتی ہے جب فون انٹرنیٹ سے جُڑا ہو۔',
      'item.by': '‏{org} کی طرف سے',
      'item.back': 'واپس',
      'item.openfile': 'یہ فائل کھولیں',
      'item.openfile.sub': 'یہ اُسی ایپ میں کھلے گی جو آپ کا فون اس قسم کی فائل کے لیے استعمال کرتا ہے۔',

      'save.title': 'آپ کے فون میں محفوظ کرنا',
      'save.tap': 'نیچے والا بٹن دبائیں۔ فون یا تو جگہ پوچھے گا یا سیدھا Downloads میں رکھ دے گا۔',
      'save.where': 'وہ کہاں گئی؟',
      'save.android': 'اینڈرائیڈ — Files کھولیں، پھر Downloads۔',
      'save.ios': 'آئی فون یا آئی پیڈ — Files ایپ کھولیں، پھر On My iPhone، پھر Downloads۔',
      'save.computer': 'کمپیوٹر — اپنے Downloads فولڈر میں دیکھیں۔',
      'save.check': 'ابھی ایک بار کھول کر دیکھ لیں، ضرورت پڑنے سے پہلے۔ جو فائل آپ نے کھولی نہیں، وہ آپ کے پاس ہے یا نہیں، آپ کو معلوم نہیں۔',
      'save.go': 'محفوظ کریں',
      'save.big': 'یہ {size} ہے۔ سست کارڈ پر اس میں چند منٹ لگ سکتے ہیں۔',

      'share.title': 'یہ کسی کو بھیجیں',
      'share.lead': 'دو سوالوں کے جواب دیں، اور اُنہی دو آلات کے لیے مکمل ہدایات مل جائیں گی۔',
      'share.from': 'کس چیز سے بھیج رہے ہیں؟',
      'share.to': 'کس چیز پر بھیج رہے ہیں؟',
      'share.result': 'یہ کریں',
      'share.again': 'دوسرے آلات چنیں',
      'share.golden': 'پہلے ایک چھوٹی فائل بھیجیں',
      'share.golden.body': 'کوئی بڑی چیز بھیجنے سے پہلے ایک PDF یا ایک آڈیو فائل بھیج کر دیکھ لیں۔ ٹیسٹ فائل خرابی دس سیکنڈ میں دکھا دیتی ہے، چالیس منٹ میں نہیں۔',
      'share.teach': 'اب اُن سے کروائیں',
      'share.teach.body': 'جس شخص کو آپ نے ابھی بھیجا ہے، اُس سے کہیں کہ وہی فائل کسی تیسرے شخص کو ابھی، آپ کے سامنے بھیجے۔ یہی وہ لمحہ ہے جب یہ ہنر اُن کا اپنا بن جاتا ہے۔',

      'dev.iphone': 'آئی فون یا آئی پیڈ',
      'dev.android': 'اینڈرائیڈ فون',
      'dev.computer': 'کمپیوٹر',
      'dev.card': 'یہی کارڈ',

      'help.title': 'محفوظ کی ہوئی چیزیں کھولنا',
      'help.back': 'لائبریری پر واپس',

      'ui.close': 'بند کریں',
      'ui.cancel': 'منسوخ',
      'ui.lang': 'زبان',
      'ui.needsnet': 'انٹرنیٹ درکار ہے'
    },

    snd: {
      'app.name': 'لائبريري',
      'app.tagline': 'فلمون، پاڪ ڪلام ۽ آڊيو — انٽرنيٽ کان سواءِ.',

      'home.greet': 'اڄ ڇا ڏسڻ چاهيندؤ؟',
      'home.offline': 'انهن مان {n} کي انٽرنيٽ جي ضرورت ناهي',
      'home.browse': 'سڀ ڪجهه ڏسو',
      'home.browse.sub': 'ڪُل {n} شيون',
      'home.share': 'مون کي ٻڌايو ڪيئن موڪليان',
      'home.share.sub': 'هتان ڪا به شيءِ ٻئي فون تي موڪليو',
      'home.install': 'هن کي منهنجي هوم اسڪرين تي رکو',
      'home.install.sub': 'هڪ ئي ٽيپ سان ايپ وانگر کلندي',
      'home.help': 'محفوظ ڪيل شيءِ ڪيئن کوليان؟',
      'home.help.sub': 'فائلون ڪٿي وينديون آهن ۽ وري ڪيئن ملنديون',
      'home.pick': 'پنهنجي ٻولي چونڊيو',
      'home.pick.sub': 'توهان اها ڪنهن به وقت مٽائي سگهو ٿا',

      'lib.title': 'هن ڪارڊ تي موجود سڀ ڪجهه',
      'lib.search': 'نالي سان ڳوليو',
      'lib.all': 'سڀ',
      'lib.count': 'ڪُل {total} مان {n} ڏيکاريل آهن',
      'lib.none': 'ان سان ڪا شيءِ نه ملي',
      'lib.none.sub': 'ننڍو لفظ لکي ڏسو، يا "سڀ" تي دٻايو.',
      'lib.kind': 'قسم',
      'lib.lang': 'ٻولي',
      'lib.clear': 'صاف ڪريو',

      'type.film': 'فلمون',
      'type.audio-bible': 'آڊيو بائيبل',
      'type.audio': 'آڊيو',
      'type.scripture': 'پاڪ ڪلام',
      'type.historic': 'پراڻا نسخا',
      'type.link': 'انٽرنيٽ گهرجي',

      'item.play': 'هلايو',
      'item.read': 'پڙهو',
      'item.save': 'پنهنجي فون ۾ محفوظ ڪريو',
      'item.share': 'هي موڪليو',
      'item.chapters': 'باب',
      'item.chapter': 'باب {n}',
      'item.files': 'جيڪي شيون محفوظ ٿي سگهن ٿيون',
      'item.offline': 'انٽرنيٽ کان سواءِ هلي ٿي',
      'item.online': 'انٽرنيٽ گهرجي',
      'item.online.why': 'هيءَ شيءِ ڪارڊ تي محفوظ ناهي. اها رڳو تڏهن کلندي جڏهن فون انٽرنيٽ سان ڳنڍيل هجي.',
      'item.by': '‏{org} پاران',
      'item.back': 'واپس',
      'item.openfile': 'هيءَ فائل کوليو',
      'item.openfile.sub': 'اها انهيءَ ايپ ۾ کلندي جيڪا توهان جو فون هن قسم جي فائل لاءِ ڪم آڻيندو آهي.',

      'save.title': 'توهان جي فون ۾ محفوظ ڪرڻ',
      'save.tap': 'هيٺيون بٽڻ دٻايو. فون يا ته جڳهه پڇندو يا سڌو Downloads ۾ رکي ڇڏيندو.',
      'save.where': 'اها ڪٿي وئي؟',
      'save.android': 'اينڊرائيڊ — Files کوليو، پوءِ Downloads.',
      'save.ios': 'آئي فون يا آئي پيڊ — Files ايپ کوليو، پوءِ On My iPhone، پوءِ Downloads.',
      'save.computer': 'ڪمپيوٽر — پنهنجي Downloads فولڊر ۾ ڏسو.',
      'save.check': 'هينئر هڪ ڀيرو کولي ڏسو، ضرورت پوڻ کان اڳ. جيڪا فائل توهان کولي ناهي، اها توهان وٽ آهي يا نه، توهان کي خبر ناهي.',
      'save.go': 'محفوظ ڪريو',
      'save.big': 'هيءَ {size} آهي. سست ڪارڊ تي ان ۾ ڪجهه منٽ لڳي سگهن ٿا.',

      'share.title': 'هي ڪنهن کي موڪليو',
      'share.lead': 'ٻن سوالن جا جواب ڏيو، ۽ انهن ئي ٻن اوزارن لاءِ پوريون هدايتون ملي وينديون.',
      'share.from': 'ڪهڙي شيءِ مان موڪلي رهيا آهيو؟',
      'share.to': 'ڪهڙي شيءِ تي موڪلي رهيا آهيو؟',
      'share.result': 'هي ڪريو',
      'share.again': 'ٻيا اوزار چونڊيو',
      'share.golden': 'پهرين هڪ ننڍي فائل موڪليو',
      'share.golden.body': 'ڪا وڏي شيءِ موڪلڻ کان اڳ هڪ PDF يا هڪ آڊيو فائل موڪلي ڏسو. ٽيسٽ فائل خرابي ڏهن سيڪنڊن ۾ ڏيکاري ڇڏيندي، چاليهن منٽن ۾ نه.',
      'share.teach': 'هاڻي انهن کان ڪرايو',
      'share.teach.body': 'جنهن ماڻهوءَ کي توهان هينئر موڪليو، انهيءَ کي چئو ته اها ئي فائل ڪنهن ٽئين ماڻهوءَ کي هينئر، توهان جي سامهون موڪلي. اهو ئي اهو لمحو آهي جڏهن هي هنر انهن جو پنهنجو ٿي ويندو آهي.',

      'dev.iphone': 'آئي فون يا آئي پيڊ',
      'dev.android': 'اينڊرائيڊ فون',
      'dev.computer': 'ڪمپيوٽر',
      'dev.card': 'هيءُ ئي ڪارڊ',

      'help.title': 'محفوظ ڪيل شيون کولڻ',
      'help.back': 'لائبريري ڏانهن واپس',

      'ui.close': 'بند ڪريو',
      'ui.cancel': 'منسوخ',
      'ui.lang': 'ٻولي',
      'ui.needsnet': 'انٽرنيٽ گهرجي'
    }
  };

  var current = ET.store.get('et.lang', '') || '';
  var listeners = [];

  function t(key, vars) {
    var lang = current || 'en';
    var s = (STRINGS[lang] && STRINGS[lang][key]);
    if (s == null) s = STRINGS.en[key];
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] == null ? m : vars[k];
      });
    }
    return s;
  }

  function meta(code) {
    for (var i = 0; i < LANGS.length; i++) { if (LANGS[i].code === code) return LANGS[i]; }
    return LANGS[0];
  }

  function apply() {
    var m = meta(current || 'en');
    var html = document.documentElement;
    html.setAttribute('lang', m.code);
    html.setAttribute('dir', m.dir);

    ET.$$('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    ET.$$('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    ET.$$('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });

    var label = ET.$('#et-lang-label');
    if (label) label.textContent = m.native;

    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function set(code) {
    current = code;
    ET.store.set('et.lang', code);
    apply();
  }

  function onChange(fn) { listeners.push(fn); }

  /* Did this key fall through to English because the current language has no
     translation for it? */
  function isFallback(key) {
    var lang = current || 'en';
    return lang !== 'en' && !(STRINGS[lang] && STRINGS[lang][key] != null);
  }

  /* Translation with an inline English default.

     The share routes carry a lot of prose. Rather than bloat STRINGS with
     English that is already written down in share.js, they call tOr(): if a
     translator has added the key, that wins; otherwise the English passed in is
     used. Translating the wizard therefore means adding keys here and changing
     nothing else. */
  /* tOr(), escaped and ready to drop into innerHTML.

     Untranslated strings are English. Left alone inside an RTL page the bidi
     algorithm moves their closing full stop to the head of the line, and the
     Nastaliq body face renders their Latin letters. So English that arrives by
     fallback is wrapped as its own LTR island. Once a key is translated the
     wrapper disappears on its own. */
  function tOrHTML(key, fallback) {
    var html = ET.esc(tOr(key, fallback));
    if (isFallback(key) && meta(current || 'en').dir === 'rtl') {
      return '<span class="latin">' + html + '</span>';
    }
    return html;
  }

  function tOr(key, fallback) {
    var lang = current || 'en';
    var s = STRINGS[lang] && STRINGS[lang][key];
    if (s == null && lang !== 'en') s = STRINGS.en[key];
    return s == null ? fallback : s;
  }

  function chosen() { return !!ET.store.get('et.lang', ''); }

  /* The language picker doubles as the first-run screen. Someone who cannot
     read the interface cannot navigate to a settings page to fix that, so the
     options are always shown in their own script, never translated. */
  function picker(force) {
    var rows = LANGS.map(function (l) {
      var on = l.code === (current || 'en');
      return '<button class="tile" data-lang="' + l.code + '" ' +
             'style="width:100%;text-align:start' +
             (on ? ';border-color:var(--purple);background:var(--purple-wash)' : '') + '">' +
             '<span class="ico">' + ET.icon('globe') + '</span>' +
             '<span><span class="t" dir="' + l.dir + '">' + ET.esc(l.native) + '</span>' +
             '<span class="s latin">' + ET.esc(l.name) + '</span></span>' +
             (on ? '<span class="chev">' + ET.icon('check') + '</span>' : '') +
             '</button>';
    }).join('');

    var s = ET.sheet(
      '<h2 data-i18n="home.pick">' + ET.esc(t('home.pick')) + '</h2>' +
      '<p class="muted" data-i18n="home.pick.sub">' + ET.esc(t('home.pick.sub')) + '</p>' +
      '<div class="stack">' + rows + '</div>' +
      (force ? '' : '<div style="margin-top:1rem"><button class="btn ghost block" id="et-lang-x">' +
                    ET.esc(t('ui.close')) + '</button></div>'));

    ET.$$('[data-lang]', s.el).forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-lang')); s.close(); });
    });
    var x = ET.$('#et-lang-x', s.el);
    if (x) x.addEventListener('click', s.close);
    return s;
  }

  ET.i18n = { t: t, tOr: tOr, tOrHTML: tOrHTML, set: set, apply: apply, onChange: onChange, picker: picker,
              chosen: chosen, langs: LANGS, meta: meta, current: function () { return current || 'en'; } };
})(window.ET);
