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
    pcm: {
 "title": "Cookies and your privacy",
 "body": "If you allow am, we go use browser storage to count visits, di things wey people use, how dem share am and visits wey come from shared links. Di report fit include country, region, device and browser. We no collect di files wey you send, di words wey you search, or di people wey you share with. You fit change your choice anytime.",
 "accept": "Allow am",
 "reject": "No, thank you",
 "settings": "Cookie settings",
 "details": "About activity reports",
 "enabled": "Activity reports dey on.",
 "disabled": "Activity reports no dey on.",
 "signal": "Your browser privacy setting dey block activity reports."
},
    yo: {
 "title": "Àwọn kúkì àti àṣírí rẹ",
 "body": "Pẹ̀lú ìyọ̀nda rẹ, a ń lo ibi ìpamọ́ ẹ̀rọ aṣàwákiri láti ka ìbẹ̀wò, ohun tí a lò, ọ̀nà tí a gbà pín àti ìbẹ̀wò tó wá láti ìjápọ̀ tí a pín. Ìròyìn lè ní orílẹ̀-èdè rẹ àti ojúlé tí o ti wá. A ń pa dátà náà mọ́ fún ọjọ́ 90. A kò lè rí àwọn ẹni tí o ránṣẹ́ sí, ìfiránṣẹ́ àṣírí rẹ tàbí ibi tí o fi ìjápọ̀ tí o da kọ sí.",
 "accept": "Gba ìṣirò láàyè",
 "reject": "Má gba ìṣirò láàyè",
 "settings": "Ètò àwọn kúkì",
 "details": "Ka àlàyé àṣírí",
 "enabled": "Ìṣirò ti wà ní ṣíṣí.",
 "disabled": "Ìṣirò ti wà ní pípa.",
 "signal": "Ẹ̀rọ aṣàwákiri rẹ ti fi àṣàyàn àṣírí ránṣẹ́. Ìṣirò yóò wà ní pípa."
},
    pt: {
  "title": "Cookies e privacidade",
  "body": "Com sua permissão, usamos o armazenamento do navegador para contar visitas, recursos utilizados, formas de compartilhar e visitas que vêm de links compartilhados. Os relatórios podem incluir seu país e o site de origem. Guardamos os dados por 90 dias. Não temos acesso aos destinatários, às mensagens privadas nem ao local onde você colou um link copiado.",
  "accept": "Permitir estatísticas",
  "reject": "Recusar estatísticas",
  "settings": "Configurações de cookies",
  "details": "Ler o aviso de privacidade",
  "enabled": "As estatísticas estão ativadas.",
  "disabled": "As estatísticas estão desativadas.",
  "signal": "Seu navegador enviou uma preferência de privacidade. As estatísticas continuarão desativadas."
},
    am: {
  "title": "ኩኪዎችና የግል መረጃዎ",
  "body": "በእርስዎ ፈቃድ ጉብኝቶችን፣ የተጠቀሙባቸውን ይዘቶች፣ የማጋራት ዘዴዎችንና ከተጋሩ አገናኞች የመጡ ጉብኝቶችን ለመቁጠር የአሳሹን ማከማቻ እንጠቀማለን። ሪፖርቶች አገርዎንና የመጡበትን ድረ ገጽ ሊያካትቱ ይችላሉ። መረጃውን ለ90 ቀናት እናቆያለን። ተቀባዮችን፣ የግል መልዕክቶችን ወይም የተቀዱ አገናኞች የት እንደተለጠፉ ማየት አንችልም።",
  "accept": "ስታቲስቲክስ ይፍቀዱ",
  "reject": "ስታቲስቲክስ አልፈልግም",
  "settings": "የኩኪ ቅንብሮች",
  "details": "የግል መረጃ ማስታወቂያውን ያንብቡ",
  "enabled": "ስታቲስቲክስ በአሁኑ ጊዜ በሥራ ላይ ነው።",
  "disabled": "ስታቲስቲክስ በአሁኑ ጊዜ ጠፍቷል።",
  "signal": "አሳሽዎ የግል መረጃ ጥበቃ ምርጫ ልኳል። ስታቲስቲክስ እንደጠፋ ይቆያል።"
},
    fr: {
      title: 'Cookies et confidentialité',
      body: 'Avec votre accord, nous utilisons le stockage du navigateur pour mesurer les visites, les ressources consultées, les moyens de partage et les visites provenant de liens partagés. Les rapports peuvent inclure votre pays et le site depuis lequel vous êtes arrivé. Nous conservons ces données pendant 90 jours. Nous ne pouvons pas voir les destinataires, les messages privés ni les endroits où les liens copiés sont collés.',
      accept: 'Accepter les statistiques', reject: 'Refuser les statistiques', settings: 'Paramètres des cookies',
      details: 'Lire la notice de confidentialité', enabled: 'Les statistiques sont actuellement activées.',
      disabled: 'Les statistiques sont actuellement désactivées.',
      signal: 'Votre navigateur demande de protéger votre vie privée. Les statistiques resteront désactivées.'
    },
    en: {
      title: 'Cookies & your privacy',
      body: 'With your permission, we use browser storage to measure visits, resources used, sharing methods and visits from shared links. Reports may include your country and referring website. We keep activity for 90 days. We cannot see recipients, private messages or where copied links are pasted.',
      accept: 'Accept analytics', reject: 'Reject analytics', settings: 'Cookie settings',
      details: 'Read the privacy notice', enabled: 'Analytics is currently on.',
      disabled: 'Analytics is currently off.',
      signal: 'Your browser sends a privacy preference. Analytics will stay off.'
    },
    ur: {
      title: 'کوکیز اور آپ کی رازداری',
      body: 'آپ کی اجازت سے ہم براؤزر میں محفوظ معلومات کے ذریعے دوروں، استعمال ہونے والے مواد، شیئر کرنے کے طریقوں اور شیئر کردہ لنکس سے آنے والے دوروں کی پیمائش کرتے ہیں۔ رپورٹس میں آپ کا ملک اور وہ ویب سائٹ شامل ہو سکتی ہے جہاں سے آپ آئے۔ سرگرمی 90 دن رکھی جاتی ہے۔ ہمیں وصول کنندگان، نجی پیغامات یا کاپی کردہ لنک کہاں بھیجا گیا، نظر نہیں آتا۔',
      accept: 'تجزیات قبول کریں', reject: 'تجزیات مسترد کریں', settings: 'کوکیز کی ترتیبات',
      details: 'رازداری کا نوٹس پڑھیں', enabled: 'تجزیات اس وقت فعال ہیں۔',
      disabled: 'تجزیات اس وقت بند ہیں۔', signal: 'آپ کا براؤزر رازداری کی ترجیح بھیج رہا ہے۔ تجزیات بند رہیں گے۔'
    },
    snd: {
      title: 'ڪوڪيز ۽ توهان جي رازداري',
      body: 'توهان جي اجازت سان، اسان برائوزر ۾ محفوظ معلومات ذريعي دورن، استعمال ٿيل مواد، شيئر ڪرڻ جي طريقن ۽ شيئر ڪيل لنڪن مان ايندڙ دورن جي ماپ ڪريون ٿا. رپورٽن ۾ توهان جو ملڪ ۽ اها ويب سائيٽ شامل ٿي سگهي ٿي جتان توهان آيا آهيو. سرگرمي 90 ڏينهن رکون ٿا. اسان وصول ڪندڙ، نجي پيغام يا ڪاپي ٿيل لنڪ ڪٿي موڪليو ويو، نٿا ڏسي سگهون.',
      accept: 'تجزيا قبول ڪريو', reject: 'تجزيا رد ڪريو', settings: 'ڪوڪيز جون سيٽنگون',
      details: 'رازداري جو نوٽيس پڙهو', enabled: 'تجزيا هن وقت چالو آهن.',
      disabled: 'تجزيا هن وقت بند آهن.', signal: 'توهان جو برائوزر رازداري جي ترجيح موڪلي ٿو. تجزيا بند رهندا.'
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
    panel.lang = c.lang; panel.dir = c.lang === 'ur' || c.lang === 'snd' ? 'rtl' : 'ltr';
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
