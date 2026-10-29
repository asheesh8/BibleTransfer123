/* ============================================================================
   features/partner-preview.js: the partner preview, for pitch meetings.

   The library gives every partner library its own section (library.js). DBS
   is live. The partners below are being invited and are NOT partners yet, so
   the public never sees them: library.js fetches this file only when the
   phone has asked for the preview with ?demo=partners (it stays on for that
   phone until ?demo=off). Each gets an empty shelf that says it is waiting
   for them and asks for help filling it; its button shows where the content
   would sit and the three ways it would travel from phone to phone.

   Depends on: core.js, ui/sheet.js. English only: it is shown in meetings,
   not to readers. Logos sit in assets/partners/ and show only here.
   ========================================================================= */

window.ET.module('features/partner-preview', ['core', 'ui/sheet'], function (ET) {
  'use strict';
  var esc = ET.esc;
  function icon(n) { return ET.ui && ET.ui.icon ? ET.ui.icon(n) : ET.icon(n); }

  var partners = [
    {
      id: 'cef', name: 'Child Evangelism Fellowship', mark: 'CEF', tone: 'gold',
      logo: 'assets/partners/cef.webp',
      tagline: 'Bible lessons, songs and stories for children',
      preview: true
    },
    {
      id: 'braxton', name: 'Dean Braxton', mark: 'DB', tone: 'sky',
      tagline: 'Talks and testimony, to watch and pass on',
      preview: true
    },
    {
      id: 'unite', name: 'Unite', mark: 'U', tone: 'green',
      tagline: 'Their films and studies',
      preview: true
    },
    {
      id: 'youversion', name: 'YouVersion', mark: 'YV', tone: 'purple',
      logo: 'assets/partners/youversion-kids.webp',
      tagline: 'Reading plans, audio Bibles and Bible stories for kids',
      preview: true
    }
  ];

  /* The three ways anything in the library travels, each with a button to the
     real, working screen, so the meeting sees it rather than hears about it. */
  function routes(example) {
    var item = example ? ET.scopedUrl('item.html', { id: example.id }) : 'library.html';
    return [
      { ico: 'qr', name: 'Phone to phone with a QR code',
        text: 'One phone shows a code, the other scans it, and the file copies straight across.',
        href: 'nearby.html', go: 'See QR send' },
      { ico: 'share', name: 'A link for WhatsApp, Facebook or email',
        text: 'Each item and each language library has its own link, so we can see how many people it reaches.',
        href: 'share-libraries/', go: 'See the links' },
      { ico: 'mail', name: 'The share card',
        text: 'A picture card that says who sent it to whom, so we can count how far it travels, hop by hop.',
        href: item, go: example ? 'Open one and tap Share' : 'Open the library' }
    ];
  }

  function open(p, example) {
    var body =
      '<div class="pp" lang="en" dir="ltr">' +
        '<header class="partner-head partner-head--' + p.tone + '">' +
          '<span class="partner-mark' + (p.logo ? ' partner-mark--logo' : '') + '" aria-hidden="true">' +
            (p.logo ? '<img src="' + esc(p.logo) + '" alt="">' : esc(p.mark)) + '</span>' +
          '<span class="partner-head__text"><span class="partner-soon">Empty shelf · waiting for you</span>' +
          '<strong class="pp-name">' + esc(p.name) + '</strong>' +
          '<span class="partner-tag">' + esc(p.tagline) + '</span></span></header>' +
        '<p class="pp-lead">When ' + esc(p.name) + ' joins, this shelf fills up, next to the ' +
          'Digital Bible Society, in every language this library carries: on the website, in the phone app, ' +
          'on the offline card and on Village Server hubs. Everything on it plays, saves and shares ' +
          'like everything else here.</p>' +
        '<h3 class="pp-h">How it travels</h3>' +
        '<ol class="pp-routes">' + routes(example).map(function (r) {
          return '<li class="pp-route"><span class="pp-ico">' + icon(r.ico) + '</span>' +
            '<span class="pp-txt"><strong>' + esc(r.name) + '</strong><span>' + esc(r.text) + '</span></span>' +
            '<a class="et-btn et-btn--quiet pp-go" href="' + esc(r.href) + '">' + esc(r.go) + '</a></li>';
        }).join('') + '</ol>' +
      '</div>';
    return ET.ui.sheet.open({ title: 'A shelf for ' + p.name, body: body, closeLabel: 'Close' });
  }

  // A strip under the header, so whoever holds the phone knows the preview
  // is on, and can turn it off before handing the phone to someone else.
  function banner() {
    if (ET.$('#partner-preview-bar')) return;
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="pp-bar" id="partner-preview-bar" lang="en" dir="ltr" role="note">' +
        '<span>Partner preview is on (this phone only)</span>' +
        '<a href="' + esc(location.pathname) + '?demo=off">Turn off</a></div>');
  }

  var api = { partners: partners, open: open, banner: banner };
  ET.partnerPreview = api;
  return api;
});
