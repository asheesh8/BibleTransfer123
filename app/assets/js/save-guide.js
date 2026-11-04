/* Local screenshot guide: classic script so it also works from a card. */
window.ET.module('save-guide', ['core', 'i18n'], function (ET) {
  'use strict';
  var t = ET.i18n.t;
  /* Slides by their original source number, so old links (#step-12) still
     land on the same step. Words come from the interface tables (sg.*), so the
     guide reads in the reader's language. Pictures hold no words of their own:
     website steps are screenshots of this site in each interface language
     (assets/save-guide/<code>/), computer steps are shared screenshots. */
  var SLIDES = {
    2: { key: 's2', pic: 's02', src: 'web', section: 2 },
    3: { key: 's3', pic: 's03', src: 'web', section: 2 },
    4: { key: 's4', pic: 's04', src: 'web', section: 2 },
    5: { key: 's5', pic: 's05', src: 'web', section: 2 },
    6: { key: 's6', pic: 's06', src: 'web', section: 2 },
    7: { key: 's7', pic: 's07', src: 'web', section: 2 },
    8: { key: 's8', pic: 'mac-finder', src: 'mac', section: 8 },
    9: { key: 's9', pic: 'mac-preview', src: 'mac', section: 8 },
    10: { key: 's10', pic: 'win-edge', src: 'win', section: 10 },
    11: { key: 's11', pic: 'win-explorer', src: 'win', section: 10 },
    12: { key: 's12', pic: 's12', src: 'web', section: 12 },
    13: { key: 's13', pic: 's13', src: 'web', section: 12 }
  };
  var COUNT = 14;
  var PLATFORM = {
    macos: { label: 'macOS', heading: 'sg.mac.heading', osStart: 8, sources: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14],
      disclose: 'sg.disclose.mac', cover: 'sg.cover.hint.mac', zip: 'mac' },
    windows: { label: 'Windows', heading: 'sg.win.heading', osStart: 10, sources: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14],
      disclose: 'sg.disclose.win', cover: 'sg.cover.hint.win', zip: 'win' }
  };
  // Which interface languages have their own website screenshots; others use English.
  var SHOTS = /*shots*/{"ak": "Twerɛ Kronkron", "am": "የአማርኛ አዲስ ኪዳን — 1962", "ar": "الكتاب المقدس، ترجمة فان دايك", "cmn": "iBible - The Salvation Story", "en": "World English Bible", "es": "Reina Valera 1909", "fr": "Bible Louis Segond — 1910", "guz": "JESUS", "ha": "Littafi Mai Tsarki — Door Version", "hi": "सरल हिन्दी बाइबल", "ht": "Sent Bib", "ig": "Agba Ọhụrụ n’ụda — Ehugbo", "kik": "Kiugo Gĩtheru Kĩa Ngai Kĩhingũre", "lg": "Open Luganda Contemporary Bible", "ln": "Mokanda na Bomoi — Biblia mobimba", "luo": "Ochiw Thuolo Motingʼo Loko Manyien", "mas": "JESUS", "mg": "Ny Baiboly — dikan-teny protestanta", "mr": "मराठी बायबल", "ne": "येशू", "ny": "Tsekulani Mawu a Mulungu mu Chichewa Chalero", "om": "Kitaaba Qulqulluu — Hiikkaa Ammayyaa Banamaa Haaraa — Dhihaa fi Giddugaleessaa", "pa": "ਪਵਿੱਤਰ ਬਾਈਬਲ", "pcm": "Holy Bible for Naija Pidgin — DBS 2012 edition", "pnb": "ਪੰਜਾਬੀ ਬਾਈਬਲ 1945", "ps": "JESUS", "pt": "Nova Almeida Atualizada — Bíblia em áudio", "rn": "Bibiliya Yera: Isezerano Rishasha", "rw": "Yesu (Kinyamulenge)", "sn": "Bhaibheri muchiShona", "snd": "JESUS", "swh": "Kiswahili Biblia Takatifu", "te": "తెలుగు బైబిల్ (ఇండియన్ రివైజ్డ్ వెర్షన్)", "ti": "መጽሓፍ ቅዱስ: ሓድሽ ኪዳን", "tl": "Ang Dating Biblia", "ur": "JESUS", "xh": "UYesu", "yo": "Bíbélì Mímọ́ ní Èdè Yorùbá Òde-Òní", "yue": "Studium Biblicum Version 1999"}/*/shots*/;
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
    return n >= 1 && n <= COUNT ? n : 1;
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
  function shotLang() {
    var code = ET.i18n.current();
    return Object.prototype.hasOwnProperty.call(SHOTS, code) ? code : 'en';
  }
  // One slide's words and picture, in the current language.
  function build(n) {
    var config = PLATFORM[platform];
    var vars = {
      title: SHOTS[shotLang()], save: t('item.save'), downloads: t('save.default'),
      bulk: t('lib.bulk.start'), selectall: t('lib.bulk.selectall')
    };
    var slide;
    if (n === 1) {
      slide = { title: t(config.heading), label: config.label.toUpperCase(), body: t('sg.cover.body'),
        hint: t(config.cover), pic: 'shared/cover', source: t('sg.src.text'), section: 1 };
    } else if (n === COUNT) {
      slide = { title: t('sg.zip.' + config.zip + '.title'), label: t('sg.zip.label'), body: t('sg.zip.' + config.zip + '.body'),
        hint: t('sg.zip.hint'), pic: 'shared/zip-' + config.zip, source: t('sg.src.text'), section: 14 };
    } else {
      var s = SLIDES[n], k = 'sg.' + s.key + '.';
      slide = { title: t(k + 'title', vars), label: t(k + 'label', vars), body: t(k + 'body', vars), hint: t(k + 'hint', vars),
        pic: s.src === 'web' ? shotLang() + '/' + s.pic : 'shared/' + s.pic, source: t('sg.src.' + s.src), section: s.section };
    }
    slide.alt = t('sg.alt', { title: slide.title });
    return slide;
  }
  function slideUrl(slide) {
    return 'assets/save-guide/' + slide.pic + '.webp';
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
    var src = slideUrl(slide);
    imageError.hidden = true;
    image.alt = slide.alt;
    image.src = src;
    document.getElementById('guide-image-link').href = src;
    document.getElementById('guide-title').textContent = slide.title;
    document.getElementById('guide-label').textContent = slide.label;
    document.getElementById('guide-body').textContent = slide.body;
    document.getElementById('guide-hint').textContent = slide.hint || '';
    document.getElementById('guide-source').textContent = slide.source;
    var counter = t('sg.counter', { os: PLATFORM[platform].label, n: index + 1, total: path.length });
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
    path = config.sources.map(build);
    document.getElementById('guide-choice').hidden = true;
    document.getElementById('guide-path').hidden = false;
    document.getElementById('guide-heading').textContent = t(config.heading);
    document.getElementById('guide-intro').textContent = t('sg.path.intro');
    document.getElementById('guide-skip').href = '#guide-viewer';
    document.getElementById('guide-platform-disclosure').textContent = t(config.disclose);
    viewer.setAttribute('aria-label', t('sg.viewer.aria', { os: config.label }));
    document.title = t(config.heading) + ' — ' + t('app.name');
    var osLink = document.getElementById('guide-os-link');
    osLink.setAttribute('data-guide-step', String(config.osStart));
    osLink.href = '#step-' + config.osStart;
    osLink.textContent = t('sg.nav.os', { os: config.label });
    platformButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-guide-platform') === platform));
    });
    picker.innerHTML = path.map(function (slide, i) {
      return '<option value="' + (i + 1) + '">' + (i + 1) + '. ' + ET.esc(slide.title.replace(/^\d+\.\s*/, '')) + '</option>';
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
      catch (e) { status.textContent = t('sg.fullscreen.fail'); return; }
      if (promise && promise.catch) promise.catch(function () {
        status.textContent = t('sg.fullscreen.fail');
      });
    });
    document.addEventListener('fullscreenchange', function () {
      var active = document.fullscreenElement === viewer;
      fullscreen.textContent = t(active ? 'sg.fullscreen.exit' : 'sg.fullscreen');
      fullscreen.setAttribute('aria-pressed', String(active));
    });
  }

  var back = document.getElementById('guide-back');
  var scope = ET.libraryScope();
  var resource = ET.byId(ET.qs('id'));
  var backToItem = !!(resource && (!scope || resource.lang === scope.lang));
  if (backToItem) {
    back.removeAttribute('data-i18n');
    back.href = ET.scopedUrl('item.html', { id: resource.id });
    back.textContent = t('sg.backto', { title: ET.displayTitle(resource) });
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
  ET.i18n.apply();
  ET.theme();
  var initialSource = sourceFromHash();
  var initialPlatform = platformFromUrl() || platformForSource(initialSource);
  if (initialPlatform) choosePlatform(initialPlatform, initialSource, false);

  // A language switch from the header redraws the open slide in the new language.
  ET.i18n.onChange(function () {
    if (backToItem) back.textContent = t('sg.backto', { title: ET.displayTitle(resource) });
    if (platform) { var at = PLATFORM[platform].sources[index]; choosePlatform(platform, at, false); }
  });
});
