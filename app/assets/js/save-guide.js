/* Local screenshot guide: classic script so it also works from a card. */
(function (ET) {
  'use strict';
  var SLIDES = [
  {
    "index": 1,
    "title": "Save to your computer",
    "label": "MAC + WINDOWS",
    "body": "Choose it. Save it. Open it.",
    "hint": "Start with the website steps, then follow your computer’s section.",
    "alt": "Guide introduction: choose, save, and open a file on Mac or Windows.",
    "section": 2,
    "source": "Screenshot guide for Mac and Windows"
  },
  {
    "title": "1. Choose what you want to save",
    "label": "START ON THE WEBSITE",
    "body": "Click the book, film, or audio you want.\n\nWe’ll use World English Bible as the example.",
    "hint": "The same steps work for other available resources.",
    "index": 2,
    "alt": "Library resource cards with World English Bible circled.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "2. Click the green save button",
    "label": "ON THE RESOURCE PAGE",
    "body": "Scroll to the buttons.\n\nClick “Save to my phone”.",
    "hint": "That button also saves to your computer.",
    "index": 3,
    "alt": "Resource page with the green Save to my phone button circled.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "3. Choose the file format",
    "label": "FOR THIS BOOK",
    "body": "Choose PDF to read or print the book.\n\nEPUB is for a compatible ebook reader.",
    "hint": "If there is only one format, this step may be skipped.",
    "index": 4,
    "alt": "File format chooser with PDF circled; EPUB is also available.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "4. Choose where to save it",
    "label": "THE EASIEST CHOICE",
    "body": "Click “Save to Downloads”.\n\nYou’ll find the file in your Downloads folder.",
    "hint": "Your browser may ask where to save, or use a different download folder. Its download list shows the saved location.",
    "index": 5,
    "alt": "Save location chooser with Save to Downloads circled.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "5. Let the download finish",
    "label": "WHILE IT IS SAVING",
    "body": "Keep this tab open.\n\nWait for the saving step to finish before opening the file.",
    "hint": "Large films take longer. Stay connected while downloading.",
    "index": 6,
    "alt": "Saving dialog with the current saving step circled.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "The “Saved” screen is your next cue",
    "label": "USING SAVE TO DOWNLOADS?",
    "body": "The website has finished its step.\n\nAlso check that your browser’s download has finished.",
    "hint": "A chosen folder may bypass the browser download list.",
    "index": 7,
    "alt": "Saved dialog after the website has completed its saving step.",
    "section": 2,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "Mac: find the saved file in Finder",
    "label": "OPEN YOUR SAVE LOCATION",
    "body": "Open Finder.\n\nClick Downloads if you used “Save to Downloads”.\n\nOr open the folder you chose.",
    "hint": "This example file is shown in a folder named Bible Library.",
    "index": 8,
    "alt": "Actual Mac Finder screenshot with Downloads and the example saved PDF circled; the file is in Bible Library.",
    "section": 8,
    "source": "Actual Mac screenshot · Example shown in Bible Library"
  },
  {
    "title": "Mac: open the PDF",
    "label": "DOUBLE-CLICK YOUR FILE",
    "body": "Double-click the saved PDF.\n\nIt opens in your default PDF app — Preview on this Mac.",
    "hint": "Once saved, this PDF can be read without internet.",
    "index": 9,
    "alt": "Actual Mac Preview screenshot showing the downloaded World English Bible PDF.",
    "section": 8,
    "source": "Actual Mac screenshot · The downloaded PDF opens in Preview"
  },
  {
    "title": "Windows: check the browser download",
    "label": "EXAMPLE IN MICROSOFT EDGE",
    "body": "Wait until the file finishes downloading.\n\nClick “Show in folder” to jump to the saved file.",
    "hint": "Use the browser’s Downloads button to see recent downloads.",
    "index": 10,
    "alt": "Recreated Windows Edge example with the Downloads button and Show in folder circled.",
    "section": 10,
    "source": "Windows example (recreated) · Browser appearance may vary"
  },
  {
    "title": "Windows: open your file",
    "label": "IN FILE EXPLORER",
    "body": "Open Downloads in File Explorer.\n\nDouble-click the PDF to open it in your default PDF app.",
    "hint": "If you chose another folder, look there instead.",
    "index": 11,
    "alt": "Recreated Windows File Explorer example with Downloads and the saved PDF circled.",
    "section": 10,
    "source": "Windows example (recreated) · A PDF saved in Downloads"
  },
  {
    "title": "Want to save several items?",
    "label": "OPEN THE LIBRARY",
    "body": "Choose your language and any filters.\n\nClick “Download several things”.",
    "hint": "This saves selected resources to your computer.",
    "index": 12,
    "alt": "Library page with the Download several things button circled.",
    "section": 12,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "title": "Select your items, then download",
    "label": "CHOOSE YOUR ITEMS",
    "body": "Select the items you want.\n\nClick “Download selected”.\n\nThen choose where to save them.",
    "hint": "“Select all shown” selects the current filtered results. Your browser may ask you to allow multiple downloads.",
    "index": 13,
    "alt": "Library selection screen with selection controls and Download selected button circled.",
    "section": 12,
    "source": "Actual website screenshot · The same website steps work on Mac and Windows"
  },
  {
    "index": 14,
    "title": "If your download is a ZIP file",
    "body": "Mac: double-click the ZIP, then open the new folder. Windows: right-click the ZIP, choose Extract All, then Extract.",
    "hint": "Leave enough space for both the ZIP and its extracted files. Open files from the extracted folder.",
    "alt": "ZIP instructions: on Mac, double-click; on Windows, choose Extract All, then Extract.",
    "section": 14,
    "source": "ZIP instructions for Mac and Windows"
  }
];
  var PLATFORM = {
    macos: {
      label: 'macOS', heading: 'Save to your Mac', osStart: 8, sources: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14],
      cover: { title: 'Save to your Mac', label: 'MACOS GUIDE', body: 'Choose it. Save it. Open it.', hint: 'Follow the website steps, then find your file in Finder.', alt: 'macOS guide introduction: choose, save, and open a file on your Mac.', source: 'Screenshot guide for macOS', section: 1 },
      zip: { title: 'macOS: open a ZIP file', label: 'IF YOUR DOWNLOAD IS A ZIP', body: 'Double-click the ZIP.\n\nOpen the new folder, then open the files inside.', hint: 'Leave enough space for both the ZIP and its extracted files.', alt: 'macOS ZIP instructions: double-click the ZIP, then open the new folder and its files.', source: 'ZIP instructions for macOS', section: 14 }
    },
    windows: {
      label: 'Windows', heading: 'Save to your Windows computer', osStart: 10, sources: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14],
      cover: { title: 'Save to your Windows computer', label: 'WINDOWS GUIDE', body: 'Choose it. Save it. Open it.', hint: 'Follow the website steps, then find your file in File Explorer.', alt: 'Windows guide introduction: choose, save, and open a file on your PC.', source: 'Screenshot guide for Windows', section: 1 },
      zip: { title: 'Windows: open a ZIP file', label: 'IF YOUR DOWNLOAD IS A ZIP', body: 'Right-click the ZIP.\nChoose “Extract All”, then “Extract”.\n\nOpen the extracted folder.', hint: 'Leave enough space for both the ZIP and its extracted files.', alt: 'Windows ZIP instructions: right-click the ZIP, choose Extract All, then Extract, and open the extracted folder.', source: 'ZIP instructions for Windows', section: 14 }
    }
  };
  var platform = '';
  var path = [];
  var index = 0;
  var viewer = document.getElementById('guide-viewer');
  var image = document.getElementById('guide-image');
  var prev = document.getElementById('guide-prev');
  var next = document.getElementById('guide-next');
  var picker = document.getElementById('guide-step');
  var fullscreen = document.getElementById('guide-fullscreen');
  var status = document.getElementById('guide-status');
  var imageError = document.getElementById('guide-image-error');
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('[data-guide-step]'));
  var platformButtons = Array.prototype.slice.call(document.querySelectorAll('[data-guide-platform]'));

  // Hash step numbers retain the original source slide number, so older
  // library links (#step-12) still land on "several items" after a choice.
  function sourceFromHash() {
    var match = /^#step-(\d{1,2})$/.exec(location.hash);
    var n = match ? Number(match[1]) : 1;
    return n >= 1 && n <= SLIDES.length ? n : 1;
  }
  function platformFromUrl() {
    var value;
    try { value = new URLSearchParams(location.search).get('platform'); } catch (e) { return ''; }
    return value === 'macos' || value === 'windows' ? value : '';
  }
  function platformForSource(n) {
    return n === 8 || n === 9 ? 'macos' : n === 10 || n === 11 ? 'windows' : '';
  }
  function pathIndexForSource(n) {
    var found = PLATFORM[platform].sources.indexOf(n);
    if (found !== -1) return found;
    // An explicit platform always wins over a conflicting legacy OS hash.
    // Switching computers keeps the equivalent find/open step when possible.
    return n === 9 || n === 11 ? 8 : n === 8 || n === 10 ? 7 : 0;
  }
  function slideUrl(i) {
    return 'assets/save-guide/' + platform + '/slide-' + ('0' + (i + 1)).slice(-2) + '.webp';
  }
  function updateUrl() {
    try {
      var params = new URLSearchParams(location.search);
      params.set('platform', platform);
      history.replaceState(null, '', location.pathname + '?' + params.toString() + '#step-' + PLATFORM[platform].sources[index]);
    } catch (e) { /* A card's file:// browser may refuse history updates. */ }
  }
  function show(i, updateHash) {
    if (!platform) return;
    index = Math.max(0, Math.min(path.length - 1, isFinite(i) ? i : 0));
    var slide = path[index];
    var src = slideUrl(index);
    imageError.hidden = true;
    image.alt = slide.alt;
    image.src = src;
    document.getElementById('guide-image-link').href = src;
    document.getElementById('guide-title').textContent = slide.title;
    document.getElementById('guide-label').textContent = slide.label || PLATFORM[platform].label.toUpperCase();
    document.getElementById('guide-body').textContent = slide.body;
    document.getElementById('guide-hint').textContent = slide.hint || '';
    document.getElementById('guide-source').textContent = slide.source;
    var counter = PLATFORM[platform].label + ' · Slide ' + (index + 1) + ' of ' + path.length;
    document.getElementById('guide-counter').textContent = counter;
    status.textContent = counter + '. ' + slide.title;
    prev.disabled = index === 0;
    next.disabled = index === path.length - 1;
    picker.value = String(index + 1);
    sectionLinks.forEach(function (link) {
      if (Number(link.getAttribute('data-guide-step')) === slide.section) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    if (updateHash) updateUrl();
  }
  function choosePlatform(value, source, focus) {
    if (value !== 'macos' && value !== 'windows') return;
    platform = value;
    var config = PLATFORM[platform];
    path = config.sources.map(function (n) {
      if (n === 1) return config.cover;
      if (n === 14) return config.zip;
      var original = SLIDES[n - 1], copy = {}, key;
      for (key in original) if (Object.prototype.hasOwnProperty.call(original, key)) copy[key] = original[key];
      if (n >= 2 && n <= 7 || n === 12 || n === 13) copy.source = 'Actual website screenshot · ' + config.label + ' guide';
      return copy;
    });
    document.getElementById('guide-choice').hidden = true;
    document.getElementById('guide-path').hidden = false;
    document.getElementById('guide-heading').textContent = config.heading;
    document.getElementById('guide-intro').textContent = 'Follow the pictures and gold circles. Press Next when you are ready.';
    document.getElementById('guide-skip').href = '#guide-viewer';
    document.getElementById('guide-platform-disclosure').textContent = platform === 'windows'
      ? 'Windows browser and File Explorer views are labeled recreated examples.'
      : 'Mac Finder and Preview views use actual screenshots.';
    viewer.setAttribute('aria-label', config.label + ' save guide slideshow');
    document.title = config.heading + ' — The Library';
    var osLink = document.getElementById('guide-os-link');
    osLink.setAttribute('data-guide-step', String(config.osStart));
    osLink.href = '#step-' + config.osStart;
    osLink.textContent = 'Find and open on ' + config.label;
    platformButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-guide-platform') === platform));
    });
    picker.innerHTML = path.map(function (slide, i) {
      return '<option value="' + (i + 1) + '">' + (i + 1) + '. ' + ET.esc(slide.title) + '</option>';
    }).join('');
    show(pathIndexForSource(source), true);
    if (focus) viewer.focus();
  }

  platformButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var source = platform ? PLATFORM[platform].sources[index] : sourceFromHash();
      choosePlatform(button.getAttribute('data-guide-platform'), source, true);
    });
  });
  picker.addEventListener('change', function () { show(Number(picker.value) - 1, true); });
  prev.addEventListener('click', function () { show(index - 1, true); });
  next.addEventListener('click', function () { show(index + 1, true); });
  sectionLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      if (!platform) return;
      show(pathIndexForSource(Number(link.getAttribute('data-guide-step'))), true);
      viewer.focus();
    });
  });
  window.addEventListener('hashchange', function () {
    if (!/^#step-\d{1,2}$/.test(location.hash)) return;
    var source = sourceFromHash();
    if (platform) show(pathIndexForSource(source), false);
    else {
      var legacyPlatform = platformForSource(source);
      if (legacyPlatform) choosePlatform(legacyPlatform, source, false);
    }
  });
  document.addEventListener('keydown', function (event) {
    var target = event.target;
    if (!platform || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) ||
        document.querySelector('[role="dialog"]:not([hidden]), .welcome')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1), true);
    }
  });
  image.addEventListener('error', function () { imageError.hidden = false; });
  image.addEventListener('load', function () { imageError.hidden = true; });

  if (viewer.requestFullscreen && document.fullscreenEnabled) {
    fullscreen.hidden = false;
    fullscreen.addEventListener('click', function () {
      var promise;
      try { promise = document.fullscreenElement ? document.exitFullscreen() : viewer.requestFullscreen(); }
      catch (e) { status.textContent = 'Full screen is unavailable. Use Open full-size slide instead.'; return; }
      if (promise && promise.catch) promise.catch(function () {
        status.textContent = 'Full screen is unavailable. Use Open full-size slide instead.';
      });
    });
    document.addEventListener('fullscreenchange', function () {
      var active = document.fullscreenElement === viewer;
      fullscreen.textContent = active ? 'Exit full screen' : 'Full screen';
      fullscreen.setAttribute('aria-pressed', String(active));
    });
  }

  var back = document.getElementById('guide-back');
  var scope = ET.libraryScope();
  var resource = ET.byId(ET.qs('id'));
  if (resource && (!scope || resource.lang === scope.lang)) {
    back.href = ET.scopedUrl('item.html', { id: resource.id });
    back.textContent = '← Back to ' + ET.displayTitle(resource);
  } else back.href = ET.scopeEntryUrl();
  document.getElementById('guide-home').href = scope ? ET.scopeEntryUrl() : 'index.html';
  document.getElementById('guide-help').href = ET.scopedUrl('help.html');
  ['apple', 'samsung', 'android'].forEach(function (device) {
    var link = document.getElementById('guide-phone-' + device);
    if (link) link.href = ET.scopedUrl('help.html') + '#phone-' + device;
  });
  document.getElementById('guide-theme').addEventListener('click', function () {
    var explicit = document.documentElement.getAttribute('data-theme');
    var light = explicit === 'light' || (!explicit && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    ET.theme(light ? 'dark' : 'light');
  });
  ET.theme();
  var initialSource = sourceFromHash();
  var initialPlatform = platformFromUrl() || platformForSource(initialSource);
  if (initialPlatform) choosePlatform(initialPlatform, initialSource, false);
})(window.ET);
