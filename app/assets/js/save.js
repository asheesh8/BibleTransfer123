/* ============================================================================
   Saving, step by step, without leaving the page.

     1  What    — which file (skipped when there is only one)
     2  Where   — a folder you pick, a name and place you pick, or Downloads
     3  Saving  — a real progress bar, bytes and all, with a Stop button
     4  Done    — where it went, open it now, or send it to a phone nearby

   "Where" uses the File System Access API when the browser has it (Chrome and
   Edge on computers): the reader chooses a real folder, the app writes straight
   into it, and remembers that folder for next time. Browsers without it — iOS
   Safari, most Android — fall back to the Downloads folder, and step 4 says so
   in words rather than leaving anyone to guess where the file went.

   Files are fetched in the page so the progress is real. DBS serves every CDN
   with `access-control-allow-origin: *`, so this works on the web edition as
   well as off a card. Very large files on a fallback browser are the one
   exception: holding 2 GB in a phone's memory to hand it over as a blob would
   crash the tab, so those go to the browser's own download manager instead.
   ========================================================================= */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;

  var CAN_DIR = typeof window.showDirectoryPicker === 'function';
  var CAN_FILE = typeof window.showSaveFilePicker === 'function';
  var BIG = 400 * 1024 * 1024;

  // ---------------------------------------------------- remembered folder
  // A FileSystemDirectoryHandle can be stored in IndexedDB and reused, so the
  // second save is one tap. Anything failing here just means "no memory".
  function db(fn) {
    try {
      var req = indexedDB.open('easytransfer', 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { fn(req.result); };
      req.onerror = function () { fn(null); };
    } catch (e) { fn(null); }
  }
  function remember(handle) {
    db(function (d) {
      if (!d) return;
      try { d.transaction('kv', 'readwrite').objectStore('kv').put(handle, 'folder'); } catch (e) {}
    });
  }
  function recall(cb) {
    if (!CAN_DIR) return cb(null);
    db(function (d) {
      if (!d) return cb(null);
      try {
        var g = d.transaction('kv').objectStore('kv').get('folder');
        g.onsuccess = function () { cb(g.result || null); };
        g.onerror = function () { cb(null); };
      } catch (e) { cb(null); }
    });
  }

  // ----------------------------------------------------------- filenames
  // Characters no filesystem on the other end will accept, plus control codes.
  var BAD = new RegExp('[\\\\/:*?"<>|' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + ']', 'g');
  function clean(s) {
    return String(s).replace(BAD, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
  }
  function extOf(url) {
    var m = /\.([a-z0-9]{2,5})(?:$|[?#])/i.exec(String(url).split('/').pop() || '');
    return m ? '.' + m[1].toLowerCase() : '';
  }
  function nameFor(r, f) {
    var tail = '';
    try { tail = decodeURIComponent((f.file || '').split('?')[0].split('/').pop() || ''); }
    catch (e) { tail = (f.file || '').split('/').pop(); }
    // A readable name beats a CDN filename full of underscores and codes.
    var label = /^(PDF|EPUB|Read|Audio \(MP3\))$/i.test(f.label) ? '' : ' - ' + f.label;
    return clean(r.title + label) + (extOf(tail) || '');
  }

  /* One save can be several files: "All 61 chapters" is 61 downloads. */
  function jobsFor(r, f) {
    if (f.chapters && r.play && r.play.items) {
      return r.play.items.map(function (c) {
        return { url: c.file, bytes: 0,
                 name: ET.pad(c.n) + ' - ' + clean(c.title) + (extOf(c.file) || '.mp4') };
      });
    }
    return [{ url: f.file, bytes: f.bytes || 0, name: nameFor(r, f) }];
  }

  // ---------------------------------------------------------------- the sheet
  var STEPS = ['save.step.what', 'save.step.where', 'save.step.go', 'save.step.done'];

  function header(step) {
    return ET.stepper(STEPS.length, step) +
      '<h2>' + h(STEPS[step]) + '</h2>';
  }

  function sizeOf(f) { return f.bytes ? '<span class="num">' + ET.human(f.bytes) + '</span>' : ''; }

  function open(r, preselect) {
    var S = { file: null, jobs: null, target: null, ctrl: null, done: [], blobUrl: null };
    var sheet = ET.sheet('<div id="save-flow"></div>');
    var root = ET.$('#save-flow', sheet.el);

    // Leaving mid-download must actually stop it.
    var close = sheet.close;
    sheet.close = function () {
      if (S.ctrl) S.ctrl.abort();
      if (S.blobUrl) URL.revokeObjectURL(S.blobUrl);
      close();
    };

    function paint(html) { root.innerHTML = html; }

    // ---- 1. what
    function what() {
      var files = (r.files || []).filter(function (f) { return f.file || f.chapters; });
      if (preselect != null && files[preselect]) { S.file = files[preselect]; return where(); }
      if (files.length === 1) { S.file = files[0]; return where(); }
      paint(header(0) + '<div class="stack">' + files.map(function (f, i) {
        var label = f.chapters ? ET.i18n.t('save.allchapters', { n: r.play.items.length }) : f.label;
        return '<button class="tile" data-i="' + i + '" style="width:100%;text-align:start">' +
          '<span class="ico">' + ET.icon(f.chapters ? 'folder' : 'save') + '</span>' +
          '<span><span class="t" dir="auto">' + ET.esc(label) + '</span>' +
          '<span class="s">' + sizeOf(f) + '</span></span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
      }).join('') + '</div>' +
        '<button class="btn ghost block" id="sv-x" style="margin-top:1rem">' + h('ui.cancel') + '</button>');
      ET.$$('[data-i]', root).forEach(function (b) {
        b.addEventListener('click', function () { S.file = files[+b.getAttribute('data-i')]; where(); });
      });
      ET.$('#sv-x', root).addEventListener('click', sheet.close);
    }

    // ---- 2. where
    function where() {
      S.jobs = jobsFor(r, S.file);
      var many = S.jobs.length > 1;
      recall(function (saved) {
        var opts = [];
        if (saved) opts.push(['again', 'folder', t('save.folder.again', { name: saved.name }), '']);
        if (CAN_DIR) opts.push(['dir', 'folder', t('save.folder'), t('save.folder.sub')]);
        if (CAN_FILE && !many) opts.push(['file', 'save', t('save.as'), t('save.as.sub')]);
        opts.push(['downloads', 'save', t('save.default'), t('save.default.sub')]);

        var total = S.jobs.reduce(function (a, j) { return a + (j.bytes || 0); }, 0) || S.file.bytes;
        paint(header(1) +
          '<div class="note info" style="margin-bottom:1rem"><strong class="latin">' +
          ET.esc(r.title) + ' — ' + ET.esc(S.file.label) + '</strong>' +
          (total ? '<span class="num">' + ET.human(total) + '</span>' : '') + '</div>' +
          '<div class="stack">' + opts.map(function (o) {
            return '<button class="tile" data-w="' + o[0] + '" style="width:100%;text-align:start">' +
              '<span class="ico">' + ET.icon(o[1]) + '</span>' +
              '<span><span class="t">' + ET.esc(o[2]) + '</span>' +
              (o[3] ? '<span class="s">' + ET.esc(o[3]) + '</span>' : '') + '</span>' +
              '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
          }).join('') + '</div>' +
          '<button class="btn ghost block" id="sv-back" style="margin-top:1rem">' +
          ET.icon('back', 'flip') + h('save.back') + '</button>');

        ET.$$('[data-w]', root).forEach(function (b) {
          b.addEventListener('click', function () { choose(b.getAttribute('data-w'), saved); });
        });
        ET.$('#sv-back', root).addEventListener('click', function () { preselect = null; what(); });
      });
    }

    function choose(kind, saved) {
      // The pickers must be called straight from the tap, or the browser
      // refuses them as not user-initiated — so nothing is awaited first.
      if (kind === 'again' && saved) {
        var ask = saved.requestPermission ? saved.requestPermission({ mode: 'readwrite' })
                                          : Promise.resolve('granted');
        ask.then(function (p) {
          if (p !== 'granted') return where();
          S.target = { kind: 'dir', handle: saved, name: saved.name };
          go();
        }, function () { where(); });
      } else if (kind === 'dir') {
        window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' }).then(function (d) {
          remember(d);
          S.target = { kind: 'dir', handle: d, name: d.name };
          go();
        }, function () { /* picker cancelled — stay on this step */ });
      } else if (kind === 'file') {
        window.showSaveFilePicker({ suggestedName: S.jobs[0].name, startIn: 'downloads' })
          .then(function (fh) { S.target = { kind: 'file', handle: fh, name: fh.name }; go(); },
                function () {});
      } else {
        S.target = { kind: 'downloads', name: t('save.done.downloads') };
        go();
      }
    }

    // ---- 3. saving
    function go() {
      S.ctrl = new AbortController();
      S.done = [];
      paint(header(2) +
        '<p class="latin" id="sv-name" style="font-weight:700;margin:0 0 .6rem"></p>' +
        '<div class="meter"><span id="sv-bar"></span></div>' +
        '<p class="muted" id="sv-count" style="margin:.6rem 0 0"></p>' +
        '<p class="muted" id="sv-files" style="margin:.2rem 0 0"></p>' +
        '<button class="btn ghost block" id="sv-stop" style="margin-top:1.2rem">' +
        h('save.stop') + '</button>');
      ET.$('#sv-stop', root).addEventListener('click', function () { S.ctrl.abort(); where(); });

      var i = 0;
      (function next() {
        if (i >= S.jobs.length) return finished();
        var job = S.jobs[i];
        var nm = ET.$('#sv-name', root);
        if (!nm) return;
        nm.textContent = job.name;
        ET.$('#sv-files', root).innerHTML = S.jobs.length > 1
          ? h('save.files', { n: i + 1, total: S.jobs.length }) : '';
        saveOne(job, S.target, S.ctrl.signal, progress).then(function (res) {
          S.done.push(res);
          i += 1;
          next();
        }, function (err) {
          if (err && err.name === 'AbortError') return;
          failed(err);
        });
      })();
    }

    function progress(got, total) {
      var bar = ET.$('#sv-bar', root), count = ET.$('#sv-count', root);
      if (!bar) return;
      if (total) {
        bar.classList.remove('busy');
        bar.style.width = Math.min(100, 100 * got / total).toFixed(1) + '%';
        count.innerHTML = '<span class="num">' + ET.human(got) + ' / ' + ET.human(total) + '</span>';
      } else {
        bar.classList.add('busy');
        count.innerHTML = '<span class="num">' + ET.human(got) + '</span>';
      }
    }

    // ---- 4. done
    function finished() {
      S.ctrl = null;
      var last = S.done[S.done.length - 1] || {};
      var openBtn = '';
      if (last.blob && ET.openable(S.jobs[S.jobs.length - 1].name)) {
        S.blobUrl = URL.createObjectURL(last.blob);
        openBtn = '<a class="btn green block" target="_blank" rel="noopener" href="' + S.blobUrl + '">' +
          ET.icon('play') + h('save.open') + '</a>';
      } else if (last.handle && last.handle.getFile) {
        openBtn = '<button class="btn green block" id="sv-open">' + ET.icon('play') + h('save.open') + '</button>';
      } else if (last.url) {
        openBtn = '<a class="btn green block" target="_blank" rel="noopener" href="' + ET.esc(last.url) + '">' +
          ET.icon('play') + h('save.open') + '</a>';
      }
      var place = S.target.kind === 'downloads' ? t('save.done.downloads') : S.target.name;
      paint(header(3) +
        '<div class="done-mark">' + ET.icon('check') + '</div>' +
        '<h3 class="center" style="margin:.2rem 0">' + h('save.done.title') + '</h3>' +
        '<p class="center muted">' + ET.esc(t('save.done.where', { place: place })) + '</p>' +
        (S.target.kind === 'downloads' ? '<p class="center muted" style="font-size:.9rem">' +
          h('save.android') + '<br>' + h('save.ios') + '</p>' : '') +
        '<div class="stack" style="margin-top:1rem">' + openBtn +
        '<a class="btn sky block" href="nearby.html?id=' + encodeURIComponent(r.id) + '">' +
        ET.icon('wifi') + h('save.next') + '</a>' +
        '<button class="btn ghost block" id="sv-more">' + h('save.another') + '</button></div>');

      var ob = ET.$('#sv-open', root);
      if (ob) ob.addEventListener('click', function () {
        last.handle.getFile().then(function (file) { window.open(URL.createObjectURL(file), '_blank'); });
      });
      ET.$('#sv-more', root).addEventListener('click', function () { preselect = null; what(); });
    }

    function failed(err) {
      paint(header(2) + '<div class="note"><strong>' + h('save.fail') + '</strong>' +
        '<p class="latin" style="margin:.3rem 0 0">' + ET.esc((err && err.message) || '') + '</p></div>' +
        '<div class="stack" style="margin-top:1rem">' +
        '<button class="btn block" id="sv-retry">' + h('save.retry') + '</button>' +
        '<button class="btn ghost block" id="sv-back">' + ET.icon('back', 'flip') + h('save.back') +
        '</button></div>');
      ET.$('#sv-retry', root).addEventListener('click', go);
      ET.$('#sv-back', root).addEventListener('click', where);
    }

    what();
    return sheet;
  }

  // ------------------------------------------------------- several resources
  /* A resource can offer a preview file, dozens of chapters, and one complete
     ZIP. Batch saving chooses the complete package with the fewest taps. Text
     keeps its PDF; films and audio prefer a compact ZIP, then a complete video,
     then all chapters. The regular one-item flow still lets a person choose any
     alternate format or quality. */
  function preferredFile(r) {
    var files = (r.files || []).filter(function (f) { return f.file || f.chapters; });
    if (!files.length) return null;
    if (r.type === 'scripture' || r.type === 'historic') {
      return files.filter(function (f) { return f.file && /\.pdf(?:$|[?#])/i.test(f.file); })[0] || files[0];
    }
    var zips = files.filter(function (f) { return f.file && /\.zip(?:$|[?#])/i.test(f.file); });
    if (zips.length) {
      return zips.filter(function (f) {
        return /(?:low|small|sd|bandwidth|کم|कम डेटा|data kidogo)/i.test(f.label || '');
      })[0] || zips[0];
    }
    if (r.type === 'film') {
      var whole = files.filter(function (f) {
        return f.file && !/^\s*(?:\d+|ep\s*\d+)/i.test(f.label || '') &&
          /(?:video|mp4|movie|film)/i.test(f.label || '');
      });
      if (whole.length) {
        return whole.filter(function (f) { return /(?:sd|low|small)/i.test(f.label || ''); })[0] || whole[0];
      }
    }
    return files.filter(function (f) { return f.chapters; })[0] || files[0];
  }

  function batchJobs(resources) {
    var jobs = [], seen = {};
    resources.forEach(function (r) {
      var f = preferredFile(r);
      if (!f) return;
      jobsFor(r, f).forEach(function (job) {
        // Chapter filenames such as "01 - Introduction.mp4" repeat between
        // films. Prefixing the resource keeps every selected movie intact.
        if (f.chapters) job.name = clean(r.title) + ' - ' + job.name;
        var key = job.name.toLowerCase(), n = (seen[key] || 0) + 1;
        seen[key] = n;
        if (n > 1) {
          var ext = extOf(job.name), base = ext ? job.name.slice(0, -ext.length) : job.name;
          job.name = base + ' (' + n + ')' + ext;
        }
        jobs.push(job);
      });
    });
    return jobs;
  }

  function openMany(resources) {
    resources = (resources || []).filter(function (r) { return !!preferredFile(r); });
    var jobs = batchJobs(resources);
    if (!jobs.length) return null;

    var S = { target: null, ctrl: null, done: [] };
    var sheet = ET.sheet('<div id="save-many-flow"></div>');
    var root = ET.$('#save-many-flow', sheet.el);
    var close = sheet.close;
    sheet.close = function () {
      if (S.ctrl) S.ctrl.abort();
      close();
    };

    function paint(html) { root.innerHTML = html; }
    function batchHeader(step) {
      var titles = ['save.step.where', 'save.step.go', 'save.step.done'];
      return ET.stepper(3, step) + '<h2>' + h(titles[step]) + '</h2>';
    }
    function summary() {
      return h('bulk.summary', { items: resources.length, files: jobs.length });
    }

    function where() {
      recall(function (saved) {
        var opts = [];
        if (saved) opts.push(['again', 'folder', t('save.folder.again', { name: saved.name }), '']);
        if (CAN_DIR) opts.push(['dir', 'folder', t('save.folder'), t('save.folder.sub')]);
        opts.push(['downloads', 'save', t('save.default'), t('save.default.sub')]);
        paint(batchHeader(0) +
          '<div class="note info" style="margin-bottom:1rem"><strong>' +
          h('bulk.title', { n: resources.length }) + '</strong><p class="muted" style="margin:.2rem 0 0">' +
          summary() + '</p></div><div class="stack">' + opts.map(function (o) {
            return '<button class="tile" data-bw="' + o[0] + '" style="width:100%;text-align:start">' +
              '<span class="ico">' + ET.icon(o[1]) + '</span><span><span class="t">' + ET.esc(o[2]) +
              '</span>' + (o[3] ? '<span class="s">' + ET.esc(o[3]) + '</span>' : '') + '</span>' +
              '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
          }).join('') + '</div><p class="muted" style="font-size:.9rem;margin:1rem 0 0">' +
          h('bulk.multiple') + '</p><button class="btn ghost block" id="bsv-x" style="margin-top:1rem">' +
          h('ui.cancel') + '</button>');
        ET.$$('[data-bw]', root).forEach(function (b) {
          b.addEventListener('click', function () { choose(b.getAttribute('data-bw'), saved); });
        });
        ET.$('#bsv-x', root).addEventListener('click', sheet.close);
      });
    }

    function choose(kind, saved) {
      if (kind === 'again' && saved) {
        var ask = saved.requestPermission ? saved.requestPermission({ mode: 'readwrite' })
                                          : Promise.resolve('granted');
        ask.then(function (p) {
          if (p !== 'granted') return where();
          S.target = { kind: 'dir', handle: saved, name: saved.name };
          go();
        }, where);
      } else if (kind === 'dir') {
        window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' }).then(function (d) {
          remember(d);
          S.target = { kind: 'dir', handle: d, name: d.name };
          go();
        }, function () {});
      } else {
        S.target = { kind: 'downloads', name: t('save.done.downloads') };
        go();
      }
    }

    function go() {
      S.ctrl = new AbortController();
      S.done = [];
      paint(batchHeader(1) + '<p class="muted" style="margin:-.2rem 0 .8rem">' + summary() + '</p>' +
        '<p class="latin" id="bsv-name" style="font-weight:700;margin:0 0 .6rem"></p>' +
        '<div class="meter"><span id="bsv-bar"></span></div>' +
        '<p class="muted" id="bsv-count" style="margin:.6rem 0 0"></p>' +
        '<p class="muted" id="bsv-files" style="margin:.2rem 0 0"></p>' +
        '<button class="btn ghost block" id="bsv-stop" style="margin-top:1.2rem">' +
        h('save.stop') + '</button>');
      ET.$('#bsv-stop', root).addEventListener('click', function () { S.ctrl.abort(); where(); });
      var i = 0;
      (function next() {
        if (i >= jobs.length) return finished();
        var job = jobs[i], nm = ET.$('#bsv-name', root);
        if (!nm) return;
        nm.textContent = job.name;
        ET.$('#bsv-files', root).innerHTML = h('save.files', { n: i + 1, total: jobs.length });
        saveOne(job, S.target, S.ctrl.signal, progress).then(function (res) {
          S.done.push(res); i += 1; next();
        }, function (err) {
          if (err && err.name === 'AbortError') return;
          failed(err);
        });
      })();
    }

    function progress(got, total) {
      var bar = ET.$('#bsv-bar', root), count = ET.$('#bsv-count', root);
      if (!bar) return;
      if (total) {
        bar.classList.remove('busy');
        bar.style.width = Math.min(100, 100 * got / total).toFixed(1) + '%';
        count.innerHTML = '<span class="num">' + ET.human(got) + ' / ' + ET.human(total) + '</span>';
      } else {
        bar.classList.add('busy');
        count.innerHTML = '<span class="num">' + ET.human(got) + '</span>';
      }
    }

    function finished() {
      S.ctrl = null;
      var place = S.target.kind === 'downloads' ? t('save.done.downloads') : S.target.name;
      paint(batchHeader(2) + '<div class="done-mark">' + ET.icon('check') + '</div>' +
        '<h3 class="center" style="margin:.2rem 0">' + h('bulk.done.title', { n: resources.length }) + '</h3>' +
        '<p class="center muted">' + ET.esc(t('save.done.where', { place: place })) + '</p>' +
        '<button class="btn green block" id="bsv-done" style="margin-top:1rem">' +
        h('bulk.close') + '</button>');
      ET.$('#bsv-done', root).addEventListener('click', sheet.close);
    }

    function failed(err) {
      paint(batchHeader(1) + '<div class="note"><strong>' + h('save.fail') + '</strong>' +
        '<p class="latin" style="margin:.3rem 0 0">' + ET.esc((err && err.message) || '') + '</p></div>' +
        '<div class="stack" style="margin-top:1rem"><button class="btn block" id="bsv-retry">' +
        h('save.retry') + '</button><button class="btn ghost block" id="bsv-back">' +
        ET.icon('back', 'flip') + h('save.back') + '</button></div>');
      ET.$('#bsv-retry', root).addEventListener('click', go);
      ET.$('#bsv-back', root).addEventListener('click', where);
    }

    where();
    return sheet;
  }

  // ------------------------------------------------------------ one file
  /* Resolves to { handle } when written into a picked location, { blob } when
     it was collected in memory and handed to Downloads, or { url } when it was
     too big for that and handed to the browser's own download manager. */
  function saveOne(job, target, signal, onProgress) {
    var url = new URL(job.url, location.href).href;

    // Big file, no file-system access: don't try to hold it in memory.
    if (target.kind === 'downloads' && job.bytes > BIG) {
      directDownload(url, job.name);
      onProgress(1, 1);
      return Promise.resolve({ url: url });
    }

    return fetch(url, { signal: signal }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var total = +res.headers.get('content-length') || job.bytes || 0;

      if (target.kind === 'downloads' && total > BIG) {
        try { res.body.cancel(); } catch (e) {}
        directDownload(url, job.name);
        onProgress(1, 1);
        return { url: url };
      }

      return getWritable(target, job.name).then(function (w) {
        var reader = res.body.getReader(), got = 0, parts = [];
        function pump() {
          return reader.read().then(function (step) {
            if (step.done) return;
            got += step.value.byteLength;
            onProgress(got, total);
            if (w) return w.stream.write(step.value).then(pump);
            parts.push(step.value);
            return pump();
          });
        }
        return pump().then(function () {
          if (w) return w.stream.close().then(function () { return { handle: w.handle }; });
          // Decided from the filename, not from the server's header: a blob
          // URL we later open would run in this app's origin if it were HTML.
          var blob = new Blob(parts, { type: ET.safeType(job.name) });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = job.name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
          return { blob: blob };
        }, function (err) {
          if (w) { try { w.stream.abort(); } catch (e) {} }
          throw err;
        });
      });
    }, function (err) {
      if (err && err.name === 'AbortError') throw err;
      // The page could not read the file itself — hand it to the browser.
      if (target.kind === 'downloads') {
        directDownload(url, job.name);
        onProgress(1, 1);
        return { url: url };
      }
      throw err;
    });
  }

  function getWritable(target, name) {
    if (target.kind === 'file') {
      return target.handle.createWritable().then(function (s) { return { stream: s, handle: target.handle }; });
    }
    if (target.kind === 'dir') {
      return target.handle.getFileHandle(name, { create: true }).then(function (fh) {
        return fh.createWritable().then(function (s) { return { stream: s, handle: fh }; });
      });
    }
    return Promise.resolve(null);
  }

  function directDownload(url, name) {
    var a = document.createElement('a');
    a.href = url; a.download = name; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  ET.save = { open: open, openMany: openMany, canPickFolder: CAN_DIR, clean: clean, extOf: extOf };
})(window.ET);
