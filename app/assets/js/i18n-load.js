/* Loads the interface strings this page needs: English (the fallback) and the
   reader's language, from app/assets/js/i18n/<code>.js. Two small tables
   instead of all 38.

   A plain, non-deferred script placed just before i18n.js. It writes the two
   <script> tags while the page is still being read, so they keep their place
   in the defer order, ahead of i18n.js, off a card too. A page whose scripts
   are not deferred marks this tag data-sync.

   Same choice of language as i18n.js: a language library's fixed interface,
   then a scoped link's ?ui= (English when ?only= has none), then the reader's
   saved choice. With no choice yet, English alone: the first-run screen shows
   every language from the small table inside i18n.js, and choosing one loads
   its file then. */
(function () {
  var code = '', m;
  var lib = window.ET_SHARED_LIBRARY;
  try { code = localStorage.getItem('et.lang') || ''; } catch (e) {}
  if (lib && lib.lang) {
    code = lib.ui || code;
  } else if (/[?&]only=[a-z]{3}(?:[&#]|$)/.test(location.search)) {
    m = /[?&]ui=([^&#]*)/.exec(location.search);
    code = m ? decodeURIComponent(m[1]) : 'en';
  }
  var me = document.currentScript;
  var tag = '<script' + (me && me.hasAttribute('data-sync') ? '' : ' defer') + ' src="assets/js/i18n/';
  var html = tag + 'en.js"><\/script>';
  if (code !== 'en' && /^[a-z]{2,3}$/.test(code)) html += tag + code + '.js"><\/script>';
  document.write(html);
})();
