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
  var publicUrl = location.protocol === 'file:'
    ? location.href.split(/[?#]/)[0]
    : location.origin + '/' + scope.slug;

  document.title = t('sharelib.title', { lang: (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin' || scope.lang === 'hau' || scope.lang === 'mlg' || scope.lang === 'nya' || scope.lang === 'run' || scope.lang === 'aka' || scope.lang === 'tir' || scope.lang === 'hat' || scope.lang === 'spa' || scope.lang === 'kuj' || scope.lang === 'lsm' || scope.lang === 'luy' || scope.lang === 'bxk' || scope.lang === 'rag' || scope.lang === 'ida' || scope.lang === 'ara' || scope.lang === 'kin' || scope.lang === 'xho' || scope.lang === 'sna') ? language : L.name || scope.name || language });
  ET.$('#shared-badge').innerHTML = h('sharelib.only', { lang: language });
  ET.$('#shared-title').innerHTML = h('sharelib.title', { lang: language });
  var languageNote = ET.i18n.meta && ET.i18n.meta(scope.ui || 'en').interfaceNote;
  ET.$('#shared-lead').innerHTML = h('sharelib.lead', { lang: language }) +
    (languageNote ? '<br><span class="latin" lang="en" dir="ltr">' + ET.esc(languageNote) + '</span>' : '');

  var email = ET.$('#email-library');
  email.innerHTML = ET.icon('share') + h('sharelib.email');
  function emailUrl(url) {
    var mailLanguage = (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin' || scope.lang === 'hau' || scope.lang === 'mlg' || scope.lang === 'nya' || scope.lang === 'run' || scope.lang === 'aka' || scope.lang === 'tir' || scope.lang === 'hat' || scope.lang === 'spa' || scope.lang === 'kuj' || scope.lang === 'lsm' || scope.lang === 'luy' || scope.lang === 'bxk' || scope.lang === 'rag' || scope.lang === 'ida' || scope.lang === 'ara' || scope.lang === 'kin' || scope.lang === 'xho' || scope.lang === 'sna') ? language : L.name || language;
    return 'mailto:?subject=' + encodeURIComponent(t('sharelib.subject', { lang: mailLanguage })) +
      '&body=' + encodeURIComponent(t('sharelib.body', { lang: mailLanguage, url: url }));
  }
  email.href = emailUrl(publicUrl);
  var sendForm = /^https?:$/.test(location.protocol) && window.fetch && buildSendForm();
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
  var actions = ET.$('.shared-actions');
  if (/^https?:$/.test(location.protocol) && actions) {
    var fb = document.createElement('a');
    fb.className = 'btn fb'; fb.setAttribute('data-shared-channel', 'facebook');
    fb.innerHTML = ET.icon('facebook') + h('fbshare.button');
    fb.target = '_blank'; fb.rel = 'noopener noreferrer';
    fb.href = ET.facebookUrl(publicUrl);
    fb.addEventListener('click', function () {
      var intent = ET.analytics.shareIntent(publicUrl, 'facebook', { language: scope.lang, status: 'opened' });
      ET.facebookShare(fb, intent.url, t('fbshare.post', { lang: language }));
    });
    actions.insertBefore(fb, email.nextSibling);
    [['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']].forEach(function (method) {
      var a = document.createElement('a');
      a.className = 'btn ghost'; a.textContent = method[1];
      a.setAttribute('data-shared-channel', method[0]);
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.href = composerUrl(method[0], publicUrl);
      a.addEventListener('click', function () {
        var intent = ET.analytics.shareIntent(publicUrl, method[0], { language: scope.lang, status: 'opened' });
        a.href = composerUrl(method[0], intent.url);
      });
      actions.appendChild(a);
    });
  }

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
