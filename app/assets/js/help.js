/* "I saved it — where did it go?"

   This page exists because that is the question that actually stops people. A
   file that was downloaded successfully and cannot be found again has failed
   just as completely as one that never downloaded. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, tOr = ET.i18n.tOr, tOrHTML = ET.i18n.tOrHTML;

  var SECTIONS = [
    {
      icon: 'phone', key: 'help.android', title: 'On an Android phone',
      steps: [
        ['Open the Files app', 'It may be called Files, My Files, or File Manager depending on the phone.'],
        ['Go to Downloads', 'Anything you saved from this library is there unless you chose somewhere else.'],
        ['Tap the file', 'A PDF opens in a reader, an MP3 in a music player, an MP4 in a video player. If the phone asks which app to use, pick one and tap Always.'],
        ['If nothing opens it', 'The phone has no app for that kind of file. A PDF reader and a video player are the two worth installing while you still have a signal.']
      ]
    },
    {
      icon: 'phone', key: 'help.ios', title: 'On an iPhone or iPad',
      steps: [
        ['Open the Files app', 'Blue folder icon. Not Photos — saved documents do not go to Photos.'],
        ['Tap On My iPhone, then Downloads', 'If you only see iCloud Drive, tap Browse at the bottom first.'],
        ['Tap the file', 'PDFs and videos open straight away. Nothing needs installing.'],
        ['Keep it on the phone', 'If it is in iCloud Drive rather than On My iPhone, it may need a connection to open later. Move it to On My iPhone to be sure.']
      ]
    },
    {
      icon: 'laptop', key: 'help.computer', title: 'On a computer',
      steps: [
        ['Look in Downloads', 'Windows: This PC, then Downloads. Mac: Finder, then Downloads.'],
        ['Open it', 'Every computer can already open a PDF, an MP3 and an MP4.'],
        ['To keep the whole library', 'Copy the entire card, not individual files. Keep every folder name exactly as it is.']
      ]
    },
    {
      icon: 'save', key: 'help.install', title: 'Put the library on your home screen',
      steps: [
        ['Why bother', 'It gets its own icon, opens full screen with one tap, and stops being something you have to find a folder for. Nothing is downloaded twice — it is the same library.'],
        ['On Android', 'Open the library in Chrome, tap the three dots, then Add to Home screen. If a button offered it on the first screen, that does the same thing.'],
        ['On iPhone or iPad', 'Open the library in Safari — not Chrome, this only works in Safari. Tap the Share button at the bottom, scroll down, then Add to Home Screen.'],
        ['If you do not see the option', 'You are probably opening the library straight from the card rather than over the VillageServer Wi-Fi. Both work; only the Wi-Fi one can be installed.']
      ]
    },
    {
      icon: 'wifi', key: 'help.pi', title: 'From the VillageServer Wi-Fi',
      steps: [
        ['Join the network', 'Connect to the VillageServer Wi-Fi. It has no internet — that is expected and does not mean it is broken.'],
        ['Open the address in a browser', 'Type the address printed on the kit into any browser. The library opens.'],
        ['Save what you want to keep', 'Anything you open over the Wi-Fi is gone when you walk away. Tap Save on the things you want to keep, so they live on your own phone.']
      ]
    }
  ];

  var TROUBLE = [
    ['The library opens but everything is blank',
     'The folders were renamed or the copy was incomplete. Copy the whole card again, keeping every folder name exactly as it was.'],
    ['A film will not play',
     'Either the file did not finish copying, or the phone has no video player. Try a different item: if none play, it is the player; if only one fails, it is that file.'],
    ['It says "needs internet"',
     'That item was never stored on this card — only its listing was. It will open when the device has a connection, and not before.'],
    ['I saved something and cannot find it',
     'Look in Downloads first. If it is not there, save it again and watch where the phone says it is putting it.']
  ];

  function render() {
    var out = SECTIONS.map(function (s) {
      return '<div class="card"><div style="display:flex;align-items:center;gap:.7rem;' +
        'margin-bottom:.8rem"><span class="ico" style="width:44px;height:44px;' +
        'display:grid;place-items:center;border-radius:var(--r);' +
        'background:var(--purple-wash);color:var(--purple)">' + ET.icon(s.icon) +
        '</span><h2 style="margin:0">' + tOrHTML(s.key + '.h', s.title) + '</h2></div>' +
        '<ol class="steps">' + s.steps.map(function (st, i) {
          var k = s.key + '.' + (i + 1);
          return '<li><h3>' + tOrHTML(k + '.h', st[0]) + '</h3>' +
                 '<p>' + tOrHTML(k + '.p', st[1]) + '</p></li>';
        }).join('') + '</ol></div>';
    }).join('');

    out += '<div class="card"><h2>' +
      tOrHTML('help.trouble', 'When something does not work') + '</h2>' +
      TROUBLE.map(function (x, i) {
        return '<div class="note" style="margin-top:.7rem"><strong>' +
          tOrHTML('help.trouble.' + i + '.h', x[0]) + '</strong>' +
          '<p style="margin:.25rem 0 0">' +
          tOrHTML('help.trouble.' + i + '.p', x[1]) + '</p></div>';
      }).join('') + '</div>';

    out += '<div class="note good"><strong>' +
      tOrHTML('help.golden', 'Open it once before you need it') + '</strong>' +
      '<p style="margin:.25rem 0 0">' +
      tOrHTML('help.golden.p', 'The moment to find out a file is broken is now, ' +
        'while the card is still in your hand — not next week in front of a room ' +
        'of people waiting.') + '</p></div>';

    ET.$('#help').innerHTML = out;
  }

  ET.header('help');
  ET.$('#back-ico').innerHTML = ET.icon('back', 'flip');
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
})(window.ET);
