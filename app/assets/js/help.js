/* "I saved it — where did it go?"

   This page exists because that is the question that actually stops people. A
   file that was downloaded successfully and cannot be found again has failed
   just as completely as one that never downloaded. */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h, tOr = ET.i18n.tOr, tOrHTML = ET.i18n.tOrHTML;

  var SECTIONS = [
    {
      icon: 'phone', key: 'help.android', id: 'phone-android', device: 'android', title: 'On an Android phone',
      steps: [
        ['Open the Files app', 'It may be called Files, My Files, or File Manager depending on the phone.'],
        ['Go to Downloads', 'Anything you saved from this library is there unless you chose somewhere else.'],
        ['Tap the file', 'A PDF opens in a reader, an MP3 in a music player, an MP4 in a video player. If the phone asks which app to use, pick one and tap Always.'],
        ['If nothing opens it', 'The phone has no app for that kind of file. A PDF reader and a video player are the two worth installing while you still have a signal.']
      ]
    },
    {
      icon: 'phone', key: 'help.ios', id: 'phone-apple', device: 'apple', title: 'On an iPhone or iPad',
      // Apple's Downloads location guidance: https://support.apple.com/102440
      // Fresh keys avoid serving old translations that assumed local storage.
      steps: [
        ['Open the Files app', 'Blue folder icon. Not Photos — saved documents do not go to Photos.'],
        ['Tap Browse, then Downloads', 'If Downloads is not shown, tap iCloud Drive, then Downloads. If you saved to On My iPhone or On My iPad, look there instead.'],
        ['Tap the file', 'Tap the book, audio, or video you saved. If the file does not open, you may need an app that can read that kind of file.'],
        ['Keep it on the phone', 'If it is in iCloud Drive rather than On My iPhone, it may need a connection to open later. Move it to On My iPhone to be sure.']
      ],
      stepKeys: { 2: 'help.ios.downloads', 3: 'help.ios.openfile' },
      support: 'https://support.apple.com/102440', supportLabel: 'More help from Apple'
    },
    {
      icon: 'phone', key: 'help.samsung', id: 'phone-samsung', device: 'samsung', title: 'On a Samsung phone',
      // Samsung's My Files guidance:
      // https://www.samsung.com/uk/support/mobile-devices/where-can-i-find-downloaded-files-on-my-samsung-galaxy-smartphone/
      steps: [
        ['Open My Files', 'Look for the orange folder. It may be inside a folder called Samsung. If you cannot find it, swipe up and search for My Files.'],
        ['Tap Downloads', 'This is where files saved from the web usually appear. If you chose another folder when saving, look in that folder instead.'],
        ['Tap the file you saved', 'Tap your book, audio, or video. If asked, choose an app to open it. If you cannot see the file, tap the search icon and type its name.']
      ],
      support: 'https://www.samsung.com/uk/support/mobile-devices/where-can-i-find-downloaded-files-on-my-samsung-galaxy-smartphone/', supportLabel: 'More help from Samsung'
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

  // Simple illustrations are intentionally recognisable, rather than screenshots
  // of a particular phone version. Every drawing is decorative; its action is
  // repeated in the adjacent heading and numbered instructions.
  function appPicture(device) {
    var colour = device === 'samsung' ? '#F6A624' : '#2387ED';
    var pieces = device === 'android' ?
      '<path d="M19 30h21l8 8h29v35H19z" fill="#36A853"/><path d="M19 43h58v30H19z" fill="#FBBC04"/><path d="M19 57h58v16H19z" fill="#EA4335"/>' : '';
    return '<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">' +
      '<rect x="2" y="2" width="92" height="92" rx="22" fill="' + (device === 'samsung' ? colour : '#FFFFFF') + '"/>' + pieces +
      '<path d="M19 33a5 5 0 0 1 5-5h18l7 8h23a5 5 0 0 1 5 5v28a6 6 0 0 1-6 6H25a6 6 0 0 1-6-6z" fill="' + (device === 'samsung' ? '#FFFFFF' : colour) + '"/>' +
      '</svg>';
  }

  function phonePicture(device) {
    var screen = device === 'apple' ? '#E7EFFE' : device === 'samsung' ? '#E6EAFD' : '#E7F5E9';
    var mark = device === 'apple' ?
      '<path d="M84 43c-5 0-9 4-11 4-3 0-6-4-11-4-8 0-14 7-14 17 0 12 8 26 14 26 3 0 6-3 10-3s7 3 10 3c6 0 12-11 14-17-8-3-10-13-2-18-3-5-6-8-10-8zM75 42c0-8 5-13 12-15 0 8-5 14-12 15z" fill="#253145"/>' :
      device === 'samsung' ? '<text x="72" y="65" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#203E8D">SAMSUNG</text>' :
      '<path d="M49 64a23 23 0 0 1 46 0z" fill="#3C9F58"/><path d="m55 43-5-8m39 8 5-8" stroke="#3C9F58" stroke-width="3" stroke-linecap="round"/><circle cx="61" cy="54" r="2" fill="#FFFFFF"/><circle cx="83" cy="54" r="2" fill="#FFFFFF"/>';
    return '<svg viewBox="0 0 144 190" aria-hidden="true" focusable="false">' +
      '<rect x="23" y="4" width="98" height="182" rx="20" fill="#253145"/>' +
      '<rect x="29" y="11" width="86" height="168" rx="15" fill="' + screen + '"/>' +
      '<rect x="52" y="12" width="40" height="8" rx="4" fill="#253145"/>' + mark +
      '<rect x="48" y="105" width="48" height="48" rx="12" fill="' + (device === 'samsung' ? '#F6A624' : '#FFFFFF') + '"/>' +
      '<path d="M58 119h12l4 4h13v18H58z" fill="' + (device === 'samsung' ? '#FFFFFF' : '#2387ED') + '"/>' +
      '<rect x="56" y="168" width="32" height="3" rx="2" fill="#253145"/>' +
      '</svg>';
  }

  function stepPicture(device, index) {
    if (index === 0) return appPicture(device);
    if (index === 1) return '<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><rect x="2" y="2" width="92" height="92" rx="22" fill="#EAF2FE"/><path d="M17 34h25l8 8h29v33H17z" fill="#2387ED"/><path d="M48 25v35m-11-11 11 11 11-11" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if (index === 2) return '<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false"><rect x="2" y="2" width="92" height="92" rx="22" fill="#EAF6EC"/><path d="M28 17h27l14 14v48H28z" fill="#FFFFFF" stroke="#379053" stroke-width="3"/><path d="M55 17v15h14M38 46h20M38 55h20M38 64h12" fill="none" stroke="#379053" stroke-width="3" stroke-linecap="round"/></svg>';
    return '';
  }

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
    var out = '<a class="tile" href="' + ET.esc(ET.scopedUrl('save-guide.html')) + '" lang="en" dir="ltr">' +
      '<span class="ico">' + ET.icon('laptop') + '</span>' +
      '<span><span class="t">Save to your computer</span>' +
      '<span class="s">Screenshot guide · English · Mac + Windows</span></span>' +
      '<span class="chev">' + ET.icon('chev') + '</span></a>';
    out += SECTIONS.map(function (s) {
      var start = s.device ? '<section class="card help-device" id="' + s.id + '" aria-labelledby="' + s.id + '-title">' +
        '<div class="help-device-heading"><div class="help-device-phone">' + phonePicture(s.device) + '</div>' +
        '<div><h2 id="' + s.id + '-title">' + tOrHTML(s.key + '.h', s.title) + '</h2>' +
        '<p class="help-device-caption">' + tOrHTML('help.phone.follow', 'Follow the numbered steps below.') + '</p>' +
        '<div class="help-app-example"><span class="help-app-picture">' + appPicture(s.device) + '</span><span><strong lang="en" dir="ltr">' +
        (s.device === 'samsung' ? 'My Files' : 'Files') + '</strong><span>' + tOrHTML('help.phone.look', 'Look for this folder icon') + '</span></span></div></div></div>' :
        '<div class="card"><div style="display:flex;align-items:center;gap:.7rem;' +
        'margin-bottom:.8rem"><span class="ico" style="width:44px;height:44px;' +
        'display:grid;place-items:center;border-radius:var(--r);' +
        'background:var(--purple-wash);color:var(--purple)">' + ET.icon(s.icon) +
        '</span><h2 style="margin:0">' + tOrHTML(s.key + '.h', s.title) + '</h2></div>';
      return start + '<ol class="steps">' + s.steps.map(function (st, i) {
          var k = s.stepKeys && s.stepKeys[i + 1] || s.key + '.' + (i + 1);
          return '<li>' + (s.device ? '<span class="help-step-picture">' + stepPicture(s.device, i) + '</span>' : '') +
                 '<div class="help-step-copy"><h3>' + tOrHTML(k + '.h', st[0]) + '</h3>' +
                 '<p>' + tOrHTML(k + '.p', st[1]) + '</p></div></li>';
        }).join('') + '</ol>' + (s.support ? '<p class="help-device-support"><a href="' + s.support + '">' +
          tOrHTML(s.key + '.support', s.supportLabel) + '</a></p>' : '') + (s.device ? '</section>' : '</div>');
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

    // The only route into the device-by-device guides from here.
    out += '<a class="tile" href="' + ET.esc(ET.scopedUrl('share.html')) + '" style="margin-top:1rem">' +
      '<span class="ico">' + ET.icon('phone') + '</span>' +
      '<span><span class="t">' + h('share.howto') + '</span>' +
      '<span class="s">' + h('share.howto.sub') + '</span></span>' +
      '<span class="chev flip">' + ET.icon('chev') + '</span></a>';

    ET.$('#help').innerHTML = out;
    scrollToPhone();
  }

  function scrollToPhone() {
    var id = window.location.hash.slice(1);
    if (['phone-apple', 'phone-samsung', 'phone-android'].indexOf(id) < 0) return;
    window.requestAnimationFrame(function () {
      var section = document.getElementById(id);
      if (section) section.scrollIntoView({ block: 'start' });
    });
  }

  ET.header('help');
  ET.tabbar('help.html');
  ET.$('#back').href = ET.scopeEntryUrl();
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
  window.addEventListener('hashchange', scrollToPhone);
})(window.ET);
