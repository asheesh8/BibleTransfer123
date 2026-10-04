/* The small sharing panel at the top of every one-language library. The URL is
   built from the origin that served the page, so custom domains and Vercel
   preview domains both produce a link that opens the same deployment. */
(function (ET) {
  'use strict';
  var scope = ET.libraryScope();
  if (!scope) return;
  var t = ET.i18n.t, h = ET.i18n.h;
  var L = (ET.library().languages || {})[scope.lang] || {};
  var language = L.native || scope.name || L.name || scope.lang;
  var publicUrl = location.protocol === 'file:'
    ? location.href.split(/[?#]/)[0]
    : location.origin + '/' + scope.slug;

  document.title = t('sharelib.title', { lang: (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin') ? language : L.name || scope.name || language });
  ET.$('#shared-badge').innerHTML = h('sharelib.only', { lang: language });
  ET.$('#shared-title').innerHTML = h('sharelib.title', { lang: language });
  var languageNote = ET.i18n.meta && ET.i18n.meta(scope.ui || 'en').interfaceNote;
  ET.$('#shared-lead').innerHTML = h('sharelib.lead', { lang: language }) +
    (languageNote ? '<br><span class="latin" lang="en" dir="ltr">' + ET.esc(languageNote) + '</span>' : '');

  var email = ET.$('#email-library');
  email.innerHTML = ET.icon('share') + h('sharelib.email');
  function emailUrl(url) {
    var mailLanguage = (scope.lang === 'fra' || scope.lang === 'amh' || scope.lang === 'por' || scope.lang === 'yor' || scope.lang === 'pcm' || scope.lang === 'lin') ? language : L.name || language;
    return 'mailto:?subject=' + encodeURIComponent(t('sharelib.subject', { lang: mailLanguage })) +
      '&body=' + encodeURIComponent(t('sharelib.body', { lang: mailLanguage, url: url }));
  }
  email.href = emailUrl(publicUrl);
  email.addEventListener('click', function () {
    var intent = ET.analytics.shareIntent(publicUrl, 'email', { language: scope.lang });
    email.href = emailUrl(intent.url);
  });

  function composerUrl(channel, url) {
    return channel === 'whatsapp'
      ? 'https://wa.me/?text=' + encodeURIComponent(document.title + '\n' + url)
      : 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(document.title);
  }
  var actions = ET.$('.shared-actions');
  if (/^https?:$/.test(location.protocol) && actions) {
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
