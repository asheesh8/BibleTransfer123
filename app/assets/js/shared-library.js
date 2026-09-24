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

  document.title = t('sharelib.title', { lang: L.name || scope.name || language });
  ET.$('#shared-badge').textContent = t('sharelib.only', { lang: language });
  ET.$('#shared-title').textContent = t('sharelib.title', { lang: language });
  ET.$('#shared-lead').textContent = t('sharelib.lead', { lang: language });

  var email = ET.$('#email-library');
  email.innerHTML = ET.icon('share') + h('sharelib.email');
  email.href = 'mailto:?subject=' + encodeURIComponent(t('sharelib.subject', { lang: L.name || language })) +
    '&body=' + encodeURIComponent(t('sharelib.body', { lang: L.name || language, url: publicUrl }));

  var copy = ET.$('#copy-library');
  copy.innerHTML = ET.icon('link') + h('sharelib.copy');
  copy.addEventListener('click', function () {
    function done() {
      copy.innerHTML = ET.icon('check') + h('sharelib.copied');
      ET.$('#copy-status').textContent = t('sharelib.copied');
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = publicUrl;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(publicUrl).then(done, fallback);
    } else fallback();
  });
})(window.ET);
