/* The small sharing panel at the top of every one-language library. The URL is
   built from the origin that served the page, so custom domains and Vercel
   preview domains both produce a link that opens the same deployment. */
(function (ET) {
  'use strict';
  var scope = ET.libraryScope();
  if (!scope) return;
  var t = ET.i18n.t, h = ET.i18n.h;
  var L = (ET.library().languages || {})[scope.lang] || {};
  // A page's own name leads: /idakho and /tiriki share one shelf.
  var language = scope.native || L.native || scope.name || L.name || scope.lang;
  var publicUrl = location.protocol === 'file:' && !ET.native
    ? location.href.split(/[?#]/)[0]
    : ET.publicOrigin + '/' + scope.slug;

  document.title = t('sharelib.title', { lang: (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin' || scope.lang === 'hau' || scope.lang === 'mlg' || scope.lang === 'nya' || scope.lang === 'run' || scope.lang === 'aka' || scope.lang === 'tir' || scope.lang === 'hat' || scope.lang === 'spa' || scope.lang === 'kuj' || scope.lang === 'lsm' || scope.lang === 'luy' || scope.lang === 'bxk' || scope.lang === 'rag' || scope.lang === 'ida' || scope.lang === 'lkb' || scope.lang === 'lts' || scope.lang === 'nle' || scope.lang === 'lri' || scope.lang === 'kam' || scope.lang === 'kln' || scope.lang === 'nyf' || scope.lang === 'dig' || scope.lang === 'dug' || scope.lang === 'mer' || scope.lang === 'tuv' || scope.lang === 'teo' || scope.lang === 'ara' || scope.lang === 'kin' || scope.lang === 'xho' || scope.lang === 'sna') ? language : L.name || scope.name || language });
  ET.$('#shared-badge').innerHTML = h('sharelib.only', { lang: language });
  // Kandili waves from the corner of every language page, like the front door.
  var hero = ET.$('.shared-hero');
  if (hero && ET.lantern && !ET.$('.shared-mascot', hero)) {
    var k = document.createElement('span');
    k.className = 'shared-mascot';
    k.setAttribute('aria-hidden', 'true');
    k.innerHTML = ET.lantern(64, 'hello');
    hero.appendChild(k);
    if (ET.loadMascot) ET.loadMascot();
  }
  ET.$('#shared-title').innerHTML = h('sharelib.title', { lang: language });
  var languageNote = ET.i18n.meta && ET.i18n.meta(scope.ui || 'en').interfaceNote;
  ET.$('#shared-lead').innerHTML = h('sharelib.lead', { lang: language }) +
    (languageNote ? '<br><span class="latin" lang="en" dir="ltr">' + ET.esc(languageNote) + '</span>' : '');

  var email = ET.$('#email-library');
  email.innerHTML = ET.icon('share') + h('sharelib.email');
  function emailUrl(url) {
    var mailLanguage = (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin' || scope.lang === 'hau' || scope.lang === 'mlg' || scope.lang === 'nya' || scope.lang === 'run' || scope.lang === 'aka' || scope.lang === 'tir' || scope.lang === 'hat' || scope.lang === 'spa' || scope.lang === 'kuj' || scope.lang === 'lsm' || scope.lang === 'luy' || scope.lang === 'bxk' || scope.lang === 'rag' || scope.lang === 'ida' || scope.lang === 'lkb' || scope.lang === 'lts' || scope.lang === 'nle' || scope.lang === 'lri' || scope.lang === 'kam' || scope.lang === 'kln' || scope.lang === 'nyf' || scope.lang === 'dig' || scope.lang === 'dug' || scope.lang === 'mer' || scope.lang === 'tuv' || scope.lang === 'teo' || scope.lang === 'ara' || scope.lang === 'kin' || scope.lang === 'xho' || scope.lang === 'sna') ? language : L.name || language;
    return 'mailto:?subject=' + encodeURIComponent(t('sharelib.subject', { lang: mailLanguage })) +
      '&body=' + encodeURIComponent(t('sharelib.body', { lang: mailLanguage, url: url }));
  }
  email.href = emailUrl(publicUrl);
  var sendForm = ET.online && window.fetch && buildSendForm();
  email.addEventListener('click', function (e) {
    if (sendForm) {
      e.preventDefault();
      sendForm.hidden = !sendForm.hidden;
      email.setAttribute('aria-expanded', String(!sendForm.hidden));
      if (!sendForm.hidden) ET.$('#send-to').focus();
      return;
    }
    var intent = ET.analytics.shareIntent(publicUrl, 'email', { language: scope.lang });
    email.href = emailUrl(intent.url);
  });

  /* Online, the outreach account sends a fixed message with this library's
     link. If the server can't send (not set up, offline), the visitor's own
     email app opens instead, addressed to the same person. */
  function buildSendForm() {
    var form = document.createElement('form');
    form.className = 'send-library'; form.id = 'send-library'; form.hidden = true; form.noValidate = true;
    form.innerHTML = '<label class="flabel" for="send-to">' + h('sharelib.send.label') + '</label>' +
      '<div class="send-library-row"><input type="email" id="send-to" name="to" required maxlength="254" ' +
      'autocomplete="email" inputmode="email" dir="ltr" placeholder="' + ET.esc(t('sharelib.send.placeholder')) + '">' +
      '<button class="btn green" type="submit" id="send-button">' + h('sharelib.send.button') + '</button></div>' +
      '<p class="muted send-library-status" id="send-status" role="status" aria-live="polite"></p>';
    ET.$('.shared-hero').insertBefore(form, ET.$('#copy-status'));
    email.setAttribute('aria-controls', 'send-library');
    email.setAttribute('aria-expanded', 'false');
    var input = form.querySelector('#send-to'), button = form.querySelector('#send-button'),
      status = form.querySelector('#send-status');
    function say(key, vars) { status.innerHTML = h(key, vars); }
    function openMailApp(to, url) {
      location.href = emailUrl(url).replace('mailto:?', 'mailto:' + encodeURIComponent(to) + '?');
      say('sharelib.send.fallback');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var to = input.value.trim();
      if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[A-Za-z]{2,}$/.test(to)) { say('sharelib.send.invalid'); input.focus(); return; }
      var intent = ET.analytics.shareIntent(publicUrl, 'email', { language: scope.lang });
      button.disabled = true; say('sharelib.send.sending');
      fetch('/api/send-library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(intent.shareId ? { to: to, library: scope.slug, shareId: intent.shareId } : { to: to, library: scope.slug })
      }).then(function (r) {
        button.disabled = false;
        if (r.ok) {
          ET.analytics.track('share_complete', { language: scope.lang, channel: 'email', shareId: intent.shareId, status: 'sent' });
          say('sharelib.send.sent', { to: to }); input.value = '';
        } else if (r.status === 400) say('sharelib.send.invalid');
        else if (r.status === 429) say('sharelib.send.limit');
        else openMailApp(to, intent.url);
      }, function () { button.disabled = false; openMailApp(to, intent.url); });
    });
    return form;
  }

  function composerUrl(channel, url) {
    return channel === 'whatsapp'
      ? 'https://wa.me/?text=' + encodeURIComponent(document.title + '\n' + url)
      : 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(document.title);
  }
  /* The page ships the share buttons already in place, so the hero is its
     final height from the first paint and nothing below it jumps when this
     runs. Off a card they can't work, so they go. */
  var actions = ET.$('.shared-actions');
  function channel(name, cls, label) {
    var a = actions && ET.$('[data-shared-channel="' + name + '"]', actions);
    if (!a && actions && ET.online) {
      a = document.createElement('a');
      a.setAttribute('data-shared-channel', name);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      actions.appendChild(a);
    }
    if (!a) return null;
    if (!ET.online) { a.remove(); return null; }
    a.className = cls; a.textContent = label;
    return a;
  }
  var fb = channel('facebook', 'btn fb', '');
  if (fb) {
    fb.innerHTML = ET.icon('facebook') + h('fbshare.button');
    fb.href = ET.facebookUrl(publicUrl);
    fb.addEventListener('click', function () {
      var intent = ET.analytics.shareIntent(publicUrl, 'facebook', { language: scope.lang, status: 'opened' });
      ET.facebookShare(fb, intent.url, t('fbshare.post', { lang: language }));
    });
  }
  [['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']].forEach(function (method) {
    var a = channel(method[0], 'btn ghost', method[1]);
    if (!a) return;
    a.href = composerUrl(method[0], publicUrl);
    a.addEventListener('click', function () {
      var intent = ET.analytics.shareIntent(publicUrl, method[0], { language: scope.lang, status: 'opened' });
      a.href = composerUrl(method[0], intent.url);
    });
  });

  var copy = ET.$('#copy-library');
  copy.innerHTML = ET.icon('link') + h('sharelib.copy');
  copy.addEventListener('click', function () {
    var intent = ET.analytics.shareIntent(publicUrl, 'copy_link', { language: scope.lang });
    function done() {
      ET.analytics.track('share_complete', {
        language: scope.lang, channel: 'copy_link', shareId: intent.shareId, status: 'copied'
      });
      copy.innerHTML = ET.icon('check') + h('sharelib.copied');
      ET.$('#copy-status').innerHTML = h('sharelib.copied');
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = intent.url;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(intent.url).then(done, fallback);
    } else fallback();
  });
})(window.ET);
