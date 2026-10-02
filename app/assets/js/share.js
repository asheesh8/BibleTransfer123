/* The share wizard.

   Two questions, then the steps for exactly those two devices — no scrolling
   past five routes that do not apply. The routes themselves are VillageServer's
   own field doctrine: match the method to the devices in the room, send one
   small file first, confirm it opens offline, then hand the next transfer to
   the person you just taught.

   TRANSLATION: every string below goes through tOr(key, english). Add the key
   to STRINGS in i18n.js and it is translated; until then the English shows. */
(function (ET) {
  'use strict';
  var h = ET.i18n.h, tOrHTML = ET.i18n.tOrHTML;

  var DEVICES = [
    { id: 'iphone',   icon: 'phone',  key: 'dev.iphone' },
    { id: 'android',  icon: 'phone',  key: 'dev.android' },
    { id: 'computer', icon: 'laptop', key: 'dev.computer' },
    { id: 'card',     icon: 'card',   key: 'dev.card' }
  ];

  /* route id -> { name, steps[], warn? }. Looked up as "from>to", then "to<from"
     for the routes that are symmetric. */
  var ROUTES = {
    'iphone>iphone': {
      name: 'AirDrop',
      steps: [
        ['Turn on both radios', 'On both iPhones open Control Centre and make sure Wi-Fi and Bluetooth are on. AirDrop uses both, even though neither needs a network.'],
        ['Set the receiver to accept', 'On the receiving iPhone: Settings, General, AirDrop, then Everyone for 10 Minutes. If it is set to Contacts Only and you are not in their contacts, nothing will appear and neither of you will know why.'],
        ['Share from the Files app', 'On the sending iPhone open Files, find the saved file, press and hold it, tap Share, then tap the other person in the AirDrop row.'],
        ['Accept on the other phone', 'The receiver taps Accept and follows any prompt to open or save the file. Check the receiving app or search for the file in Files.'],
        ['Open it before you part', 'Have them open it once, now. A file nobody has opened is a file nobody knows is broken.']
      ]
    },
    'android>android': {
      name: 'Quick Share, or LocalSend',
      steps: [
        ['Try Quick Share first', 'On the sending phone open Files, press and hold the file, tap Share, then Quick Share. On the receiving phone pull down the quick settings and turn Quick Share on so it becomes visible.'],
        ['If Quick Share is not there, use LocalSend', 'Some Android phones do not have it. LocalSend does the same job, works between any two phones on one Wi-Fi network, and needs no account. Install it on both phones while you still have a signal — it is on the card if the kit includes it.'],
        ['Put both phones on the same network', 'The VillageServer Wi-Fi is enough. It does not need internet — the two phones only need to see each other.'],
        ['Send, then accept', 'Pick the file on the sender, pick the other phone from the list, and accept on the receiver.'],
        ['Check where it landed', 'Open the file on the receiving device. On Android, check Files, then Downloads (or the folder you chose).']
      ]
    },
    'iphone>android': {
      name: 'LocalSend, or a computer in between',
      steps: [
        ['Understand why this one is harder', 'AirDrop and Quick Share compatibility depends on the devices. If direct sharing is unavailable, use LocalSend on both phones.'],
        ['Best: LocalSend on both', 'Install LocalSend on the iPhone and the Android phone, put both on the same Wi-Fi — the VillageServer network is fine — and send. No internet, no account.'],
        ['If you cannot install anything', 'A computer can act as a bridge if it can access the file on both phones. iPhone file sharing requires a compatible app; follow the computer-to-phone guide for your devices.'],
        ['Or use the card itself', 'On a phone with a card slot or an adapter, put the file on a microSD card and move the card. This is the most reliable route with no network at all.'],
        ['Test with one small file', 'Whichever route you pick, send one PDF first and confirm it opens.']
      ]
    },
    'computer>iphone': {
      name: 'Cable, through Finder or Apple Devices',
      steps: [
        ['Plug the phone in', 'Use a cable that carries data. Many charging cables do not, and a charge-only cable looks identical — if the computer never shows the phone, try another cable before anything else.'],
        ['Trust the computer', 'The iPhone asks "Trust this computer?". Tap Trust and enter the passcode, or nothing will be visible.'],
        ['Open it on the computer', 'On a Mac, open Finder and select the iPhone. On Windows, open Apple Devices (or iTunes on older setups) and select the phone.'],
        ['Copy the file', 'Choose an app that supports File Sharing in Files (or File Sharing in iTunes). To send to the phone, add the file to that app. To send to the computer, save the file from that app.'],
        ['Check the received file', 'Open the file in the app used for File Sharing on the iPhone, or in the destination folder on the computer. Confirm it opens.']
      ]
    },
    'computer>android': {
      name: 'Cable, in file transfer mode',
      steps: [
        ['Plug the phone in', 'Use a data cable, not a charge-only one.'],
        ['Switch the phone to file transfer', 'Android connects as charging-only by default. Pull down the notification that says "Charging this device via USB", tap it, and choose File Transfer. Without this the computer sees nothing and it looks like the cable is broken.'],
        ['Open the phone on the computer', 'On Windows, open the phone in File Explorer. On a Mac, use a compatible Android file transfer app, or use LocalSend on both devices over the same Wi-Fi.'],
        ['Copy the file', 'To send to the phone, copy into its Download folder. To send to the computer, copy the saved file from the phone into a folder on the computer.'],
        ['Check the received file', 'Open the file on the receiving device. On Android, check Files, then Downloads or the folder you chose. On a computer, check the destination folder.']
      ]
    },
    'card>iphone': {
      name: 'Card reader into the Lightning or USB-C port',
      steps: [
        ['You need a reader', 'An iPhone has no card slot. You need a microSD reader that plugs into the phone’s own port — Lightning on older iPhones, USB-C on newer ones. Check which one before you travel.'],
        ['Put the card in the reader, the reader in the phone', 'The Files app shows the card as a new location in the sidebar.'],
        ['Copy, do not just open', 'Press and hold the file, then tap Copy. In Files, open On My iPhone or On My iPad, choose or create a folder, and paste. Opening a file on the card alone does not save it to your phone.'],
        ['Pull the card and check', 'Remove the reader, then open the file again from On My iPhone. If it still opens, it is really on the phone.']
      ]
    },
    'card>android': {
      name: 'Straight into the card slot',
      steps: [
        ['Find the slot', 'Many Android phones take a microSD card directly, usually in the SIM tray. If yours does not, a USB-C card reader does the same job.'],
        ['Open Files and find the card', 'The card appears as SD card or a similar name, separate from internal storage.'],
        ['Copy to the phone, do not just open', 'Press and hold the file, tap Copy, then paste into Internal storage, Download. A file left on the card leaves with the card.'],
        ['Take the card out and check', 'Open it again from Downloads with the card removed. That is the proof.']
      ]
    },
    'card>computer': {
      name: 'Card reader, then copy',
      steps: [
        ['Put the card in a reader', 'Most laptops need a USB adapter; some have a slot.'],
        ['Open the card', 'It appears as a drive. The library is the whole folder — app, media and the START-HERE file together.'],
        ['Copy the whole folder, not pieces', 'If you are duplicating the library, copy everything and keep every folder name exactly as it is. The app finds its files by path, so a renamed folder is a library that opens empty.'],
        ['Eject properly', 'Eject or Safely Remove before pulling the card out, or the copy can be silently incomplete.']
      ]
    },
    'computer>computer': {
      name: 'A USB drive, or LocalSend',
      steps: [
        ['With a drive', 'Copy the whole library folder onto a USB stick, plug it into the other computer, copy it off. Keep the folder structure intact.'],
        ['Over a network', 'LocalSend runs on Windows, Mac and Linux and moves files between them on one network with no account and no internet.'],
        ['Check the size matches', 'Compare the folder size on both machines before you call it done. A copy that stopped early looks finished until someone opens the missing half.']
      ]
    },
    'computer>card': {
      name: 'Write a new card',
      steps: [
        ['This is how a card is duplicated', 'Copying the library onto a fresh microSD card is how the library spreads without anyone posting anything.'],
        ['Format the new card first', 'Use a file system supported by the devices that will read the card. exFAT supports large files; FAT32 limits each file to under 4 GB. Formatting erases the card, so check it is the correct one.'],
        ['Copy everything', 'Copy the whole contents: START-HERE.html, the app folder, the media folder, README.txt. All of it, with the names unchanged.'],
        ['Test the new card before you hand it over', 'Put it in a phone and open START-HERE.html. Play one film and open one PDF. A card nobody tested is a card that fails in front of the person you gave it to.']
      ]
    }
  };

  // Same-family fallbacks for the pairs not spelled out above.
  var ALIAS = {
    'android>iphone': 'iphone>android',
    'iphone>computer': 'computer>iphone',
    'android>computer': 'computer>android',
    'iphone>card': 'card>iphone',
    'android>card': 'card>android',
    'card>card': 'computer>card'
  };

  var state = { from: '', to: '' };
  var scope = ET.libraryScope();
  var itemId = ET.qs('id');
  var item = itemId ? ET.byId(itemId) : null;
  if (scope && item && item.lang !== scope.lang) item = null;

  function routeId() {
    var k = state.from + '>' + state.to;
    return ROUTES[k] ? k : (ALIAS[k] || '');
  }

  function route() {
    return ROUTES[routeId()] || null;
  }

  function trackGuide() {
    var id = routeId();
    if (!id) return;
    // Mixed-method guides do not tell us which method the reader will use.
    var channel = id.indexOf('card') !== -1 ? 'sd_card'
      : id === 'computer>iphone' || id === 'computer>android' ? 'usb' : undefined;
    ET.analytics.track('share_intent', {
      channel: channel, status: 'guide_opened',
      resource: item ? item.id : undefined,
      language: item ? item.lang : scope ? scope.lang : undefined
    });
  }

  function pick(which, titleKey) {
    return '<div class="card"><h2 style="margin-bottom:.8rem">' + h(titleKey) + '</h2>' +
      '<div class="stack">' + DEVICES.map(function (d) {
        var on = state[which] === d.id;
        return '<button class="tile" data-pick="' + which + '" data-id="' + d.id + '" ' +
          'style="width:100%;text-align:start' +
          (on ? ';border-color:var(--purple);background:var(--purple-wash)' : '') + '">' +
          '<span class="ico">' + ET.icon(d.icon) + '</span>' +
          '<span><span class="t">' + h(d.key) + '</span></span>' +
          (on ? '<span class="chev">' + ET.icon('check') + '</span>' : '') +
          '</button>';
      }).join('') + '</div></div>';
  }

  function render() {
    var out = '';
    if (!state.from) { out += '<div>' + ET.art.share() + '</div>'; }

    if (item) {
      out += '<div class="note info"><strong class="latin">' + ET.esc(item.title) +
        '</strong><p style="margin:.2rem 0 0">' +
        tOrHTML('share.item', 'These steps are for sharing this item. They work for anything else on the card too.') +
        '</p></div>';
    }

    out += pick('from', 'share.from');
    if (state.from) out += pick('to', 'share.to');

    var R = route();
    if (state.from && state.to && R) {
      var routeKey = 'route.' + routeId().replace('>', '-');
      out += '<div class="card">' +
        '<span class="chip lang">' + h('share.result') + '</span>' +
        '<h2 style="margin:.6rem 0 1.2rem">' + tOrHTML(routeKey + '.name', R.name) + '</h2>' +
        '<ol class="steps">' + R.steps.map(function (s, i) {
          var key = routeKey + '.' + (i + 1);
          return '<li><h3>' + tOrHTML(key + '.h', s[0]) + '</h3>' +
                 '<p>' + tOrHTML(key + '.p', s[1]) + '</p></li>';
        }).join('') + '</ol></div>';

      out += '<div class="note"><strong>' + h('share.golden') + '</strong>' +
        '<p style="margin:.2rem 0 0">' + h('share.golden.body') + '</p></div>';

      out += '<div class="note good"><strong>' + h('share.teach') + '</strong>' +
        '<p style="margin:.2rem 0 0">' + h('share.teach.body') + '</p></div>';

      out += '<button class="btn ghost block" id="again">' +
        h('share.again') + '</button>';
    }

    ET.$('#wizard').innerHTML = out;

    ET.$$('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.getAttribute('data-pick');
        state[which] = b.getAttribute('data-id');
        if (which === 'from') state.to = '';
        if (which === 'to') trackGuide();
        render();
        // Scroll the next question into view rather than leaving it below the fold.
        var next = ET.$('[data-pick="to"]') || ET.$('.steps');
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    var again = ET.$('#again');
    if (again) again.addEventListener('click', function () {
      state.from = ''; state.to = ''; render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  ET.header('share');
  ET.tabbar();
  ET.$('#back-ico').innerHTML = ET.icon('back', 'flip');
  if (item) ET.$('#back').href = ET.scopedUrl('item.html', { id: item.id });
  else if (ET.libraryScope()) ET.$('#back').href = ET.scopeEntryUrl();
  render();
  ET.i18n.apply();
  ET.i18n.onChange(render);
})(window.ET);
