/* ============================================================================
   Interface strings, and the machinery that swaps them.

   TRANSLATION STATUS
   English is the reference. Every interface language covers the controls,
   help page and sharing guides, and all of them were given a native-reader
   polish pass in October 2026 for natural wording, register and church
   vocabulary. Missing strings still fall back to English. See
   docs/TRANSLATION-HANDOFF.md for terminology notes.

   WHERE THE STRINGS LIVE
   One file per interface language, app/assets/js/i18n/<code>.js, each adding
   its table to window.ET_STRINGS. A page loads en.js (the fallback) and its
   own language before this file, so a phone downloads two small tables, not
   all 38. Switching language loads the new table with a script tag, which
   works on file:// too. SAY below keeps the few lines the welcome screen and
   the "tap to change language" hint show in every language at once.

   Adding a language: add its file in i18n/, add it to LANGS, list the file in
   sw.js. Set `dir` and `font` correctly — the stylesheet keys its
   Arabic-script rules off them.
   ========================================================================= */

window.ET.module('i18n', ['core'], function (ET) {
  'use strict';

  var LANGS = [
    { code: 'en',  name: 'English', native: 'English', dir: 'ltr' },
    { code: 'cmn', name: 'Mandarin', native: '普通话',  dir: 'ltr' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', dir: 'ltr' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', dir: 'ltr' },
    { code: 'ur',  name: 'Urdu',    native: 'اردو',    dir: 'rtl' },
    { code: 'swh', name: 'Swahili', native: 'Kiswahili', dir: 'ltr' },
    { code: 'zul', name: 'Zulu', native: 'isiZulu', dir: 'ltr' },
    { code: 'pnb', name: 'Western Punjabi', native: 'پنجابی', dir: 'rtl' },
    { code: 'yue', name: 'Cantonese', native: '廣東話', dir: 'ltr' },
    { code: 'ps',  name: 'Pashto',  native: 'پښتو',    dir: 'rtl' },
    { code: 'pa', name: 'Eastern Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr' },
    { code: 'ne', name: 'Nepali', native: 'नेपाली', dir: 'ltr' },
    { code: 'snd', name: 'Sindhi',  native: 'سنڌي',    dir: 'rtl' },
    { code: 'mg', name: 'Malagasy', native: 'Malagasy', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'rn', name: 'Kirundi', native: 'Ikirundi', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ak', name: 'Akan', native: 'Twi (Akan)', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ti', name: 'Tigrinya', native: 'ትግርኛ', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', interfaceNote: 'Screenshot guide in English' },
    { code: 'ht', name: 'Haitian Creole', native: 'Kreyòl ayisyen', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'es', name: 'Spanish', native: 'Español', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ny', name: 'Chichewa', native: 'Chichewa', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'xh', name: 'Xhosa', native: 'isiXhosa', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'sn', name: 'Shona', native: 'chiShona', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ha', name: 'Hausa', native: 'Hausa', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ln', name: 'Lingala', native: 'Lingála', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'pcm', name: 'Nigerian Pidgin', native: 'Naija Pidgin', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'yo', name: 'Yoruba', native: 'Èdè Yorùbá', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'pt', name: 'Portuguese', native: 'Português', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'am', name: 'Amharic', native: 'አማርኛ', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'fr', name: 'French', native: 'Français', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'ig', name: 'Igbo', native: 'Asụsụ Igbo', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'om', name: 'Oromo', native: 'Afaan Oromoo', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'luo', name: 'Luo', native: 'Dholuo', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'lg', name: 'Luganda', native: 'Luganda', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'kik', name: 'Kikuyu', native: 'Gĩkũyũ', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'guz', name: 'Gusii', native: 'Ekegusii / Kisii', dir: 'ltr', interfaceNote: 'Screenshot guide in English' },
    { code: 'mas', name: 'Maasai', native: 'ɔl Maa', dir: 'ltr', interfaceNote: 'Screenshot guide in English' }
  ];


  /* The few lines shown in every language at once, whichever table is loaded:
     the welcome screen's greeting, search and counts, and the header hint. */
  var SAY = {
    "en": {"ui.changelang": "Tap to change language", "welcome.title": "Choose your language", "welcome.sub": "The library opens in that language. You can change it any time from the top of the screen.", "welcome.search": "Find a language", "welcome.suggested": "Your phone's language", "welcome.count": "{n} resources: films, Bibles and recordings", "welcome.count.one": "{n} resource: a film, Bible, or recording"},
    "cmn": {"ui.changelang": "点这里更换语言", "welcome.title": "选择你的语言", "welcome.sub": "资料库将以该语言打开。之后可在屏幕顶部随时更改。", "welcome.search": "查找语言", "welcome.suggested": "你手机的语言", "welcome.count": "{n} 项影片、圣经和录音"},
    "hi": {"ui.changelang": "भाषा बदलने के लिए यहाँ दबाएँ", "welcome.title": "अपनी भाषा चुनें", "welcome.sub": "पुस्तकालय उसी भाषा में खुलेगा। आप स्क्रीन के ऊपर से भाषा कभी भी बदल सकते हैं।", "welcome.search": "भाषा खोजें", "welcome.suggested": "आपके फ़ोन की भाषा", "welcome.count": "{n} चीज़ें: फ़िल्में, बाइबल और रिकॉर्डिंग", "welcome.count.one": "{n} चीज़: फ़िल्म, बाइबल या रिकॉर्डिंग"},
    "mr": {"ui.changelang": "भाषा बदलण्यासाठी टॅप करा", "welcome.title": "तुमची भाषा निवडा", "welcome.sub": "ग्रंथालय त्या भाषेत उघडेल. स्क्रीनच्या वरच्या भागातून तुम्ही भाषा कधीही बदलू शकता.", "welcome.search": "भाषा शोधा", "welcome.suggested": "तुमच्या फोनची भाषा", "welcome.count": "{n} नोंदी: चित्रपट, बायबल आणि रेकॉर्डिंग", "welcome.count.one": "{n} नोंद: चित्रपट, बायबल किंवा रेकॉर्डिंग"},
    "ur": {"ui.changelang": "زبان بدلنے کے لیے دبائیں", "welcome.title": "اپنی زبان منتخب کریں", "welcome.sub": "لائبریری اسی زبان میں کھلے گی۔ بعد میں اوپر سے بدل سکتے ہیں۔", "welcome.search": "زبان تلاش کریں", "welcome.suggested": "آپ کے فون کی زبان", "welcome.count": "{n} فلمیں، بائبلیں اور آڈیو", "welcome.count.one": "{n} چیز — فلم، بائبل یا آڈیو"},
    "swh": {"ui.changelang": "Gusa hapa kubadilisha lugha", "welcome.title": "Chagua lugha yako", "welcome.sub": "Maktaba itafunguka kwa lugha hiyo. Unaweza kuibadilisha wakati wowote kutoka sehemu ya juu ya skrini.", "welcome.search": "Tafuta lugha", "welcome.suggested": "Lugha ya simu yako", "welcome.count": "Vitu {n}: filamu, Biblia na rekodi", "welcome.count.one": "Kitu {n}: filamu, Biblia au rekodi"},
    "zul": {"ui.changelang": "Thinta ukuze ushintshe ulimi", "welcome.title": "Khetha ulimi lwakho", "welcome.sub": "Umtapo wolwazi uvuleka ngalolo limi. Ungalushintsha noma nini phezulu esikrinini.", "welcome.search": "Sesha ulimi", "welcome.suggested": "Ulimi lwefoni yakho", "welcome.count": "Izinto ezingu-{n}: amafilimu, amaBhayibheli nokuqoshiwe", "welcome.count.one": "Into engu-{n}: ifilimu, iBhayibheli noma okuqoshiwe"},
    "pnb": {"ui.changelang": "زبان بدلن لئی ایتھے دباؤ", "welcome.title": "اپنی زبان چنو", "welcome.sub": "لائبریری اوسے زبان وچ کھلے گی۔ سکرین دے اتلے حصے توں تسیں ایہنوں کدی وی بدل سکدے او۔", "welcome.search": "زبان لبھو", "welcome.suggested": "تہاڈے فون دی زبان", "welcome.count": "{n} فلماں، بائبلاں تے ریکارڈنگاں", "welcome.count.one": "{n} فلم، بائبل یا ریکارڈنگ"},
    "yue": {"ui.changelang": "撳呢度換語言", "welcome.title": "揀你嘅語言", "welcome.sub": "資料庫會用呢種語言打開。之後可以喺螢幕頂部隨時更改。", "welcome.search": "搵語言", "welcome.suggested": "你部手機嘅語言", "welcome.count": "{n} 項影片、聖經同錄音"},
    "ps": {"ui.changelang": "ژبه بدلولو لپاره کېکاږئ", "welcome.title": "خپله ژبه وټاکئ", "welcome.sub": "کتابتون به په همدې ژبه پرانیستل شي. وروسته یې له پاسه بدلولی شئ.", "welcome.search": "ژبه ولټوئ", "welcome.suggested": "ستاسو د تلیفون ژبه", "welcome.count": "{n} توکي: فلمونه، بایبلونه او غږیز ثبتونه", "welcome.count.one": "{n} توکی — فلم، بایبل یا غږیز ثبت"},
    "pa": {"ui.changelang": "ਭਾਸ਼ਾ ਬਦਲਣ ਲਈ ਇੱਥੇ ਦਬਾਓ", "welcome.title": "ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ", "welcome.sub": "ਲਾਇਬ੍ਰੇਰੀ ਉਸੇ ਭਾਸ਼ਾ ਵਿੱਚ ਖੁੱਲ੍ਹੇਗੀ। ਸਕ੍ਰੀਨ ਦੇ ਉੱਪਰਲੇ ਹਿੱਸੇ ਤੋਂ ਤੁਸੀਂ ਇਸਨੂੰ ਕਦੇ ਵੀ ਬਦਲ ਸਕਦੇ ਹੋ।", "welcome.search": "ਭਾਸ਼ਾ ਲੱਭੋ", "welcome.suggested": "ਤੁਹਾਡੇ ਫ਼ੋਨ ਦੀ ਭਾਸ਼ਾ", "welcome.count": "{n} ਫ਼ਿਲਮਾਂ, ਬਾਈਬਲਾਂ ਅਤੇ ਰਿਕਾਰਡਿੰਗਾਂ", "welcome.count.one": "{n} ਫ਼ਿਲਮ, ਬਾਈਬਲ ਜਾਂ ਰਿਕਾਰਡਿੰਗ"},
    "ne": {"ui.changelang": "भाषा बदल्न यहाँ थिच्नुहोस्", "welcome.title": "आफ्नो भाषा छान्नुहोस्", "welcome.sub": "छानेको भाषामा पुस्तकालय खुल्छ। भाषा बदल्न माथिको भाषा बटन थिच्नुहोस्।", "welcome.search": "भाषा खोज्नुहोस्", "welcome.suggested": "तपाईंको फोनको भाषा", "welcome.count": "{n} वटा सामग्री: फिल्म, बाइबल र अडियो", "welcome.count.one": "{n} वटा सामग्री: फिल्म, बाइबल वा अडियो"},
    "snd": {"ui.changelang": "ٻولي مٽائڻ لاءِ دٻايو", "welcome.title": "پنهنجي ٻولي چونڊيو", "welcome.sub": "لائبريري انهيءَ ٻوليءَ ۾ کلندي. پوءِ مٿان کان بدلائي سگهو ٿا.", "welcome.search": "ٻولي ڳوليو", "welcome.suggested": "توهان جي فون جي ٻولي", "welcome.count": "{n} فلمون، بائيبلون ۽ آڊيو", "welcome.count.one": "{n} شيءِ — فلم، بائيبل يا آڊيو"},
    "mg": {"ui.changelang": "Tsindrio hanova fiteny", "welcome.title": "Fidio ny fiteninao", "welcome.sub": "Hisokatra amin’io fiteny io ny trano famakiam-boky. Azonao ovaina amin’ny fotoana rehetra eo an-tampon’ny efijery izany.", "welcome.search": "Mitadiava fiteny", "welcome.suggested": "Ny fitenin’ny findainao", "welcome.count": "Votoaty {n}: sarimihetsika, Baiboly ary rakipeo", "welcome.count.one": "Votoaty {n}: sarimihetsika, Baiboly na rakipeo"},
    "rn": {"ui.changelang": "Fyonda uhindure ururimi", "welcome.title": "Hitamwo ururimi rwawe", "welcome.sub": "Isomero riruguruka muri urwo rurimi. Urashobora kuruhindura igihe cose uhereye hejuru ku rupapuro.", "welcome.search": "Rondera ururimi", "welcome.suggested": "Ururimi rwa terefone yawe", "welcome.count": "Ibintu {n}: filime, Bibiliya n’amajwi yafashwe", "welcome.count.one": "Ikintu {n}: filime, Bibiliya canke amajwi yafashwe"},
    "ak": {"ui.changelang": "Mia ha sesa kasa", "welcome.title": "Yi wo kasa", "welcome.sub": "Nwomakorabea no bɛbue wɔ saa kasa no mu. Wobɛtumi asesa no bere biara wɔ screen no atifi.", "welcome.search": "Hwehwɛ kasa", "welcome.suggested": "Wo fon kasa", "welcome.count": "Nneɛma {n}: sini, Twerɛ Kronkron ne nne a wɔakyere", "welcome.count.one": "Adeɛ {n}: sini, Twerɛ Kronkron anaa nne a wɔakyere"},
    "ti": {"ui.changelang": "ቋንቋ ንምቕያር ጠውቑ", "welcome.title": "ቋንቋኹም ምረጹ", "welcome.sub": "ቤተ መጻሕፍቲ በቲ ቋንቋ ክኽፈት እዩ። ኣብ ዝኾነ እዋን ካብ ላዕሊ ስክሪን ክትቕይርዎ ትኽእሉ።", "welcome.search": "ቋንቋ ድለዩ", "welcome.suggested": "ቋንቋ ስልኪኹም", "welcome.count": "{n} ትሕዝቶታት፦ ፊልምታት፣ መጽሓፍ ቅዱስን ናይ ድምጺ ቅዳሓትን", "welcome.count.one": "{n} ትሕዝቶ፦ ፊልም፣ መጽሓፍ ቅዱስ ወይ ናይ ድምጺ ቅዳሕ"},
    "ar": {"ui.changelang": "اضغط لتغيير اللغة", "welcome.title": "اختر لغتك", "welcome.sub": "ستُفتح المكتبة بهذه اللغة، ويمكنك تغييرها في أي وقت من أعلى الشاشة.", "welcome.search": "ابحث عن لغة", "welcome.suggested": "لغة هاتفك", "welcome.count": "أفلام وأسفار وتسجيلات: {n}", "welcome.count.one": "{n} مادة: فيلم أو سِفر أو تسجيل"},
    "ht": {"ui.changelang": "Tape pou chanje lang", "welcome.title": "Chwazi lang ou", "welcome.sub": "Bibliyotèk la ap louvri nan lang sa a. Ou ka chanje l nenpòt lè anwo ekran an.", "welcome.search": "Chèche yon lang", "welcome.suggested": "Lang telefòn ou", "welcome.count": "{n} resous: fim, Bib ak anrejistreman", "welcome.count.one": "{n} resous: yon fim, yon Bib oswa yon anrejistreman"},
    "es": {"ui.changelang": "Toque para cambiar de idioma", "welcome.title": "Elija su idioma", "welcome.sub": "La biblioteca se abrirá en este idioma. Puede cambiarlo cuando quiera en la parte superior de la pantalla.", "welcome.search": "Buscar un idioma", "welcome.suggested": "Idioma de su teléfono", "welcome.count": "{n} recursos: películas, Biblias y grabaciones", "welcome.count.one": "{n} recurso: una película, una Biblia o una grabación"},
    "ny": {"ui.changelang": "Dinani kuti musinthe chilankhulo", "welcome.title": "Sankhani chilankhulo chanu", "welcome.sub": "Laibulale idzatseguka m’chilankhulo chimenecho. Mungachisinthe nthawi iliyonse pamwamba pa sikirini.", "welcome.search": "Pezani chilankhulo", "welcome.suggested": "Chilankhulo cha foni yanu", "welcome.count": "Zinthu {n}: mafilimu, Mabaibulo ndi zomvetsera", "welcome.count.one": "Chinthu {n}: filimu, Baibulo kapena zomvetsera"},
    "rw": {"ui.changelang": "Kanda uhindure ururimi", "welcome.title": "Hitamo ururimi rwawe", "welcome.sub": "Isomero rirafunguka muri urwo rurimi. Ushobora kuruhindura igihe cyose uhereye hejuru kuri paji.", "welcome.search": "Shakisha ururimi", "welcome.suggested": "Ururimi rwa telefone yawe", "welcome.count": "Ibintu {n}: filime, Bibiliya n’amajwi", "welcome.count.one": "Ikintu {n}: filime, Bibiliya cyangwa amajwi"},
    "xh": {"ui.changelang": "Cofa ukuze utshintshe ulwimi", "welcome.title": "Khetha ulwimi lwakho", "welcome.sub": "Ithala liza kuvuleka ngolo lwimi. Ungalutshintsha nangaliphi na ixesha ngeqhosha eliphezulu kwisikrini.", "welcome.search": "Khangela ulwimi", "welcome.suggested": "Ulwimi lwefowuni yakho", "welcome.count": "Izinto ezi-{n}: iifilimu, iiBhayibhile neerekhodingi", "welcome.count.one": "Into e-{n}: ifilimu, iBhayibhile okanye irekhodingi"},
    "sn": {"ui.changelang": "Dzvanya kuti uchinje mutauro", "welcome.title": "Sarudza mutauro wako", "welcome.sub": "Raibhurari ichavhurika nemutauro iwoyo. Unogona kuuchinja chero nguva nebhatani riri kumusoro kwesikirini.", "welcome.search": "Tsvaga mutauro", "welcome.suggested": "Mutauro wefoni yako", "welcome.count": "Zvinhu {n}: mafirimu, Mabhaibheri neodhiyo", "welcome.count.one": "Chinhu {n}: firimu, Bhaibheri kana odhiyo"},
    "ha": {"ui.changelang": "Taɓa don canza harshe", "welcome.title": "Zaɓi harshenka", "welcome.sub": "Ɗakin karatu zai buɗe cikin wannan harshen. Za ka iya canza shi daga saman allon a kowane lokaci.", "welcome.search": "Nemi harshe", "welcome.suggested": "Harshen wayarka", "welcome.count": "Abubuwa {n}: fina-finai, Littafi Mai Tsarki da sauti", "welcome.count.one": "Abu {n}: fim, Littafi Mai Tsarki ko sauti"},
    "ln": {"ui.changelang": "Fina mpo na kobongola lokota", "welcome.title": "Pona lokota na yo", "welcome.sub": "Bibliotɛkɛ ekofungwama na lokota yango. Okoki kobongola yango ntango nyonso na likoló ya écran.", "welcome.search": "Luka lokota", "welcome.suggested": "Lokota ya telefone na yo", "welcome.count": "Biloko {n}: bafilme, Biblia mpe baenregistrement", "welcome.count.one": "Eloko {n}: filme, Biblia to enregistrement"},
    "pcm": {"ui.changelang": "Tap here to change language", "welcome.title": "Choose di language wey you wan use", "welcome.sub": "Di library go open for dat language. You fit change am anytime from di top of di screen.", "welcome.search": "Find language", "welcome.suggested": "Your phone language", "welcome.count": "{n} things: films, Bibles and recordings", "welcome.count.one": "{n} thing: film, Bible or recording"},
    "yo": {"ui.changelang": "Tẹ láti yí èdè padà", "welcome.title": "Yan èdè rẹ", "welcome.sub": "Ilé ìkàwé yóò ṣí ní èdè yẹn. O lè yí i padà nígbàkigbà ní òkè ojú ìwé.", "welcome.search": "Wá èdè kan", "welcome.suggested": "Èdè fóònù rẹ", "welcome.count": "Ohun {n}: fíìmù, Bíbélì àti ìgbàsílẹ̀ ohùn", "welcome.count.one": "Ohun {n}: fíìmù, Bíbélì tàbí ìgbàsílẹ̀ ohùn"},
    "pt": {"ui.changelang": "Toque para mudar o idioma", "welcome.title": "Escolha seu idioma", "welcome.sub": "A biblioteca abrirá nesse idioma. Você pode mudar a qualquer momento pelo botão no alto da tela.", "welcome.search": "Buscar um idioma", "welcome.suggested": "Idioma do seu celular", "welcome.count": "{n} recursos: filmes, Bíblias e áudios", "welcome.count.one": "{n} recurso: filme, Bíblia ou áudio"},
    "am": {"ui.changelang": "ቋንቋ ለመቀየር ይንኩ", "welcome.title": "ቋንቋዎን ይምረጡ", "welcome.sub": "ቤተ መጻሕፍቱ በዚያ ቋንቋ ይከፈታል። በማንኛውም ጊዜ ከማያ ገጹ አናት መቀየር ይችላሉ።", "welcome.search": "ቋንቋ ይፈልጉ", "welcome.suggested": "የስልክዎ ቋንቋ", "welcome.count": "{n} ይዘቶች፦ ፊልሞች፣ መጽሐፍ ቅዱስና የድምፅ ቅጂዎች", "welcome.count.one": "{n} ይዘት፦ ፊልም፣ መጽሐፍ ቅዱስ ወይም የድምፅ ቅጂ"},
    "fr": {"ui.changelang": "Appuyez pour changer de langue", "welcome.title": "Choisissez votre langue", "welcome.sub": "La bibliothèque s’ouvre dans cette langue. Vous pouvez la changer à tout moment en haut de l’écran.", "welcome.search": "Rechercher une langue", "welcome.suggested": "Langue de votre téléphone", "welcome.count": "{n} ressources : films, Bibles et enregistrements", "welcome.count.one": "{n} ressource : un film, une Bible ou un enregistrement"},
    "ig": {"ui.changelang": "Pịa iji gbanwee asụsụ", "welcome.title": "Họrọ asụsụ gị", "welcome.sub": "Ọba akwụkwọ ga-emepe n’asụsụ ahụ. Ị nwere ike ịgbanwe ya mgbe ọ bụla site n’elu ihuenyo.", "welcome.search": "Chọọ asụsụ", "welcome.suggested": "Asụsụ ekwentị gị", "welcome.count": "Ihe {n}: vidio, Baịbụl na ụda e dekọrọ", "welcome.count.one": "Ihe {n}: vidio, Baịbụl ma ọ bụ ụda e dekọrọ"},
    "om": {"ui.changelang": "Afaan jijjiiruuf tuqi", "welcome.title": "Afaan filadhu", "welcome.sub": "Laayibrariin afaan filatteen banama. Yeroo barbaadde gubbaa iskiriinii irraa afaan jijjiiruu dandeessa.", "welcome.search": "Afaan barbaadi", "welcome.suggested": "Afaan bilbila kee", "welcome.count": "Qabiyyee {n}: viidiyoowwan, Kitaaba Qulqulluu fi waraabbii sagalee", "welcome.count.one": "Qabiyyee {n}: viidiyoo, Kitaaba Qulqulluu yookiin waraabbii sagalee"},
    "luo": {"ui.changelang": "Mul mondo ilok dhok", "welcome.title": "Yier dhok", "welcome.sub": "Laibrari noyaw e dhok ma iyiero. Inyalo loko dhok saa asaya koa ewi skrin.", "welcome.search": "Many dhok", "welcome.suggested": "Dhok mar simuni", "welcome.count": "Gik {n}: vidio, Muma kod weche momaki", "welcome.count.one": "Gima {n}: vidio, Muma kata weche momaki"},
    "lg": {"ui.changelang": "Nyiga okukyusa olulimi", "welcome.title": "Londa olulimi lwo", "welcome.sub": "Layibulale ejja kugguka mu lulimi olwo. Osobola okulukyusa essaawa yonna okuva waggulu ku ssirini.", "welcome.search": "Noonya olulimi", "welcome.suggested": "Olulimi lw’essimu yo", "welcome.count": "Ebintu {n}: firimu, Bayibuli n’amaloboozi agakwatiddwa", "welcome.count.one": "Ekintu {n}: firimu, Bayibuli, oba eddoboozi erikwatiddwa"},
    "kik": {"ui.changelang": "Hutia nĩguo ũcenjie rũthiomi", "welcome.title": "Thuura rũthiomi rwaku", "welcome.sub": "Maktaba nĩ ĩkũhingũka na rũthiomi rũu. No ũrũcenjie hĩndĩ o yothe kuuma igũrũ wa skrini.", "welcome.search": "Etha rũthiomi", "welcome.suggested": "Rũthiomi rwa thimũ yaku", "welcome.count": "Indo {n}: filamu, Bibilia, na rekodi", "welcome.count.one": "Kĩndũ {n}: filamu, Bibilia, kana rekodi"},
    "guz": {"ui.changelang": "Kanda goguchia omonwa", "welcome.title": "Sora omonwa oyo", "welcome.sub": "Laiburari nigo egoigoka ase omonwa oyio. Noranyare goguchia ensa yonsi korwa igoro ase skrini.", "welcome.search": "Rigia omonwa", "welcome.suggested": "Omonwa ase esimu yao", "welcome.count": "Ebinto {n}: chifirimu, Chibibilia na chirekodi", "welcome.count.one": "Egento {n}: efirimu, Ebibilia, kana erekodi"},
    "mas": {"ui.changelang": "Ibung' pee ibelekeny enkutuk", "welcome.title": "Ashilu enkutuk", "welcome.sub": "Ebolita Enkaji e Imbukui te enkutuk ena. Idim aibelekeny pooki enkata te shumata e epeji.", "welcome.search": "Aing'oru enkutuk", "welcome.suggested": "Enkutuk e esimu ino", "welcome.count": "Intokitin {n}: ifilim, Ibiblia o iltoilo", "welcome.count.one": "Entoki {n}: efilim, Biblia, anaa oltoilo"}
  };

  /* Strings a feature module carries itself, such as features/onboarding:
     ET.i18n.extend({ en: {...}, swh: {...} }). Looked up after the language's
     own file, so a line in i18n/<code>.js always wins. */
  var EXTRA = {};
  function extend(tables) {
    for (var code in tables) {
      var into = EXTRA[code] || (EXTRA[code] = {});
      for (var k in tables[code]) into[k] = tables[code][k];
    }
  }

  function loaded(lang) { return !!(window.ET_STRINGS && window.ET_STRINGS[lang]); }

  /* One line in one language, or undefined: the language's own file (if this
     page has loaded it), else the every-language table above, then any
     module's extra strings. */
  function entry(lang, key) {
    var file = window.ET_STRINGS && window.ET_STRINGS[lang];
    var s = file ? file[key] : SAY[lang] && SAY[lang][key];
    if (s == null && EXTRA[lang]) s = EXTRA[lang][key];
    return s;
  }

  /* Load one language's table, then call done. A plain <script> tag rather
     than fetch, so it works off a card. A failed load still calls done, and
     the page falls back to English. */
  function load(lang, done) {
    if (loaded(lang) || !/^[a-z]{2,3}$/.test(lang)) { done(); return; }
    var s = document.createElement('script');
    s.src = 'assets/js/i18n/' + lang + '.js';
    s.onload = s.onerror = function () { s.onload = s.onerror = null; done(); };
    document.head.appendChild(s);
  }

  var shared = ET.libraryScope();
  var current = (shared && shared.ui) || ET.store.get('et.lang', '') || '';
  var listeners = [];

  function countedKey(key, vars) {
    var count = vars && (vars.n != null ? vars.n : vars.items);
    return count != null && Number(count) === 1 ? key + '.one' : key;
  }

  function translate(key, lang, vars) {
    // Optional singular wording keeps counts such as “1 item” grammatical.
    // Languages without a singular variant retain their normal translation.
    var form = countedKey(key, vars);
    var s = entry(lang, form);
    if (s == null) s = entry(lang, key);
    if (s == null) s = entry('en', form);
    if (s == null) s = entry('en', key);
    if (s == null) return key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] == null ? m : vars[k];
      });
    }
    return s;
  }

  function t(key, vars) {
    return translate(key, current || 'en', vars);
  }

  /* One string in a language that is not the current one — for the hint that
     cycles "tap to change language" through all of them. */
  function say(key, code, vars) {
    return translate(key, code, vars);
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
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key);
      el.setAttribute('lang', isFallback(key) ? 'en' : m.code);
    });
    ET.$$('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key));
      el.setAttribute('lang', isFallback(key) ? 'en' : m.code);
    });
    ET.$$('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
      el.setAttribute('lang', isFallback(key) ? 'en' : m.code);
    });

    var label = ET.$('#et-lang-label');
    if (label) {
      label.textContent = m.native;
      // Spoken as "Language, English": voice control can say the word it sees.
      label.parentNode.setAttribute('aria-label', t('ui.lang') + ', ' + m.native);
    }

    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /* Switch language. The new language's file may need loading first, so the
     switch lands a moment later; done, if given, runs once it has. */
  function set(code, done) {
    ET.store.set('et.lang', code);
    load(code, function () {
      current = code;
      apply();
      if (done) done();
    });
  }

  function onChange(fn) { listeners.push(fn); }

  /* Did this key fall through to English because the current language has no
     translation for it? */
  function isFallback(key, vars, code) {
    var lang = code || current || 'en';
    return lang !== 'en' && entry(lang, countedKey(key, vars)) == null && entry(lang, key) == null;
  }

  /* Translation with an inline English default.

     The share routes carry a lot of prose. Rather than bloat the tables with
     English that is already written down in share.js, they call tOr(): if a
     translator has added the key, that wins; otherwise the English passed in is
     used. Translating the wizard therefore means adding keys here and changing
     nothing else. */
  /* tOr(), escaped and ready to drop into innerHTML.

     Untranslated strings are marked as English for assistive readers.
     Left alone inside an RTL page the bidi
     algorithm moves their closing full stop to the head of the line, and the
     Nastaliq body face renders their Latin letters. So English that arrives by
     fallback is wrapped as its own LTR island. Once a key is translated the
     wrapper disappears on its own. */
  function tOrHTML(key, fallback) {
    var html = ET.esc(tOr(key, fallback));
    if (isFallback(key)) {
      return '<span class="latin" lang="en" dir="ltr">' + html + '</span>';
    }
    return html;
  }

  /* t(), escaped for innerHTML, and made an LTR island when the current
     language has no translation yet and English is showing instead. Use this
     for anything rendered as HTML. */
  function h(key, vars) {
    var html = ET.esc(t(key, vars));
    if (isFallback(key, vars)) {
      return '<span class="latin" lang="en" dir="ltr">' + html + '</span>';
    }
    return html;
  }

  function tOr(key, fallback) {
    var lang = current || 'en';
    var s = entry(lang, key);
    if (s == null && lang !== 'en') s = entry('en', key);
    return s == null ? fallback : s;
  }

  function chosen() { return !!ET.store.get('et.lang', ''); }

  // Pickers list languages A to Z by English name; LANGS keeps English first
  // because it is the fallback.
  function byName() {
    return LANGS.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });
  }

  /* The language picker doubles as the first-run screen. Someone who cannot
     read the interface cannot navigate to a settings page to fix that, so the
     options are always shown in their own script, never translated. */
  function picker(force) {
    var rows = byName().map(function (l) {
      var on = l.code === (current || 'en');
      return '<button class="et-tile" data-lang="' + l.code + '" data-find="' +
             ET.esc((l.name + ' ' + l.native + ' ' + l.code).toLowerCase()) + '" ' +
             'aria-pressed="' + on + '">' +
             '<span class="et-tile__icon">' + ET.icon('globe') + '</span>' +
             '<span class="et-tile__text"><span class="et-tile__title" dir="' + l.dir + '" lang="' + l.code + '">' + ET.esc(l.native) + '</span>' +
             '<span class="et-tile__sub latin" lang="en">' + ET.esc(l.name) + '</span>' +
             (l.interfaceNote ? '<span class="et-tile__sub latin" lang="en">' + ET.esc(l.interfaceNote) + '</span>' : '') + '</span>' +
             (on ? '<span class="et-tile__end">' + ET.icon('check') + '</span>' : '') +
             '</button>';
    }).join('');

    var s = ET.sheet(
      '<p class="muted" data-i18n="home.pick.sub">' + ET.esc(t('home.pick.sub')) + '</p>' +
      '<div class="search" style="margin-bottom:.8rem">' + ET.icon('search') +
        '<input type="search" id="et-picker-q" autocomplete="off" enterkeyhint="search" ' +
        'placeholder="' + ET.esc(t('welcome.search')) + '" aria-label="' +
        ET.esc(t('welcome.search')) + '"></div>' +
      '<div class="stack">' + rows + '</div>', { title: t('home.pick') });

    ET.$$('[data-lang]', s.el).forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-lang')); s.close(); });
    });
    ET.$('#et-picker-q', s.el).addEventListener('input', function () {
      var query = this.value.trim().toLowerCase();
      ET.$$('[data-find]', s.el).forEach(function (b) {
        b.hidden = !!query && b.getAttribute('data-find').indexOf(query) < 0;
      });
    });
    return s;
  }

  /* The phone's own language, as one of ours — so someone in Nairobi sees
     Kiswahili at the top of the list instead of hunting past English. */
  var BROWSER = [
    [/^(pt|por)(?:[-_]|$)/i, 'pt'],
    [/^(am|amh)(?:[-_]|$)/i, 'am'],
    [/^pa[-_](arab|pk)/i, 'pnb'], [/^pnb/i, 'pnb'], [/^pa/i, 'pa'],
    [/^zh[-_](hk|mo|tw|hant)|^yue/i, 'yue'], [/^zh/i, 'cmn'],
    [/^sw/i, 'swh'], [/^hi/i, 'hi'], [/^mr/i, 'mr'], [/^ur/i, 'ur'], [/^ps/i, 'ps'], [/^sd/i, 'snd'],
    [/^(ar|ara|arb)(?:[-_]|$)/i, 'ar'],
    [/^(ht|hat)(?:[-_]|$)/i, 'ht'],
    [/^(es|spa)(?:[-_]|$)/i, 'es'],
    [/^(fr|fra|fre)(?:[-_]|$)/i, 'fr'],
    [/^(ig|ibo)(?:[-_]|$)/i, 'ig'],
    [/^(om|orm|gaz|hae|gax)(?:[-_]|$)/i, 'om'],
    [/^luo(?:[-_]|$)/i, 'luo'],
    [/^(lg|lug)(?:[-_]|$)/i, 'lg'],
    [/^(ki|kik)(?:[-_]|$)/i, 'kik'],
    [/^ne/i, 'ne'], [/^guz/i, 'guz'], [/^zu/i, 'zul'], [/^mas/i, 'mas'], [/^en/i, 'en']
  ];
  function suggested() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < BROWSER.length; j++) {
        if (BROWSER[j][0].test(list[i] || '')) return BROWSER[j][1];
      }
    }
    return '';
  }

  /* The rest of the front door, below the language list: how sharing works,
     the offer to content partners, and what is coming. English only and
     marked so; the reader-facing library is fully translated. */
  function landing() {
    function step(n, cls, icon, title, text) {
      return '<li class="lp-step ' + cls + '"><span class="lp-ico">' + ET.icon(icon) + '</span>' +
        '<span class="lp-n">' + n + ' · ' + title + '</span><span>' + text + '</span></li>';
    }
    function stat(n, label, cls) {
      return '<li class="lp-stat ' + cls + '"><strong>' + n + '</strong><span>' + label + '</span></li>';
    }
    var stats = { langs: 0, items: 0 };
    try {
      stats.items = ET.library().resources.length;
      stats.langs = Object.keys(ET.library().languages || {}).length;
    } catch (e) {}
    stats.langs = stats.langs || '50+';
    stats.items = stats.items ? stats.items.toLocaleString('en') : 'Hundreds of';
    function phase(cls, tag, title, text) {
      return '<li class="lp-phase ' + cls + '"><span class="lp-tag">' + tag + '</span>' +
        '<strong>' + title + '</strong><span>' + text + '</span></li>';
    }
    return '<section class="lp-band lp-how" id="et-how" lang="en" dir="ltr"><div class="lp-in">' +
        '<h2 class="display">One phone lights the next</h2>' +
        '<p class="lp-lead">Most people we serve have little or no data. So the library is built to be ' +
          'saved once and shared the rest of the way, from one phone to another, with no internet at all.</p>' +
        '<ol class="lp-steps">' +
          step(1, 'purple', 'globe', 'Choose', 'Pick your language. Everything, buttons included, switches to it.') +
          step(2, 'sky', 'save', 'Save', 'Save a film or Bible to your phone once, wherever there is Wi‑Fi or a VillageServer.') +
          step(3, 'gold', 'share', 'Pass it on', 'Show a code. Your friend scans it and it copies across, phone to phone.') +
        '</ol>' +
      '</div></section>' +
      '<section class="lp-band lp-partners" lang="en" dir="ltr"><div class="lp-in lp-partners-in">' +
        '<div class="lp-partners-copy">' +
          '<p class="lp-eyebrow">For ministries and content partners</p>' +
          '<h2 class="display">Bring your library. We carry it the last mile.</h2>' +
          '<p class="lp-lead">You have the films, Bibles and teaching. We put them in people\'s hands ' +
            'where the internet stops, and show you where they travel.</p>' +
          '<ol class="lp-flow">' +
            '<li><span class="lp-flow-n">1</span><span><strong>Send us your files.</strong> Films, audio, PDFs, in any language.</span></li>' +
            '<li><span class="lp-flow-n">2</span><span><strong>We shelve them.</strong> Your titles join every library that speaks the language.</span></li>' +
            '<li><span class="lp-flow-n">3</span><span><strong>They travel offline.</strong> Phone to phone, memory cards and VillageServer hubs, with no data cost to the viewer.</span></li>' +
          '</ol>' +
          '<a class="btn big lp-partner-btn" href="https://villageservers.org" target="_blank" rel="noopener">Partner with us</a>' +
        '</div>' +
        // Counted from the library this page carries, so the numbers are
        // always the ones a visitor can open.
        '<ul class="lp-stats">' +
          stat(stats.langs, 'languages with their own library', 'purple') +
          stat(stats.items, 'films, Bibles and audio', 'green') +
          stat('0', 'data cost to share', 'gold') +
          stat('20–40', 'phones per VillageServer hub', 'sky') +
        '</ul>' +
      '</div></section>' +
      '<section class="lp-band lp-next" lang="en" dir="ltr"><div class="lp-in">' +
        '<h2 class="display">What\'s coming</h2>' +
        '<ol class="lp-phases">' +
          phase('now', 'Live now', 'The web library', 'Films, Bibles and audio in 50+ languages, saved to the phone and shared by link or nearby code.') +
          phase('next', 'Next', 'iPhone and Android apps', 'Share by QR code between any two phones, with Kandili the lantern and full offline playback.') +
          phase('then', 'Then', 'VillageServer hubs', 'One small server lights a whole village: 20 to 40 phones at once.') +
        '</ol>' +
      '</div></section>' +
      '<footer class="lp-foot" lang="en" dir="ltr"><div class="lp-in">' +
        'A VillageServer Initiative. Content from the Digital Bible Society and partners. Always free.' +
      '</div></footer>';
  }

  /* Kandili's first-run funnel: its stylesheet, words and script, fetched
     after the welcome screen has painted and only on a first visit. Plain
     tags, so it loads from file:// off a card exactly as it does online. */
  function funnel(el) {
    if (ET.$('#et-funnel-js')) return;
    var head = document.head;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'assets/css/pages/onboarding.css';
    head.appendChild(css);
    ['assets/js/data/onboarding-strings.js', 'assets/js/features/onboarding.js'].forEach(function (src, i) {
      var sc = document.createElement('script');
      sc.src = src;
      sc.async = false;   // run in order: the words before the funnel
      if (i) {
        sc.id = 'et-funnel-js';
        sc.onload = function () { if (ET.onboarding && el.isConnected) ET.onboarding.decorate(el); };
      }
      head.appendChild(sc);
    });
  }

  /* First run: a whole screen, not a sheet. It cannot be dismissed — there is
     no sensible default for someone who has not said what they read — and it
     says how much is waiting in each language, so choosing one is choosing a
     library rather than a setting. */
  function welcome() {
    if (ET.$('#et-welcome')) return;
    var guess = suggested();
    var counts = {};
    try {
      ET.library().resources.forEach(function (r) { counts[r.lang] = (counts[r.lang] || 0) + 1; });
    } catch (e) {}
    var order = byName();
    if (guess) order.sort(function (a, b) { return (b.code === guess) - (a.code === guess); });

    var el = document.createElement('div');
    el.id = 'et-welcome';
    el.className = 'welcome';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'et-welcome-h');
    var hello = ['en', 'hi', 'ur', 'swh', 'cmn'].filter(function (c) { return c !== guess; }).slice(0, 4);
    if (guess) hello.unshift(guess);
    // The first screen anyone sees, so it doubles as the front door: what this
    // is and why it matters (in English, for partners and first-time visitors),
    // then straight into the language list, which is the only thing a reader
    // has to do. The hero's own button speaks the reader's language.
    var pick = say('welcome.title', guess || 'en');
    el.innerHTML =
      '<section class="lp-hero" lang="en" dir="ltr">' +
        '<div class="lp-in lp-hero-in">' +
          '<div class="lp-copy">' +
            '<ul class="lp-chips"><li class="lp-chip">Works offline</li><li class="lp-chip">50+ languages</li>' +
              '<li class="lp-chip">No ads · No sign-up · Free</li></ul>' +
            '<p class="lp-h display">Light that travels <span>phone to phone.</span></p>' +
            '<p class="lp-sub">Films, Bibles and audio Scripture in your own language. ' +
              'Save them once, then pass them to anyone nearby. No internet needed.</p>' +
            '<div class="lp-ctas">' +
              '<a class="btn big" href="#et-welcome-pick">' + ET.icon('globe') +
                '<span dir="auto" lang="' + (guess || 'en') + '">' + ET.esc(pick) + '</span></a>' +
              '<a class="btn ghost lp-ghost" href="#et-how">How sharing works</a>' +
            '</div>' +
          '</div>' +
          // Kandili over a village at dusk, flames drifting down to phones:
          // the whole idea in one picture. 23 KB, size held so nothing jumps.
          '<div class="lp-art">' +
            '<picture><source srcset="assets/art/kandili-village.webp" type="image/webp">' +
            '<img src="assets/art/kandili-village.jpg" width="971" height="465" decoding="async" ' +
              'alt="Kandili the lantern floats over a village at night, sending small flames down to the phones people hold up."></picture>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="welcome-in" id="et-welcome-pick">' +
        (ET.lantern ? '<div class="welcome-mascot">' + ET.lantern(88, 'hello') + '</div>' : '') +
        '<h1 id="et-welcome-h" dir="auto">' + ET.esc(say('welcome.title', guess || 'en')) + '</h1>' +
        '<p class="welcome-also">' + hello.slice(1).map(function (c) {
          return '<span dir="' + meta(c).dir + '">' + ET.esc(say('welcome.title', c)) + '</span>';
        }).join('<span aria-hidden="true"> · </span>') + '</p>' +
        '<p class="muted" dir="auto">' + ET.esc(say('welcome.sub', guess || 'en')) + '</p>' +
        (order.length > 8 ? '<div class="search welcome-search">' + ET.icon('search') +
          '<input type="search" id="et-welcome-q" autocomplete="off" enterkeyhint="search" placeholder="' +
          ET.esc(say('welcome.search', guess || 'en')) + '" aria-label="' + ET.esc(say('welcome.search', guess || 'en')) + '"></div>' : '') +
        '<div class="welcome-list" role="list">' + order.map(function (l) {
          var n = counts[ET.contentCode ? ET.contentCode(l.code) : l.code] || 0;
          return '<button class="welcome-lang' + (l.code === guess ? ' guess' : '') + '" role="listitem" data-lang="' + l.code + '" ' +
            'data-find="' + ET.esc((l.name + ' ' + l.native + ' ' + l.code).toLowerCase()) + '">' +
            '<span class="wl-text"><span class="wl-native" dir="' + l.dir + '" lang="' + l.code + '">' + ET.esc(l.native) + '</span>' +
            '<span class="wl-name latin" lang="en">' + ET.esc(l.name) +
              (l.code === guess ? ' · ' + ET.esc(say('welcome.suggested', 'en')) : '') + '</span>' +
            (l.interfaceNote ? '<span class="wl-name latin" lang="en">' + ET.esc(l.interfaceNote) + '</span>' : '') +
            (n ? '<span class="wl-count" dir="' + l.dir + '" lang="' +
              (isFallback('welcome.count', { n: n }, l.code) ? 'en' : l.code) + '">' +
              ET.esc(say('welcome.count', l.code, { n: n })) + '</span>' : '') +
            '</span>' +
            '<span class="wl-go" aria-hidden="true">' + ET.icon('chev') + '</span>' +
          '</button>';
        }).join('') + '</div>' +
      '</div>' +
      landing();
    document.body.appendChild(el);
    document.documentElement.classList.add('welcoming');
    if (ET.loadMascot) ET.loadMascot();
    funnel(el);

    function done() {
      el.remove();
      document.documentElement.classList.remove('welcoming');
      window.scrollTo(0, 0);
    }
    ET.$$('[data-lang]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        // Stay on this screen until the chosen language has loaded, so the
        // library never flashes up in English first.
        b.setAttribute('aria-busy', 'true');
        set(b.getAttribute('data-lang'), function () {
          b.removeAttribute('aria-busy');
          // Kandili's questions take over from here (features/onboarding.js).
          // If they have not arrived yet, the library simply opens.
          if (ET.onboarding) ET.onboarding.start(el, done);
          else done();
        });
      });
    });
    var q = ET.$('#et-welcome-q', el);
    if (q) q.addEventListener('input', function () {
      var v = q.value.trim().toLowerCase();
      ET.$$('[data-find]', el).forEach(function (b) {
        b.hidden = !!v && b.getAttribute('data-find').indexOf(v) < 0;
      });
    });
    // In-page links scroll the welcome screen itself, not the page behind it.
    ET.$$('a[href^="#et-"]', el).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var to = ET.$(a.getAttribute('href'), el);
        if (!to) return;
        e.preventDefault();
        var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        to.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
      });
    });
    // Focus the likeliest language for keyboard and screen-reader users, but
    // leave the hero in view.
    var first = ET.$('.welcome-lang', el);
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }

  ET.i18n = { t: t, h: h, say: say, welcome: welcome, suggested: suggested, tOr: tOr, tOrHTML: tOrHTML, set: set, extend: extend, apply: apply, onChange: onChange, picker: picker,
              chosen: chosen, langs: LANGS, meta: meta, current: function () { return current || 'en'; } };
  return ET.i18n;
});
