/* First-party, opt-in activity analytics. Classic script for the offline card.
   No requests, visitor IDs, queues or attribution storage before consent.
   A file:// copy never collects or transmits analytics. */
(function (ET) {
  'use strict';
  var VERSION = 1, CONSENT_AGE = 180 * 86400000, VISITOR_AGE = 90 * 86400000;
  var SESSION_AGE = 30 * 60000, QUEUE_AGE = 10 * 60000;
  var web = /^https?:$/.test(location.protocol);
  var queue = [], timer = null, sending = false, controller = null, generation = 0;
  var visitor = '', session = null, mounted = false, pageTracked = false;
  var TYPES = ['page_view', 'session_start', 'share_intent', 'share_complete', 'share_cancel',
    'shared_visit', 'resource_open', 'play', 'pause', 'play_complete', 'download_start',
    'download_complete', 'download_cancel', 'download_error', 'transfer_start',
    'transfer_complete', 'transfer_error', 'language_change', 'install', 'external_open'];
  var CHANNELS = ['email', 'copy_link', 'native_share', 'nearby', 'bluetooth', 'wifi',
    'sd_card', 'usb', 'whatsapp', 'telegram', 'facebook', 'sms', 'unknown'];
  var COPY = {
    en: {
      title: "Cookies & your privacy",
      body: "With your permission, we use browser storage to measure visits, resources used, sharing methods and visits from shared links. Reports may include your country and referring website. We keep activity for 90 days. We cannot see recipients, private messages or where copied links are pasted.",
      accept: "Accept analytics",
      reject: "Reject analytics",
      settings: "Cookie settings",
      details: "Read the privacy notice",
      enabled: "Analytics is currently on.",
      disabled: "Analytics is currently off.",
      signal: "Your browser sends a privacy preference. Analytics will stay off."
    },
    ln: {
      title: "Ba cookies mpe makambo na yo ya sekele",
      body: "Soki opesi biso nzela, tokosalela esika ya kobomba makambo na navigateur mpo na kotánga ba visites, biloko oyo basaleli, ndenge bato bakabolaka yango, mpe ba visites oyo eutaka na ba liens oyo bakaboli. Ba rapports ekoki kolakisa mboka na yo mpe site internet oyo otindaki yo awa. Tobombaka makambo oyo osali mikolo 90. Tokoki komona te bato oyo bazwi yango, ba messages ya sekele, to esika oyo bato batye ba liens oyo ba copier.",
      accept: "Ndima ba statistiques",
      reject: "Boya ba statistiques",
      settings: "Ba réglages ya ba cookies",
      details: "Tánga ndenge tobatelaka makambo na yo",
      enabled: "Ba statistiques ezali kosala sikoyo.",
      disabled: "Ba statistiques ezali kosala te sikoyo.",
      signal: "Navigateur na yo etindi mposa ya kobatela makambo na yo ya sekele. Ba statistiques ekotikala ekangami."
    },
    pcm: {
      title: "Cookies and your privacy",
      body: "If you gree, we go use your browser storage take count visits, di things wey people use, di way dem take share, and visits wey come from links wey people share. Di report fit show your country and di website wey send you come here. We dey keep di activity record for 90 days. We no fit see di people wey receive am, private messages, or where people paste link wey dem copy.",
      accept: "Allow analytics",
      reject: "No allow analytics",
      settings: "Cookie settings",
      details: "Read di privacy notice",
      enabled: "Analytics dey on now.",
      disabled: "Analytics dey off now.",
      signal: "Your browser dey send privacy request. Analytics go stay off."
    },
    yo: {
      title: "Àwọn kúkì àti àṣírí rẹ",
      body: "Pẹ̀lú àṣẹ rẹ, a ń lo ibi ìpamọ́ ẹ̀rọ aṣàwákiri láti ka ìbẹ̀wò, àwọn ohun èlò tí a lò, ọ̀nà tí a gbà pín nǹkan, àti ìbẹ̀wò tó wá láti inú ìjápọ̀ tí a pín. Ìròyìn lè ní orílẹ̀-èdè rẹ àti ojú òpó wẹ́ẹ̀bù tí ó darí rẹ wá síbí. A ń tọ́jú àkọsílẹ̀ ìṣe fún ọjọ́ 90. A kò lè rí àwọn tí ó gba nǹkan náà, àwọn ìfiránṣẹ́ àdáni, tàbí ibi tí wọ́n lẹ ìjápọ̀ tí wọ́n dà kọ sí.",
      accept: "Gba ìṣirò láàyè",
      reject: "Kọ ìṣirò",
      settings: "Ètò àwọn kúkì",
      details: "Ka ìkéde àṣírí",
      enabled: "Ìṣirò ń ṣiṣẹ́ báyìí.",
      disabled: "Ìṣirò kò ṣiṣẹ́ báyìí.",
      signal: "Ẹ̀rọ aṣàwákiri rẹ fi àṣàyàn àṣírí ránṣẹ́. Ìṣirò yóò wà ní pípa."
    },
    pt: {
      title: "Cookies e sua privacidade",
      body: "Com sua permissão, usamos o armazenamento do navegador para medir visitas, recursos usados, formas de compartilhamento e visitas que chegam por links compartilhados. Os relatórios podem incluir seu país e o site de onde você veio. Guardamos a atividade por 90 dias. Não conseguimos ver os destinatários, as mensagens privadas nem onde os links copiados são colados.",
      accept: "Aceitar estatísticas",
      reject: "Recusar estatísticas",
      settings: "Configurações de cookies",
      details: "Ler o aviso de privacidade",
      enabled: "As estatísticas estão ativadas no momento.",
      disabled: "As estatísticas estão desativadas no momento.",
      signal: "Seu navegador envia uma preferência de privacidade. As estatísticas continuarão desativadas."
    },
    am: {
      title: "ኩኪዎችና የእርስዎ ግላዊነት",
      body: "በእርስዎ ፈቃድ ጉብኝቶችን፣ ጥቅም ላይ የዋሉ ይዘቶችን፣ የማጋሪያ መንገዶችንና ከተጋሩ አገናኞች የመጡ ጉብኝቶችን ለመለካት የአሳሹን ማከማቻ እንጠቀማለን። ሪፖርቶች አገርዎንና ወደዚህ የመሩዎትን ድረ ገጽ ሊያካትቱ ይችላሉ። የእንቅስቃሴ መረጃን ለ90 ቀናት እናቆያለን። ተቀባዮችን፣ የግል መልዕክቶችን ወይም የተቀዱ አገናኞች የት እንደተለጠፉ ማየት አንችልም።",
      accept: "ስታቲስቲክስ ፍቀድ",
      reject: "ስታቲስቲክስ አትፍቀድ",
      settings: "የኩኪ ቅንብሮች",
      details: "የግላዊነት ማስታወቂያውን ያንብቡ",
      enabled: "ስታቲስቲክስ አሁን በርቷል።",
      disabled: "ስታቲስቲክስ አሁን ጠፍቷል።",
      signal: "አሳሽዎ የግላዊነት ምርጫ ይልካል። ስታቲስቲክስ እንደጠፋ ይቆያል።"
    },
    fr: {
      title: "Cookies et confidentialité",
      body: "Avec votre accord, nous utilisons le stockage du navigateur pour mesurer les visites, les ressources utilisées, les moyens de partage et les visites provenant de liens partagés. Les rapports peuvent indiquer votre pays et le site qui vous a amené ici. Nous conservons l’activité pendant 90 jours. Nous ne pouvons pas voir les destinataires, les messages privés ni l’endroit où les liens copiés sont collés.",
      accept: "Accepter les statistiques",
      reject: "Refuser les statistiques",
      settings: "Paramètres des cookies",
      details: "Lire la politique de confidentialité",
      enabled: "Les statistiques sont actuellement activées.",
      disabled: "Les statistiques sont actuellement désactivées.",
      signal: "Votre navigateur envoie une préférence de confidentialité. Les statistiques resteront désactivées."
    },
    ur: {
      title: "کوکیز اور آپ کی رازداری",
      body: "آپ کی اجازت سے ہم براؤزر اسٹوریج کے ذریعے وزٹس، استعمال ہونے والے مواد، شیئر کرنے کے طریقوں اور شیئر کیے گئے لنکس سے آنے والے وزٹس کی پیمائش کرتے ہیں۔ رپورٹس میں آپ کا ملک اور وہ ویب سائٹ شامل ہو سکتی ہے جہاں سے آپ یہاں آئے۔ ہم سرگرمی کا ریکارڈ 90 دن تک رکھتے ہیں۔ ہم وصول کنندگان، نجی پیغامات یا یہ نہیں دیکھ سکتے کہ کاپی کیے گئے لنکس کہاں پیسٹ کیے گئے۔",
      accept: "تجزیات قبول کریں",
      reject: "تجزیات مسترد کریں",
      settings: "کوکیز کی ترتیبات",
      details: "رازداری کا نوٹس پڑھیں",
      enabled: "تجزیات اس وقت آن ہیں۔",
      disabled: "تجزیات اس وقت بند ہیں۔",
      signal: "آپ کا براؤزر رازداری کی ترجیح بھیجتا ہے۔ تجزیات بند رہیں گے۔"
    },
    snd: {
      title: "ڪوڪيز ۽ توهان جي رازداري",
      body: "توهان جي اجازت سان، اسان برائوزر اسٽوريج ذريعي دورن، استعمال ٿيل مواد، شيئر ڪرڻ جي طريقن ۽ شيئر ڪيل لنڪن مان ايندڙ دورن جي ماپ ڪريون ٿا. رپورٽن ۾ توهان جو ملڪ ۽ اها ويب سائيٽ شامل ٿي سگهي ٿي جتان توهان هتي آيا آهيو. اسان سرگرمي جو رڪارڊ 90 ڏينهن تائين رکون ٿا. اسان وصول ڪندڙ، نجي پيغام، يا اهو نٿا ڏسي سگهون ته ڪاپي ڪيل لنڪ ڪٿي پيسٽ ڪيا ويا.",
      accept: "تجزيا قبول ڪريو",
      reject: "تجزيا رد ڪريو",
      settings: "ڪوڪيز جون سيٽنگون",
      details: "رازداري جو نوٽيس پڙهو",
      enabled: "تجزيا هن وقت چالو آهن.",
      disabled: "تجزيا هن وقت بند آهن.",
      signal: "توهان جو برائوزر رازداري جي ترجيح موڪلي ٿو. تجزيا بند رهندا."
    },
    cmn: {
      title: "Cookie 与您的隐私",
      body: "经您同意，我们会使用浏览器存储来统计访问量、所用资源、分享方式以及来自分享链接的访问。报告可能包含您所在的国家/地区和来源网站。我们会将活动记录保留 90 天。我们无法看到接收者和私信内容，也无法看到复制的链接被粘贴到了哪里。",
      accept: "接受统计分析",
      reject: "拒绝统计分析",
      settings: "Cookie 设置",
      details: "阅读隐私声明",
      enabled: "统计分析目前已开启。",
      disabled: "统计分析目前已关闭。",
      signal: "您的浏览器发送了隐私偏好设置，统计分析将保持关闭。"
    },
    yue: {
      title: "Cookie 同你嘅私隱",
      body: "得到你同意之後，我哋會用瀏覽器儲存空間嚟統計瀏覽次數、用咗邊啲資源、分享方式，同埋經分享連結而嚟嘅瀏覽。報告可能包括你所在嘅國家或地區同來源網站。我哋會將活動紀錄保留 90 日。我哋睇唔到收件人同私人訊息，亦睇唔到複製咗嘅連結貼咗去邊度。",
      accept: "接受數據分析",
      reject: "拒絕數據分析",
      settings: "Cookie 設定",
      details: "閱讀私隱聲明",
      enabled: "數據分析而家已開啟。",
      disabled: "數據分析而家已關閉。",
      signal: "你嘅瀏覽器傳送咗私隱偏好設定，數據分析會保持關閉。"
    },
    hi: {
      title: "कुकीज़ और आपकी निजता",
      body: "आपकी अनुमति से, हम विज़िट, इस्तेमाल किए गए संसाधनों, शेयर करने के तरीकों और शेयर किए गए लिंक से आने वाली विज़िट को मापने के लिए ब्राउज़र स्टोरेज का उपयोग करते हैं। रिपोर्ट में आपका देश और वह वेबसाइट शामिल हो सकती है जिससे आप यहाँ आए। हम गतिविधि का रिकॉर्ड 90 दिनों तक रखते हैं। हम प्राप्तकर्ताओं और निजी संदेशों को नहीं देख सकते, और न ही यह देख सकते हैं कि कॉपी किए गए लिंक कहाँ पेस्ट किए गए।",
      accept: "एनालिटिक्स स्वीकार करें",
      reject: "एनालिटिक्स अस्वीकार करें",
      settings: "कुकी सेटिंग्स",
      details: "निजता सूचना पढ़ें",
      enabled: "एनालिटिक्स अभी चालू है।",
      disabled: "एनालिटिक्स अभी बंद है।",
      signal: "आपका ब्राउज़र निजता से जुड़ी पसंद भेजता है। एनालिटिक्स बंद रहेगा।"
    },
    mr: {
      title: "कुकीज आणि तुमची गोपनीयता",
      body: "तुमच्या परवानगीने, आम्ही भेटी, वापरलेली संसाधने, शेअर करण्याच्या पद्धती आणि शेअर केलेल्या लिंकमधून आलेल्या भेटी मोजण्यासाठी ब्राउझर स्टोरेज वापरतो. अहवालांमध्ये तुमचा देश आणि तुम्ही ज्या वेबसाइटवरून इथे आलात ती वेबसाइट असू शकते. आम्ही ॲक्टिव्हिटीची नोंद 90 दिवस ठेवतो. आम्हाला प्राप्तकर्ते आणि खाजगी संदेश दिसत नाहीत, तसेच कॉपी केलेल्या लिंक कुठे पेस्ट केल्या हेही दिसत नाही.",
      accept: "विश्लेषण स्वीकारा",
      reject: "विश्लेषण नाकारा",
      settings: "कुकी सेटिंग्ज",
      details: "गोपनीयता सूचना वाचा",
      enabled: "विश्लेषण सध्या सुरू आहे.",
      disabled: "विश्लेषण सध्या बंद आहे.",
      signal: "तुमचा ब्राउझर गोपनीयतेची पसंती पाठवतो. विश्लेषण बंदच राहील."
    },
    ne: {
      title: "कुकीहरू र तपाईंको गोपनीयता",
      body: "तपाईंको अनुमतिमा, हामी भ्रमणहरू, प्रयोग गरिएका सामग्री, सेयर गर्ने तरिका र सेयर गरिएका लिङ्कबाट आएका भ्रमणहरू मापन गर्न ब्राउजर स्टोरेज प्रयोग गर्छौं। रिपोर्टमा तपाईंको देश र तपाईं यहाँ आउनुभएको वेबसाइट समावेश हुन सक्छ। हामी गतिविधिको विवरण 90 दिनसम्म राख्छौं। हामी प्राप्तकर्ता र निजी सन्देशहरू हेर्न सक्दैनौं, न त कपी गरिएका लिङ्कहरू कहाँ पेस्ट गरिए भनेर नै हेर्न सक्छौं।",
      accept: "एनालिटिक्स स्वीकार गर्नुहोस्",
      reject: "एनालिटिक्स अस्वीकार गर्नुहोस्",
      settings: "कुकी सेटिङहरू",
      details: "गोपनीयता सूचना पढ्नुहोस्",
      enabled: "एनालिटिक्स अहिले सक्रिय छ।",
      disabled: "एनालिटिक्स अहिले बन्द छ।",
      signal: "तपाईंको ब्राउजरले गोपनीयताको प्राथमिकता पठाउँछ। एनालिटिक्स बन्द नै रहनेछ।"
    },
    pa: {
      title: "ਕੁਕੀਜ਼ ਅਤੇ ਤੁਹਾਡੀ ਨਿੱਜਤਾ",
      body: "ਤੁਹਾਡੀ ਇਜਾਜ਼ਤ ਨਾਲ, ਅਸੀਂ ਵਿਜ਼ਿਟਾਂ, ਵਰਤੇ ਗਏ ਸਰੋਤਾਂ, ਸਾਂਝਾ ਕਰਨ ਦੇ ਤਰੀਕਿਆਂ ਅਤੇ ਸਾਂਝੇ ਕੀਤੇ ਲਿੰਕਾਂ ਤੋਂ ਆਈਆਂ ਵਿਜ਼ਿਟਾਂ ਨੂੰ ਮਾਪਣ ਲਈ ਬ੍ਰਾਊਜ਼ਰ ਸਟੋਰੇਜ ਵਰਤਦੇ ਹਾਂ। ਰਿਪੋਰਟਾਂ ਵਿੱਚ ਤੁਹਾਡਾ ਦੇਸ਼ ਅਤੇ ਉਹ ਵੈੱਬਸਾਈਟ ਸ਼ਾਮਲ ਹੋ ਸਕਦੀ ਹੈ ਜਿੱਥੋਂ ਤੁਸੀਂ ਇੱਥੇ ਆਏ। ਅਸੀਂ ਗਤੀਵਿਧੀ ਦਾ ਰਿਕਾਰਡ 90 ਦਿਨਾਂ ਤੱਕ ਰੱਖਦੇ ਹਾਂ। ਅਸੀਂ ਪ੍ਰਾਪਤਕਰਤਾਵਾਂ ਅਤੇ ਨਿੱਜੀ ਸੁਨੇਹਿਆਂ ਨੂੰ ਨਹੀਂ ਦੇਖ ਸਕਦੇ, ਅਤੇ ਨਾ ਹੀ ਇਹ ਕਿ ਕਾਪੀ ਕੀਤੇ ਲਿੰਕ ਕਿੱਥੇ ਪੇਸਟ ਕੀਤੇ ਗਏ।",
      accept: "ਵਿਸ਼ਲੇਸ਼ਣ ਸਵੀਕਾਰ ਕਰੋ",
      reject: "ਵਿਸ਼ਲੇਸ਼ਣ ਰੱਦ ਕਰੋ",
      settings: "ਕੁਕੀ ਸੈਟਿੰਗਾਂ",
      details: "ਨਿੱਜਤਾ ਸੂਚਨਾ ਪੜ੍ਹੋ",
      enabled: "ਵਿਸ਼ਲੇਸ਼ਣ ਇਸ ਵੇਲੇ ਚਾਲੂ ਹੈ।",
      disabled: "ਵਿਸ਼ਲੇਸ਼ਣ ਇਸ ਵੇਲੇ ਬੰਦ ਹੈ।",
      signal: "ਤੁਹਾਡਾ ਬ੍ਰਾਊਜ਼ਰ ਨਿੱਜਤਾ ਦੀ ਤਰਜੀਹ ਭੇਜਦਾ ਹੈ। ਵਿਸ਼ਲੇਸ਼ਣ ਬੰਦ ਰਹੇਗਾ।"
    },
    pnb: {
      title: "کوکیز تے تہاڈی پرائیویسی",
      body: "تہاڈی اجازت نال، اسیں وزٹاں، ورتے گئے وسیلیاں، شیئر کرن دے طریقیاں تے شیئر کیتے گئے لنکاں توں آئیاں وزٹاں نوں ماپن لئی براؤزر سٹوریج ورتدے آں۔ رپورٹاں وچ تہاڈا ملک تے اوہ ویب سائٹ شامل ہو سکدی اے جتھوں تسیں ایتھے آئے۔ اسیں سرگرمی دا ریکارڈ 90 دن تک رکھدے آں۔ اسیں وصول کرن والیاں تے نجی سنیہیاں نوں نئیں ویکھ سکدے، تے نہ ایہ کہ کاپی کیتے لنک کتھے پیسٹ کیتے گئے۔",
      accept: "تجزیہ منظور کرو",
      reject: "تجزیہ رد کرو",
      settings: "کوکی سیٹنگاں",
      details: "پرائیویسی نوٹس پڑھو",
      enabled: "تجزیہ ایس ویلے چالو اے۔",
      disabled: "تجزیہ ایس ویلے بند اے۔",
      signal: "تہاڈا براؤزر پرائیویسی دی ترجیح بھیجدا اے۔ تجزیہ بند رہوے گا۔"
    },
    ps: {
      title: "کوکيز او ستاسو محرمیت",
      body: "ستاسو په اجازه، موږ د براوزر زېرمه کاروو څو لیدنې، کارول شوې سرچینې، د شریکولو لارې او له شریک شویو لینکونو څخه راغلې لیدنې اندازه کړو. راپورونه کېدای شي ستاسو هېواد او هغه وېب پاڼه ولري چې تاسو ترې دلته راغلي یاست. موږ د فعالیت ریکارډ تر 90 ورځو ساتو. موږ ترلاسه کوونکي او شخصي پیغامونه نه شو لیدلای، او نه دا چې کاپي شوي لینکونه چېرته پېسټ شوي.",
      accept: "تحلیل ومنئ",
      reject: "تحلیل رد کړئ",
      settings: "د کوکيز ترتیبات",
      details: "د محرمیت خبرتیا ولولئ",
      enabled: "تحلیل اوس فعال دی.",
      disabled: "تحلیل اوس بند دی.",
      signal: "ستاسو براوزر د محرمیت غوره توب لېږي. تحلیل به بند پاتې شي."
    },
    swh: {
      title: "Vidakuzi na faragha yako",
      body: "Kwa ruhusa yako, tunatumia hifadhi ya kivinjari kupima matembeleo, rasilimali zilizotumika, njia za kushiriki na matembeleo yanayotoka kwenye viungo vilivyoshirikiwa. Ripoti zinaweza kujumuisha nchi yako na tovuti iliyokuleta hapa. Tunahifadhi kumbukumbu za shughuli kwa siku 90. Hatuwezi kuona wapokeaji, jumbe za faragha wala mahali viungo vilivyonakiliwa vinapobandikwa.",
      accept: "Kubali takwimu",
      reject: "Kataa takwimu",
      settings: "Mipangilio ya vidakuzi",
      details: "Soma ilani ya faragha",
      enabled: "Takwimu zimewashwa kwa sasa.",
      disabled: "Takwimu zimezimwa kwa sasa.",
      signal: "Kivinjari chako kinatuma chaguo la faragha. Takwimu zitaendelea kuzimwa."
    },
    zul: {
      title: "Amakhukhi nobumfihlo bakho",
      body: "Ngemvume yakho, sisebenzisa isitoreji sesiphequluli ukukala ukuvakasha, izinsiza ezisetshenzisiwe, izindlela zokwabelana kanye nokuvakasha okuvela kumalinki okwabelwane ngawo. Imibiko ingabonisa izwe lakho newebhusayithi ekulethe lapha. Sigcina umlando womsebenzi izinsuku ezingama-90. Asikwazi ukubona abamukeli, imilayezo eyimfihlo noma lapho amalinki akopishiwe anamathiselwe khona.",
      accept: "Vuma izibalo",
      reject: "Yenqaba izibalo",
      settings: "Izilungiselelo zamakhukhi",
      details: "Funda isaziso sobumfihlo",
      enabled: "Izibalo zivuliwe njengamanje.",
      disabled: "Izibalo zivaliwe njengamanje.",
      signal: "Isiphequluli sakho sithumela okuthandayo mayelana nobumfihlo. Izibalo zizohlala zivaliwe."
    },
    mg: {
      title: "Cookies sy ny tsiambaratelonao",
      body: "Raha manome alalana ianao, dia mampiasa ny fitehirizana ao amin'ny navigateur izahay mba handrefesana ny fitsidihana, ny loharano ampiasaina, ny fomba fizarana ary ny fitsidihana avy amin'ny rohy nozaraina. Mety hiseho ao amin'ny tatitra ny firenenao sy ny tranonkala nitondra anao teto. Tehirizinay mandritra ny 90 andro ny firaketana ny hetsika. Tsy hitanay ny mpandray, ny hafatra manokana, na ny toerana nametahana ny rohy nadika.",
      accept: "Ekeo ny antontan'isa",
      reject: "Lavio ny antontan'isa",
      settings: "Fandrindrana ny cookies",
      details: "Vakio ny fampahafantarana momba ny tsiambaratelo",
      enabled: "Mandeha ny antontan'isa amin'izao fotoana izao.",
      disabled: "Tsy mandeha ny antontan'isa amin'izao fotoana izao.",
      signal: "Mandefa safidy momba ny tsiambaratelo ny navigateur-nao. Hijanona tsy mandeha ny antontan'isa."
    },
    ny: {
      title: "Ma cookie ndi zinsinsi zanu",
      body: "Mukatilola, timagwiritsa ntchito malo osungira a msakatuli kuti tiwerenge maulendo obwera pa tsambali, zinthu zogwiritsidwa ntchito, njira zogawirana, ndi maulendo ochokera ku maulalo ogawidwa. Malipoti angasonyeze dziko lanu ndi webusaiti imene yakutumizani kuno. Timasunga mbiri ya zochitika kwa masiku 90. Sitingathe kuona olandira, mauthenga achinsinsi, kapena kumene maulalo okopedwa aikidwa.",
      accept: "Lolani ziwerengero",
      reject: "Kanani ziwerengero",
      settings: "Makonzedwe a ma cookie",
      details: "Werengani chidziwitso cha zinsinsi",
      enabled: "Ziwerengero zayatsidwa tsopano.",
      disabled: "Ziwerengero zazimitsidwa tsopano.",
      signal: "Msakatuli wanu ukutumiza pempho lotetezera zinsinsi. Ziwerengero zizikhalabe zozimitsidwa."
    },
    rw: {
      title: "Kuki (cookies) n’ibanga ryawe",
      body: "Ubyemeye, dukoresha ububiko bwa mushakisha kugira ngo tubare abasura, ibyakoreshejwe, uburyo bwo gusangiza n’abasura baturutse kuri link zasangijwe. Raporo zishobora kugaragaza igihugu urimo n’urubuga waturutseho. Ibikorwa tubibika iminsi 90. Ntidushobora kubona abo woherereje, ubutumwa bwihariye cyangwa aho link wakoporoye zishyirwa.",
      accept: "Emera isesengura",
      reject: "Hakana isesengura",
      settings: "Igenamiterere rya kuki",
      details: "Soma itangazo ryerekeye ibanga",
      enabled: "Isesengura rirakora ubu.",
      disabled: "Isesengura ntirikora ubu.",
      signal: "Mushakisha yawe yohereza icyifuzo cyo kurinda ibanga. Isesengura ntirizakora."
    },
    xh: {
      title: "Iikhukhi nemfihlo yakho",
      body: "Ngemvume yakho, sisebenzisa indawo yokugcina kwibhrawuza ukubala ukutyelela, izinto ezisetyenzisiweyo, iindlela zokwabelana kunye nokutyelela okuvela kumalinki ekwabelwane ngawo. Iingxelo zisenokubonisa ilizwe lakho kunye newebhusayithi ekuthumele apha. Sigcina irekhodi yezinto ezenziweyo iintsuku ezingama-90. Asinakubona abo bafumanayo, imiyalezo yabucala, okanye apho iilinki ezikopiweyo zincanyathiselwe khona.",
      accept: "Vumela izibalo",
      reject: "Yala izibalo",
      settings: "Iisetingi zeekhukhi",
      details: "Funda isaziso semfihlo",
      enabled: "Izibalo zivuliwe ngoku.",
      disabled: "Izibalo zivaliwe ngoku.",
      signal: "Ibhrawuza yakho ithumela isicelo semfihlo. Izibalo ziza kuhlala zivaliwe."
    },
    sn: {
      title: "Makuki nekuvanzika kwako",
      body: "Kana wabvuma, tinoshandisa nzvimbo yekuchengetera yebrowser kuverenga kushanyirwa, zvinhu zvashandiswa, nzira dzekugovera nekushanyirwa kunobva pamalink akagoverwa. Mishumo ingaratidza nyika yauri newebsite yakakuunza. Tinochengeta zviitiko kwemazuva 90. Hatigoni kuona vanogamuchira, mameseji akavanzika kana kuti malink akakopwa anoiswa kupi.",
      accept: "Bvuma ongororo",
      reject: "Ramba ongororo",
      settings: "Marongero emakuki",
      details: "Verenga chiziviso chekuvanzika",
      enabled: "Ongororo iri kushanda izvozvi.",
      disabled: "Ongororo yakadzimwa izvozvi.",
      signal: "Browser yako inotumira sarudzo yekuvanzika. Ongororo icharamba yakadzimwa."
    },
    ha: {
      title: "Kukis da sirrinka",
      body: "Da izininka, muna amfani da ma'ajiyar burauza don auna ziyarori, kayan da aka yi amfani da su, hanyoyin rabawa da ziyarorin da suka fito daga hanyoyin haɗin da aka raba. Rahotanni na iya nuna ƙasarka da gidan yanar gizon da ya kawo ka nan. Muna adana bayanan ayyuka na tsawon kwanaki 90. Ba za mu iya ganin waɗanda suka karɓa ba, ko saƙonni na sirri, ko inda aka liƙa hanyoyin haɗin da aka kwafa.",
      accept: "Amince da ƙididdiga",
      reject: "Ƙi ƙididdiga",
      settings: "Saitunan kukis",
      details: "Karanta sanarwar sirri",
      enabled: "Ƙididdiga a kunne take yanzu.",
      disabled: "Ƙididdiga a kashe take yanzu.",
      signal: "Burauzarka na aika zaɓin sirri. Ƙididdiga za ta ci gaba da kasancewa a kashe."
    },
    ig: {
      title: "Kuki na nzuzo gị",
      body: "Site n'ikike gị, anyị na-eji ebe nchekwa ihe nchọgharị atụ nleta, akụrụngwa e jiri, ụzọ e si kesaa, na nleta si na njikọ e kesara. Akụkọ nwere ike igosi mba gị na weebụsaịtị duru gị bịa ebe a. Anyị na-edebe ndekọ ihe omume ruo ụbọchị 90. Anyị enweghị ike ịhụ ndị nnata, ozi nzuzo, ma ọ bụ ebe a mapara njikọ e depụtagharịrị.",
      accept: "Nabata nyocha",
      reject: "Jụ nyocha",
      settings: "Ntọala kuki",
      details: "Gụọ ọkwa nzuzo",
      enabled: "Nyocha na-arụ ọrụ ugbu a.",
      disabled: "Nyocha anaghị arụ ọrụ ugbu a.",
      signal: "Ihe nchọgharị gị na-ezipụ mmasị gbasara nzuzo. Nyocha agaghị arụ ọrụ."
    },
    om: {
      title: "Kuukiiwwanii fi iccitii keessan",
      body: "Hayyama keessaniin, daawwannaa, qabeenya itti fayyadamame, mala qooddannaa fi daawwannaa liinkii qoodame irraa dhufe safaruuf kuusaa birowuzarii fayyadamna. Gabaasni biyya keessanii fi marsariitii isin as fide of keessaa qabaachuu danda'a. Galmee sochii guyyoota 90f kuusna. Namoota ergaa fudhatan, ergaa dhuunfaa, ykn bakka liinkiin garagalfame itti maxxanfame arguu hin dandeenyu.",
      accept: "Xiinxala fudhadhaa",
      reject: "Xiinxala didaa",
      settings: "Qindaa'ina kuukii",
      details: "Beeksisa iccitii dubbisaa",
      enabled: "Xiinxalli amma hojii irra jira.",
      disabled: "Xiinxalli amma dhaabbateera.",
      signal: "Birowuzariin keessan filannoo iccitii erga. Xiinxalli akkuma dhaabbatetti tura."
    },
    luo: {
      title: "Cookies gi siri mari",
      body: "Ka iyie, wati gi kar keno mar browser mondo wapim limbe, gik ma otigo, yore mag pogo weche, kod limbe ma oa e links ma opogi. Ripode nyalo nyiso pinyu kod website ma okeli ka. Wakano weche mag tich kuom ndalo 90. Ok wanyal neno joma oyudo, mesej mag siri, kata kama oketie links mokopi.",
      accept: "Yie kwano",
      reject: "Kwer kwano",
      settings: "Chenro mag cookies",
      details: "Som lando mar siri",
      enabled: "Kwano tiyo sani.",
      disabled: "Kwano ok ti sani.",
      signal: "Browser mari oro dwaro mar siri. Kwano biro dong' kochungo."
    },
    lg: {
      title: "Cookies n'ebyama byo",
      body: "Bw'otukkiriza, tukozesa ekifo ekitereka ebintu mu browser okupima okukyala, ebikozesebwa, engeri y'okugabana, n'okukyala okuva ku links ezigabanyiziddwa. Lipooti ziyinza okulaga eggwanga lyo n'omukutu ogukuleese wano. Ebikwata ku by'okola tubitereka okumala ennaku 90. Tetusobola kulaba abafuna, obubaka obw'ekyama, oba gye bateeka links ezikoppeddwa.",
      accept: "Kkiriza okubala",
      reject: "Gaana okubala",
      settings: "Entegeka za cookies",
      details: "Soma ekiwandiiko ku byama",
      enabled: "Okubala kukola kati.",
      disabled: "Okubala kuggaddwa kati.",
      signal: "Browser yo eweereza by'oyagala ku byama. Okubala kujja kusigala nga kuggaddwa."
    },
    kik: {
      title: "Cookies na ũhitho waku",
      body: "Ũngĩtwĩtĩkĩria, nĩtũhũthagĩra kĩigĩro kĩa browser gũthima ũceereri, indo iria ihũthĩrĩtwo, njĩra cia kũgayana, na ũceereri ũrĩa ũumĩte links iria igayanĩtwo. Ripoti no cionanie bũrũri waku na website ĩrĩa ĩgũtwarĩte haha. Tũigaga rekondi ya ũrĩa gwĩkĩtwo mĩthenya 90. Tũtingĩhota kuona arĩa matũmĩirwo, ndũmĩrĩri cia hitho, kana harĩa links iria ikopĩtwo ciaigĩrĩrwo.",
      accept: "Ĩtĩkĩra ũtari",
      reject: "Rega ũtari",
      settings: "Mabangĩrĩro ma cookies",
      details: "Thoma ũhoro wa ũhitho",
      enabled: "Ũtari nĩ ũrarutaga wĩra rĩu.",
      disabled: "Ũtari nĩ mũhingĩre rĩu.",
      signal: "Browser yaku nĩ ĩratũma wendi waku wa ũhitho. Ũtari ũgũtũũra ũhingĩtwo."
    },
    guz: {
      title: "Cookies na ebisieri biao",
      body: "Ogotwoyia, nigo tokorera ase ogobeka ebinto ase browser gotara ogochia, ebinto bikorerwe, enchera ya kogabana, na ogochia okorwa ase links igabanetwe. Eripoti negotoboka korangeria ense yao na website ekoreteire ase. Nigo tobeka ebiagokorwa ase chinsiko 90. Tituntoboka koroka abwo banyorete, obobaka bw'ebisieri, gose ase links ikopetwe yaberwe.",
      accept: "Ikiria ogotara",
      reject: "Rema ogotara",
      settings: "Ebiagokwania bia cookies",
      details: "Soma eriogo ria ebisieri",
      enabled: "Ogotara nigo gokoragera bweka.",
      disabled: "Ogotara nigo kwagachwa bweka.",
      signal: "Browser yao negotoma ogokwenda kwao kw'ebisieri. Ogotara nigo bwensi bokogenderera kwagachwa."
    },
    mas: {
      title: "Cookies o ilomon le sirri lino",
      body: "Ore te nkirukoto ino, kiyieu enkiterekenoto e browser pee kiyaar inkisulakin, intokitin naaisisa, inkulupot e nkikilikuanare o inkisulakin naaing'uraa te ilinks naaitorrupiyie. Ileporto naa keidim aaitodolu enkop ino o website natiu iyie ene. Kiramat ilomon le nkitoria oolong' 90. Mikidim aadol ooyiere, ilomon le sirri, anaa ajo kaaji eitoki ilinks naaikopi.",
      accept: "Iyie aayaar",
      reject: "Ichoo aayaar",
      settings: "Inkitaasat e cookies",
      details: "Ening'o ilomon le sirri",
      enabled: "Eyaar etii taata.",
      disabled: "Eyaar mitii taata.",
      signal: "Eishoo browser ino enkiyieunoto e sirri. Eyaar keitoki mitii."
    }
  };

  // Storage may be unavailable on a shared phone. Consent then lasts only for
  // this page; no error can break a transfer or make declining stop working.
  var memoryConsent = null;
  function read(key, temporary) {
    try { return JSON.parse((temporary ? sessionStorage : localStorage).getItem(key) || 'null'); }
    catch (e) { return null; }
  }
  function write(key, value, temporary) {
    try { (temporary ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function remove(key, temporary) {
    try { (temporary ? sessionStorage : localStorage).removeItem(key); } catch (e) {}
  }
  function consent() {
    var c = memoryConsent || read('et.consent');
    return c && c.version === VERSION && typeof c.analytics === 'boolean' &&
      Number.isFinite(c.at) && Date.now() >= c.at && Date.now() - c.at < CONSENT_AGE ? c : null;
  }
  function allowed() {
    var c = consent();
    return web && navigator.globalPrivacyControl !== true && !!(c && c.analytics);
  }
  function uuid() {
    if (!window.crypto || !window.crypto.getRandomValues) return '';
    var b = new Uint8Array(16); window.crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function code(value) { return /^[a-z]{3}$/.test(value || '') ? value : ''; }
  function slug(value) { return /^[A-Za-z0-9_-]{1,100}$/.test(value || '') ? value : ''; }
  function id(value) { return /^[A-Za-z0-9_-]{8,80}$/.test(value || '') ? value : ''; }
  function language() {
    try { return code(ET.contentLang()); } catch (e) { return ''; }
  }
  function resource() {
    if (!/\/item\.html$/.test(location.pathname)) return '';
    try {
      var r = ET.byId(ET.qs('id')), scope = ET.libraryScope();
      return r && (!scope || r.lang === scope.lang) ? slug(r.id) : '';
    } catch (e) { return ''; }
  }
  function referrer() {
    try {
      var url = new URL(document.referrer);
      return /^https?:$/.test(url.protocol) && url.origin !== location.origin ? url.hostname : '';
    } catch (e) { return ''; }
  }
  function attribution() {
    try {
      var q = new URLSearchParams(location.search), share = id(q.get('et_share'));
      var channel = q.get('et_channel');
      return share ? { shareId: share, channel: CHANNELS.indexOf(channel) >= 0 ? channel : 'unknown' } : {};
    } catch (e) { return {}; }
  }
  function identity() {
    var now = Date.now(), v;
    if (!visitor) {
      v = read('et.analytics.visitor');
      visitor = v && id(v.id) && now >= v.at && now - v.at < VISITOR_AGE ? v.id : uuid();
      if (!visitor) return false;
      if (!v || v.id !== visitor) write('et.analytics.visitor', { id: visitor, at: now });
    }
    session = session || read('et.analytics.session', true);
    if (!session || !id(session.id) || now < session.at || now - session.at >= SESSION_AGE) {
      session = { id: uuid(), at: now, source: attribution() };
      if (!session.id) return false;
      enqueue('session_start', {});
    }
    var source = attribution();
    if (source.shareId) session.source = source;
    session.at = now;
    write('et.analytics.session', session, true);
    return true;
  }
  function enqueue(type, fields) {
    var eventId = uuid();
    if (!eventId) return;
    var e = { id: eventId, type: type, at: new Date().toISOString(),
      path: location.pathname.replace(/[^A-Za-z0-9_./-]/g, '').slice(0, 200) || '/',
      visitorId: visitor, sessionId: session.id, language: language() };
    var r = resource();
    if (r) e.resource = r;
    if (code(fields.language)) e.language = fields.language;
    if (slug(fields.resource)) e.resource = fields.resource;
    if (CHANNELS.indexOf(fields.channel) >= 0) e.channel = fields.channel;
    if (/^[a-z_]{1,32}$/.test(fields.status || '')) e.status = fields.status;
    if (id(fields.shareId)) e.shareId = fields.shareId;
    else if (session.source && id(session.source.shareId)) e.shareId = session.source.shareId;
    if (type === 'page_view' || type === 'shared_visit') { var ref = referrer(); if (ref) e.referrer = ref; }
    if (Number.isFinite(fields.bytes) && fields.bytes >= 0) e.bytes = Math.min(Math.floor(fields.bytes), 1099511627776);
    if (Number.isFinite(fields.duration) && fields.duration >= 0) e.duration = Math.min(Math.round(fields.duration), 86400);
    queue = queue.filter(function (pending) { return Date.now() - Date.parse(pending.at) < QUEUE_AGE; });
    queue.push(e);
    if (queue.length > 100) queue.shift();
    if (!timer) timer = setTimeout(flush, 1200);
  }
  function track(type, fields) {
    if (!allowed() || TYPES.indexOf(type) < 0 || !identity()) return;
    enqueue(type, fields || {});
  }
  function stop() {
    generation++; queue = []; visitor = ''; session = null; pageTracked = false;
    clearTimeout(timer); timer = null;
    if (controller) controller.abort();
    controller = null;
    remove('et.analytics.visitor'); remove('et.analytics.session', true);
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!allowed()) { stop(); return; }
    if (sending) return;
    var now = Date.now();
    queue = queue.filter(function (e) { return now - Date.parse(e.at) < QUEUE_AGE; });
    if (!queue.length) return;
    if (navigator.onLine === false) { timer = setTimeout(flush, 30000); return; }
    var batch = queue.splice(0, 20), currentGeneration = generation;
    sending = true;
    controller = window.AbortController ? new AbortController() : null;
    var timeout = setTimeout(function () { if (controller) controller.abort(); }, 8000);
    fetch('/api/analytics', { method: 'POST', credentials: 'omit', cache: 'no-store', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: { version: VERSION, analytics: true }, events: batch }),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error('analytics unavailable');
    }).catch(function () {
      if (allowed() && currentGeneration === generation) queue = batch.concat(queue).slice(-100);
    }).then(function () {
      clearTimeout(timeout); sending = false; controller = null;
      if (allowed() && queue.length && !timer) timer = setTimeout(flush, 30000);
    });
  }
  function shareUrl(url, channel, fields) {
    if (!allowed()) return url;
    try {
      var u = new URL(url, location.href);
      if (!/^https?:$/.test(u.protocol) || u.origin !== location.origin) return url;
      var share = id(fields && fields.shareId) || uuid();
      if (!share) return url;
      u.searchParams.set('et_share', share);
      u.searchParams.set('et_channel', CHANNELS.indexOf(channel) >= 0 ? channel : 'unknown');
      return u.href;
    } catch (e) { return url; }
  }
  function shareIntent(url, channel, fields) {
    var data = Object.assign({}, fields || {}), share = allowed() ? uuid() : '';
    data.channel = channel; data.shareId = share;
    track('share_intent', data);
    return { url: shareUrl(url, channel, data), shareId: share };
  }
  function page() {
    if (!allowed() || pageTracked) return;
    pageTracked = true;
    track('page_view');
    var source = attribution();
    if (source.shareId) track('shared_visit', source);
    var r = resource();
    if (r) track('resource_open', { resource: r });
  }
  function copy() {
    var ui = ET.i18n ? ET.i18n.current() : 'en';
    return { text: COPY[ui] || COPY.en, lang: COPY[ui] ? ui : 'en' };
  }
  function render() {
    var c = copy(), panel = document.getElementById('et-consent'), button = document.getElementById('et-cookie-settings');
    if (button) { button.textContent = c.text.settings; button.lang = c.lang; }
    if (!panel) return;
    panel.lang = c.lang; panel.dir = ['ur', 'snd', 'pnb', 'ps'].indexOf(c.lang) >= 0 ? 'rtl' : 'ltr';
    panel.querySelector('h2').textContent = c.text.title;
    panel.querySelector('.consent-copy').textContent = c.text.body;
    panel.querySelector('.consent-state').textContent = navigator.globalPrivacyControl === true
      ? c.text.signal : consent() ? (allowed() ? c.text.enabled : c.text.disabled) : '';
    panel.querySelector('[data-consent="accept"]').textContent = c.text.accept;
    panel.querySelector('[data-consent="accept"]').disabled = navigator.globalPrivacyControl === true;
    panel.querySelector('[data-consent="reject"]').textContent = c.text.reject;
    panel.querySelector('a').textContent = c.text.details;
  }
  function show() {
    var panel = document.getElementById('et-consent');
    if (!panel) return;
    render(); panel.hidden = false;
    document.getElementById('et-cookie-settings').hidden = true;
    panel.querySelector('button').focus({ preventScroll: true });
  }
  function choose(value) {
    memoryConsent = { version: VERSION, analytics: value && navigator.globalPrivacyControl !== true, at: Date.now() };
    write('et.consent', memoryConsent);
    if (!allowed()) stop();
    document.getElementById('et-consent').hidden = true;
    document.getElementById('et-cookie-settings').hidden = false;
    if (allowed()) page();
    document.getElementById('et-cookie-settings').focus({ preventScroll: true });
  }
  function mount() {
    if (mounted || !web) return;
    mounted = true;
    var panel = document.createElement('section'); panel.id = 'et-consent'; panel.className = 'consent-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'et-consent-title');
    panel.setAttribute('aria-describedby', 'et-consent-copy'); panel.hidden = true;
    panel.innerHTML = '<h2 id="et-consent-title"></h2><p class="consent-copy" id="et-consent-copy"></p>' +
      '<p class="consent-state" aria-live="polite"></p><div class="consent-actions">' +
      '<button class="btn ghost" type="button" data-consent="reject"></button>' +
      '<button class="btn ghost" type="button" data-consent="accept"></button></div>' +
      '<a href="privacy.html"></a>';
    var button = document.createElement('button'); button.type = 'button'; button.id = 'et-cookie-settings';
    button.className = 'cookie-settings'; button.addEventListener('click', show);
    document.body.appendChild(panel); document.body.appendChild(button);
    panel.querySelector('[data-consent="accept"]').addEventListener('click', function () { choose(true); });
    panel.querySelector('[data-consent="reject"]').addEventListener('click', function () { choose(false); });
    render();
    // The first-run language chooser must finish before a consent notice can
    // be understood. Language choice itself is an essential local preference.
    function ready() {
      if (document.getElementById('et-welcome')) return false;
      if (!consent()) show(); else page();
      return true;
    }
    if (!ready() && window.MutationObserver) {
      var observer = new MutationObserver(function () { if (ready()) observer.disconnect(); });
      observer.observe(document.body, { childList: true });
    }
    if (!allowed()) stop();
    if (ET.i18n) ET.i18n.onChange(function () {
      render(); track('language_change', { language: language() });
    });
    ['play', 'pause', 'ended'].forEach(function (name) {
      document.addEventListener(name, function (e) {
        if (!/^(VIDEO|AUDIO)$/.test(e.target.tagName) || !resource()) return;
        track(name === 'ended' ? 'play_complete' : name, { duration: e.target.currentTime });
      }, true);
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      try {
        var u = new URL(a.href);
        if (/^https?:$/.test(u.protocol) && u.origin !== location.origin) {
          track('external_open', { status: 'opened' });
        }
      } catch (err) {}
    });
  }
  ET.analytics = { track: track, shareUrl: shareUrl, shareIntent: shareIntent, allowed: allowed,
    showConsent: show, flush: flush };
  window.addEventListener('storage', function (e) {
    if (e.key !== 'et.consent') return;
    memoryConsent = null;
    if (!allowed()) stop(); else page();
    render();
    if (!consent() && !document.getElementById('et-welcome')) show();
  });
  window.addEventListener('online', flush);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('appinstalled', function () { track('install'); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window.ET);
