/* Larry's one-screen launcher for the public, one-language libraries. */
(function (ET) {
  'use strict';
  var routes = [
    ['english', 'eng', 'English', 'English'],
    ['mandarin', 'cmn', 'Mandarin', '普通话'],
    ['hindi', 'hin', 'Hindi', 'हिन्दी'],
    ['urdu', 'urd', 'Urdu', 'اردو'],
    ['swahili', 'swh', 'Swahili', 'Kiswahili'],
    ['zulu', 'zul', 'Zulu', 'isiZulu'],
    ['western-punjabi', 'pnb', 'Western Punjabi', 'پنجابی'],
    ['cantonese', 'yue', 'Cantonese', '廣東話'],
    ['pashto', 'pus', 'Pashto', 'پښتو'],
    ['eastern-punjabi', 'pan', 'Eastern Punjabi', 'ਪੰਜਾਬੀ'],
    ['nepali', 'npi', 'Nepali', 'नेपाली'],
    ['sindhi', 'snd', 'Sindhi', 'سنڌي'],
    ['gusii', 'guz', 'Gusii / Ekegusii / Kisii', 'Ekegusii / Kisii'],
    ['maasai', 'mas', 'Maasai', 'ɔl Maa']
  ];
  var resources = ET.library().resources;
  var web = location.protocol === 'http:' || location.protocol === 'https:';
  var t = ET.i18n.t, h = ET.i18n.h;

  function urlFor(slug) {
    return web ? location.origin + '/' + slug : slug + '/index.html';
  }

  function render() {
    ET.$('#share-language-list').innerHTML = routes.map(function (x) {
      var url = urlFor(x[0]);
      var count = resources.filter(function (r) { return r.lang === x[1]; }).length;
      var subject = t('sharelib.subject', { lang: x[2] });
      var body = t('sharelib.body', { lang: x[2], url: url });
      return '<article class="card share-language-card"><div>' +
        '<h2 dir="auto">' + ET.esc(x[3]) + '</h2>' +
        '<p class="latin muted">' + ET.esc(x[2]) + ' · ' +
          ET.esc(t('sharelib.launch.resources', { n: count })) + '</p>' +
        '</div><div class="btn-row">' +
        '<a class="btn sky" href="' + ET.esc(url) + '">' + ET.icon('book') + h('sharelib.launch.open') + '</a>' +
        '<a class="btn green" href="mailto:?subject=' + encodeURIComponent(subject) + '&body=' +
          encodeURIComponent(body) + '">' + ET.icon('share') + h('sharelib.email') + '</a>' +
        '</div></article>';
    }).join('');
  }

  ET.$('#share-back-ico').innerHTML = ET.icon('back');
  if (!web) ET.$('#web-note').hidden = false;
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
})(window.ET);
