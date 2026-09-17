/* ============================================================================
   Nearby — send a file from one phone to another, straight from this page.

     1  Which phone is this?   Send, or Receive
     2  Connect                the sender shows a 6-digit code; the receiver types it
     3  Choose                 the sender picks; the receiver accepts (and a folder)
     4  Sending                progress on both phones
     5  Done                   open it, save it, or pass it on to the next person

   HOW IT CONNECTS. WebRTC joins the two browsers directly — the file never
   touches a server. Before that can happen they swap a few hundred bytes of
   connection details, and something has to carry those:

   · served by packer/serve.py (a VillageServer Pi, or a laptop), that server
     carries them itself, so Nearby works on a network with no internet at all;
   · anywhere else (the Vercel web edition), a free public broker does it —
     PeerJS's, through its official client (assets/vendor/peerjs.min.js).

   Off a card (file://) there is nothing to carry them, and the page says so and
   points at the step-by-step guide instead of failing silently.
   ========================================================================= */
(function (ET) {
  'use strict';
  var t = ET.i18n.t, h = ET.i18n.h;

  var item = ET.qs('id') ? ET.byId(ET.qs('id')) : null;
  var BROKER = 'wss://0.peerjs.com/peerjs';
  var PREFIX = 'easytransfer-bt123-';
  var STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  var HIGH = 8 * 1024 * 1024;           // pause sending above this much buffered
  var LOW = 1024 * 1024;                // resume below this
  var STEPS = ['nearby.step.role', 'nearby.step.pair', 'nearby.step.pick',
               'nearby.step.move', 'nearby.step.done'];

  // ----------------------------------------------------------------- helpers
  function device() {
    var u = navigator.userAgent;
    if (/iPhone/.test(u)) return 'iPhone';
    if (/iPad/.test(u)) return 'iPad';
    if (/Android/.test(u)) return 'Android phone';
    if (/Macintosh/.test(u)) return 'Mac';
    if (/Windows/.test(u)) return 'Windows computer';
    return 'Computer';
  }
  function code6() {
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return String(100000 + (a[0] % 900000));
  }
  function token() { return Math.random().toString(36).slice(2, 12); }

  // -------------------------------------------------------------- transports
  /* Both transports expose the same four things: ready (a promise), send(msg),
     onmessage, close(). Messages are {type: OFFER|ANSWER|CANDIDATE|LEAVE, …}. */

  function LocalSignal(room, me, peer) {
    var self = { onmessage: null, closed: false };
    self.ready = Promise.resolve();
    self.send = function (msg) {
      return fetch('/signal/' + room + '/' + peer, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg)
      }).catch(function () {});
    };
    (function poll() {
      if (self.closed) return;
      fetch('/signal/' + room + '/' + me + '?wait=25', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (list) {
          list.forEach(function (m) { if (self.onmessage) self.onmessage(m); });
          poll();
        }, function () { setTimeout(poll, 1500); });
    })();
    self.close = function () { self.closed = true; };
    return self;
  }

  /* The web edition's link, through PeerJS's public broker.

     This used to speak the broker's WebSocket protocol by hand. The broker
     accepted those connections and then silently dropped every relayed
     message, while the official client — same broker, same moment — got
     through first time. So the official client (vendored, MIT, ~90 KB, loaded
     only on this page) does the introduction, and hands back its raw
     RTCDataChannel so the transfer code below is identical on both paths. */
  function brokerLink(role, room, on) {
    if (typeof window.Peer !== 'function') { on.fail(new Error('broker client missing')); return null; }
    var me = PREFIX + room + (role === 'host' ? '-h' : '-g');
    var them = PREFIX + room + (role === 'host' ? '-g' : '-h');
    var peer = new window.Peer(me, { debug: 0, config: { iceServers: STUN } });
    var conn = null, closed = false;

    function adopt(c) {
      conn = c;
      c.on('open', function () {
        var dc = c.dataChannel;
        dc.binaryType = 'arraybuffer';
        dc.bufferedAmountLowThreshold = LOW;
        dc.onmessage = function (e) { on.message(e.data); };
        on.open(dc, c.peerConnection);
      });
      c.on('close', function () { if (!closed) on.close(); });
      c.on('error', function (e) { on.fail(e); });
    }

    peer.on('error', function (e) {
      if (closed) return;
      if (e.type === 'peer-unavailable') on.nobody();          // no phone behind that code
      else if (e.type === 'unavailable-id') on.fail(new Error('taken'));
      else on.fail(new Error(e.type || e.message || 'broker'));
    });
    peer.on('open', function () {
      if (role === 'guest') adopt(peer.connect(them, { reliable: true, serialization: 'raw' }));
    });
    if (role === 'host') {
      peer.on('connection', function (c) {
        if (conn) { c.close(); return; }                          // already paired
        adopt(c);
      });
    }
    return {
      close: function () {
        closed = true;
        try { if (conn) conn.close(); } catch (e) {}
        try { peer.destroy(); } catch (e) {}
      }
    };
  }

  function detect() {
    var forced = ET.qs('signal');
    if (!/^https?:$/.test(location.protocol)) return Promise.resolve('none');
    if (forced === 'broker' || forced === 'local') return Promise.resolve(forced);
    return fetch('/signal/ping', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j && j.kind === 'local' ? 'local' : 'broker'; },
            function () { return 'broker'; });
  }

  // -------------------------------------------------------------- connection
  function connect(role, sig, kind, on) {
    var pc = new RTCPeerConnection({ iceServers: kind === 'local' ? [] : STUN });
    var pending = [], dc = null, done = false;

    function setup(ch) {
      dc = ch;
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = LOW;
      dc.onopen = function () { on.open(dc, pc); };
      dc.onmessage = function (e) { on.message(e.data); };
      dc.onclose = function () { if (!done) on.close(); };
    }
    function flush() {
      pending.splice(0).forEach(function (c) { pc.addIceCandidate(c).catch(function () {}); });
    }

    pc.onicecandidate = function (e) {
      if (e.candidate) sig.send({ type: 'CANDIDATE', candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed') on.fail(new Error('connection failed'));
    };

    sig.onmessage = function (m) {
      if (m.type === 'OFFER' && role === 'host') {
        if (pc.remoteDescription) return;           // already paired — ignore a second phone
        pc.setRemoteDescription({ type: 'offer', sdp: m.sdp }).then(function () {
          flush();
          return pc.createAnswer();
        }).then(function (a) { return pc.setLocalDescription(a); }).then(function () {
          sig.send({ type: 'ANSWER', sdp: pc.localDescription.sdp });
        }).catch(on.fail);
      } else if (m.type === 'ANSWER' && role === 'guest') {
        pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).then(flush).catch(on.fail);
      } else if (m.type === 'CANDIDATE' && m.candidate) {
        if (pc.remoteDescription) pc.addIceCandidate(m.candidate).catch(function () {});
        else pending.push(m.candidate);
      } else if (m.type === 'EXPIRE') {
        on.nobody();                                 // the code has no phone behind it
      } else if (m.type === 'LEAVE') {
        on.close();
      }
    };

    if (role === 'guest') {
      setup(pc.createDataChannel('files', { ordered: true }));
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () {
        sig.send({ type: 'OFFER', sdp: pc.localDescription.sdp });
      }).catch(on.fail);
    } else {
      pc.ondatachannel = function (e) { setup(e.channel); };
    }

    return {
      pc: pc,
      close: function () {
        done = true;
        try { sig.send({ type: 'LEAVE' }); } catch (e) {}
        try { if (dc) dc.close(); } catch (e) {}
        try { pc.close(); } catch (e) {}
        sig.close();
      }
    };
  }

  // ----------------------------------------------------------------- sending
  function chunkSize(pc) {
    var max = (pc.sctp && pc.sctp.maxMessageSize) || 16384;
    return Math.max(16384, Math.min(65536, max));
  }
  function push(dc, buf) {
    if (dc.bufferedAmount < HIGH) { dc.send(buf); return Promise.resolve(); }
    return new Promise(function (resolve) {
      dc.onbufferedamountlow = function () { dc.onbufferedamountlow = null; dc.send(buf); resolve(); };
    });
  }

  /* A source is { name, size, type, open() } where open() resolves to a reader
     whose read() yields ArrayBuffer pieces. Files from the phone and files from
     a URL (the card, or the DBS CDN) both end up in that shape. */
  function fileSource(file) {
    return {
      name: file.name, size: file.size, type: file.type || '',
      open: function (chunk) {
        var off = 0;
        return Promise.resolve({
          read: function () {
            if (off >= file.size) return Promise.resolve(null);
            var s = file.slice(off, off + chunk);
            off += chunk;
            return s.arrayBuffer ? s.arrayBuffer()
              : new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsArrayBuffer(s); });
          }
        });
      }
    };
  }
  function urlSource(url, name, size) {
    return {
      name: name, size: size || 0, type: '',
      open: function (chunk) {
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          var reader = res.body.getReader(), carry = null;
          return {
            // The network hands over pieces of any size; the channel wants
            // pieces no bigger than `chunk`. Re-cut them as views, not copies —
            // RTCDataChannel.send takes a Uint8Array directly.
            read: function () {
              if (carry && carry.byteLength) {
                var out = carry.subarray(0, chunk); carry = carry.subarray(chunk);
                return Promise.resolve(out);
              }
              return reader.read().then(function (step) {
                if (step.done) return null;
                carry = step.value.subarray(chunk);
                return step.value.subarray(0, chunk);
              });
            }
          };
        });
      }
    };
  }
  function headSize(url) {
    return fetch(url, { method: 'HEAD' }).then(function (r) {
      return +r.headers.get('content-length') || 0;
    }, function () { return 0; });
  }

  /* What this item offers to send. A chaptered film offers its chapters as one
     batch — the receiver accepts once, not sixty-one times. */
  function itemChoices(r) {
    var out = [];
    (r.files || []).forEach(function (f) {
      if (f.chapters && r.play && r.play.items) {
        out.push({ label: f.label, many: r.play.items.map(function (c) {
          return { url: c.file, name: ET.pad(c.n) + ' - ' + ET.save.clean(c.title) + (ET.save.extOf(c.file) || '.mp4') };
        }) });
      } else if (f.file) {
        var tail = f.file.split('?')[0].split('/').pop();
        out.push({ label: f.label, bytes: f.bytes, many: [{
          url: f.file, size: f.bytes,
          name: ET.save.clean(r.title + (/^(PDF|Read)$/i.test(f.label) ? '' : ' - ' + f.label)) +
                (ET.save.extOf(tail) || '')
        }] });
      }
    });
    return out;
  }

  // ---------------------------------------------------------------------- UI
  var S = {
    step: 0, role: null, code: '', kind: null, link: null, dc: null, pc: null,
    peer: '', carry: null, sending: null, incoming: null, got: [], bytes: 0, total: 0
  };
  var root;

  function paint(step, html) {
    S.step = step;
    root.innerHTML = ET.stepper(STEPS.length, step) + '<h2>' + h(STEPS[step]) + '</h2>' + html;
  }
  function btn(id, cls, icon, label) {
    return '<button class="btn ' + cls + ' block" id="' + id + '">' + (icon ? ET.icon(icon) : '') + label + '</button>';
  }
  function on(id, fn) { var el = ET.$('#' + id, root); if (el) el.addEventListener('click', fn); }

  // ---- 1. role
  function role() {
    reset();
    paint(0,
      '<p class="muted">' + h('nearby.lead') + '</p>' +
      (item ? '<div class="note info" style="margin-bottom:1rem"><strong class="latin">' +
        ET.esc(item.title) + '</strong></div>' : '') +
      '<div class="stack">' +
        '<button class="tile" id="r-send" style="width:100%;text-align:start">' +
          '<span class="ico" style="background:var(--green-wash);color:var(--green-deep)">' + ET.icon('share') + '</span>' +
          '<span><span class="t">' + h('nearby.send') + '</span><span class="s">' + h('nearby.send.sub') + '</span></span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></button>' +
        '<button class="tile" id="r-recv" style="width:100%;text-align:start">' +
          '<span class="ico" style="background:var(--sky-wash);color:var(--sky-deep)">' + ET.icon('save') + '</span>' +
          '<span><span class="t">' + h('nearby.receive') + '</span><span class="s">' + h('nearby.receive.sub') + '</span></span>' +
          '<span class="chev flip">' + ET.icon('chev') + '</span></button>' +
      '</div>');
    on('r-send', function () { host(); });
    on('r-recv', function () { guestAsk(); });
  }

  // ---- 2a. sender: show a code and wait
  function host(tries) {
    S.role = 'host';
    S.code = code6();
    paint(1,
      '<p class="flabel">' + h('nearby.code') + '</p>' +
      '<div class="code" aria-live="polite">' + S.code.slice(0, 3) + ' ' + S.code.slice(3) + '</div>' +
      '<p style="margin:.8rem 0 0">' + h('nearby.code.tell') + '</p>' +
      '<p class="muted" style="margin:.8rem 0 0"><span class="spin"></span>' + h('nearby.waiting') + '</p>' +
      btn('x', 'ghost', 'back', h('save.back')));
    on('x', role);
    start('host', 'h', 'g', function (err) {
      // Someone else on the public broker picked the same code. Pick again.
      if (err && err.message === 'taken' && (tries || 0) < 3) return host((tries || 0) + 1);
      fail(err);
    });
  }

  // ---- 2b. receiver: type the code
  function guestAsk(msg) {
    S.role = 'guest';
    paint(1,
      '<label class="flabel" for="code-in">' + h('nearby.enter') + '</label>' +
      '<input id="code-in" class="code-input" type="text" inputmode="numeric" pattern="[0-9]*" ' +
      'maxlength="7" autocomplete="one-time-code" placeholder="000 000">' +
      (msg ? '<div class="note" style="margin-top:.8rem"><strong>' + msg + '</strong></div>' : '') +
      '<div class="stack" style="margin-top:1rem">' + btn('go', '', 'wifi', h('nearby.join')) +
      btn('x', 'ghost', 'back', h('save.back')) + '</div>');
    var input = ET.$('#code-in', root);
    input.focus();
    function tryJoin() {
      var c = input.value.replace(/\D/g, '');
      if (c.length !== 6) { input.focus(); return; }
      S.code = c;
      paint(1, '<div class="code">' + c.slice(0, 3) + ' ' + c.slice(3) + '</div>' +
        '<p class="muted" style="margin-top:.8rem"><span class="spin"></span>' + h('nearby.connecting') + '</p>' +
        btn('x', 'ghost', 'back', h('save.back')));
      on('x', role);
      start('guest', 'g', 'h', fail);
      // Local signalling cannot say "nobody has that code"; a timeout can.
      S.joinTimer = setTimeout(function () {
        if (!S.dc) { reset(); guestAsk(h('nearby.bad')); }
      }, 20000);
    }
    input.addEventListener('input', function () {
      if (input.value.replace(/\D/g, '').length === 6) tryJoin();
    });
    on('go', tryJoin);
    on('x', role);
  }

  function start(r, me, peer, onFail) {
    var handlers = {
      open: function (dc, pc) {
        clearTimeout(S.joinTimer);
        S.dc = dc; S.pc = pc;
        dc.send(JSON.stringify({ t: 'hi', device: device() }));
      },
      message: onData,
      close: function () { if (S.step < 4) fail(new Error('The other phone left.')); },
      fail: onFail,
      nobody: function () { clearTimeout(S.joinTimer); reset(); guestAsk(h('nearby.bad')); }
    };
    if (S.kind === 'broker') {
      S.link = brokerLink(r, S.code, handlers);
      return;
    }
    var sig = LocalSignal(S.code, me, peer);
    S.sig = sig;
    sig.ready.then(function () { S.link = connect(r, sig, S.kind, handlers); }, onFail);
  }

  // ---- 3a. sender chooses
  function pick() {
    var choices = S.carry ? [] : (item ? itemChoices(item) : []);
    paint(2,
      '<div class="note good" style="margin-bottom:1rem"><strong>' + ET.icon('check') + ' ' +
        h('nearby.connected') + ' — <span class="latin">' + ET.esc(S.peer) + '</span></strong></div>' +
      '<div class="stack">' +
        (S.carry ? S.carry.map(function (f, i) {
          return '<button class="tile" data-carry="' + i + '" style="width:100%;text-align:start">' +
            '<span class="ico">' + ET.icon('share') + '</span>' +
            '<span><span class="t latin">' + ET.esc(f.name) + '</span>' +
            '<span class="s num">' + ET.human(f.size) + '</span></span></button>';
        }).join('') : '') +
        choices.map(function (c, i) {
          return '<button class="tile" data-c="' + i + '" style="width:100%;text-align:start">' +
            '<span class="ico">' + ET.icon(c.many.length > 1 ? 'folder' : 'share') + '</span>' +
            '<span><span class="t">' + ET.esc(t('nearby.pick.item', { title: item.title })) + '</span>' +
            '<span class="s latin">' + ET.esc(c.label) + (c.bytes ? ' · ' + ET.human(c.bytes) : '') + '</span></span>' +
            '<span class="chev flip">' + ET.icon('chev') + '</span></button>';
        }).join('') +
        '<label class="tile" style="width:100%;cursor:pointer">' +
          '<span class="ico">' + ET.icon('folder') + '</span>' +
          '<span><span class="t">' + h('nearby.pick.file') + '</span>' +
          '<span class="s">' + h('nearby.pick.file.sub') + '</span></span>' +
          '<input type="file" id="pick-file" multiple hidden></label>' +
      '</div>' + btn('x', 'ghost', '', h('nearby.restart')));

    ET.$$('[data-c]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var c = choices[+b.getAttribute('data-c')];
        paint(2, '<p class="muted"><span class="spin"></span>' + h('nearby.fetching') + '</p>');
        Promise.all(c.many.map(function (m) {
          return m.size ? Promise.resolve(m.size) : headSize(m.url);
        })).then(function (sizes) {
          offer(c.many.map(function (m, i) { return urlSource(m.url, m.name, sizes[i]); }));
        });
      });
    });
    ET.$$('[data-carry]', root).forEach(function (b) {
      b.addEventListener('click', function () { offer([fileSource(S.carry[+b.getAttribute('data-carry')])]); });
    });
    ET.$('#pick-file', root).addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      if (files.length) offer(files.map(fileSource));
    });
    on('x', role);
  }

  function offer(sources) {
    S.sending = sources;
    S.total = sources.reduce(function (a, s) { return a + (s.size || 0); }, 0);
    S.dc.send(JSON.stringify({ t: 'batch', files: sources.map(function (s) {
      return { name: s.name, size: s.size, type: s.type };
    }), total: S.total }));
    paint(2, '<p class="muted"><span class="spin"></span>' +
      ET.esc(t('nearby.wait.accept', { device: S.peer })) + '</p>');
  }

  function sendAll() {
    var chunk = chunkSize(S.pc), i = 0, sent = 0;
    moving(h('nearby.sending'));
    (function nextFile() {
      if (i >= S.sending.length) { S.dc.send(JSON.stringify({ t: 'end' })); return; }
      var src = S.sending[i];
      S.dc.send(JSON.stringify({ t: 'file', i: i }));
      label(src.name, i, S.sending.length);
      src.open(chunk).then(function (reader) {
        (function pump() {
          reader.read().then(function (buf) {
            if (!buf) { S.dc.send(JSON.stringify({ t: 'eof', i: i })); i += 1; return nextFile(); }
            push(S.dc, buf).then(function () { sent += buf.byteLength; meter(sent, S.total); pump(); });
          }, fail);
        })();
      }, fail);
    })();
  }

  // ---- 3b. receiver decides
  function incoming(batch) {
    S.incoming = batch;
    S.got = [];
    var canDir = typeof window.showDirectoryPicker === 'function';
    paint(2,
      '<div class="note info"><strong>' + ET.esc(t('nearby.accept.title', { device: S.peer })) + '</strong>' +
      '<p style="margin:.4rem 0 0" class="latin">' + batch.files.slice(0, 5).map(function (f) {
        return ET.esc(f.name) + (f.size ? ' · ' + ET.human(f.size) : '');
      }).join('<br>') + (batch.files.length > 5 ? '<br>… +' + (batch.files.length - 5) : '') + '</p>' +
      (batch.total ? '<p class="num" style="margin:.4rem 0 0;font-weight:800">' + ET.human(batch.total) + '</p>' : '') +
      '</div>' +
      '<div class="stack" style="margin-top:1rem">' +
        (canDir ? btn('acc-dir', 'green', 'folder', h('nearby.accept.folder')) : '') +
        btn('acc', canDir ? '' : 'green', 'save', h('nearby.accept')) +
        btn('no', 'ghost', '', h('nearby.decline')) +
      '</div>');
    on('acc-dir', function () {
      window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' }).then(function (d) {
        S.dir = d; accept();
      }, function () {});
    });
    on('acc', function () { S.dir = null; accept(); });
    on('no', function () { S.dc.send(JSON.stringify({ t: 'decline' })); waitForPick(); });
  }

  function accept() {
    S.bytes = 0;
    S.total = S.incoming.total || 0;
    S.dc.send(JSON.stringify({ t: 'accept' }));
    moving(h('nearby.receiving'));
  }

  function waitForPick() {
    paint(2,
      '<div class="note good"><strong>' + ET.icon('check') + ' ' + h('nearby.connected') +
      ' — <span class="latin">' + ET.esc(S.peer) + '</span></strong></div>' +
      '<p class="muted" style="margin-top:1rem"><span class="spin"></span>' +
      ET.esc(t('nearby.wait.pick', { device: S.peer })) + '</p>' +
      btn('x', 'ghost', '', h('nearby.restart')));
    on('x', role);
  }

  // The receiver's current file.
  var cur = null;
  function onData(data) {
    if (typeof data !== 'string') {
      if (!cur) return;
      // Capture this file now: by the time a queued write runs, `cur` may
      // already be the next file, or null.
      var c = cur;
      S.bytes += data.byteLength;
      meter(S.bytes, S.total);
      // Into a folder, every chunk waits in line behind the file being opened —
      // otherwise the first chunks arrive before the writer exists and are lost.
      if (S.dir) c.q = c.q.then(function () { return c.writer.write(data); });
      else c.parts.push(data);
      return;
    }
    var m; try { m = JSON.parse(data); } catch (e) { return; }

    if (m.t === 'hi') {
      S.peer = m.device || 'phone';
      if (S.role === 'host') pick(); else waitForPick();
    } else if (m.t === 'batch') {
      incoming(m);
    } else if (m.t === 'accept') {
      sendAll();
    } else if (m.t === 'decline') {
      paint(2, '<div class="note"><strong>' + ET.esc(t('nearby.declined', { device: S.peer })) + '</strong></div>' +
        btn('again', '', '', h('nearby.again')));
      on('again', pick);
    } else if (m.t === 'file') {
      var f = S.incoming.files[m.i];
      label(f.name, m.i, S.incoming.files.length);
      cur = { i: m.i, name: f.name, type: f.type, parts: [], q: Promise.resolve(), writer: null };
      if (S.dir) {
        var c = cur;
        c.q = S.dir.getFileHandle(f.name, { create: true }).then(function (fh) {
          c.handle = fh;
          return fh.createWritable();
        }).then(function (w) { c.writer = w; });
      }
    } else if (m.t === 'eof') {
      var c2 = cur; cur = null;
      S.writes = (S.writes || Promise.resolve()).then(function () {
        return c2.q.then(function () {
          if (c2.writer) return c2.writer.close().then(function () { S.got.push({ name: c2.name, handle: c2.handle }); });
          S.got.push({ name: c2.name, blob: new Blob(c2.parts, { type: c2.type || '' }) });
        });
      });
    } else if (m.t === 'end') {
      // Done means written, not merely received: wait for every file to close.
      (S.writes || Promise.resolve()).then(function () {
        S.writes = null;
        S.dc.send(JSON.stringify({ t: 'got' }));
        received();
      }, fail);
    } else if (m.t === 'got') {
      sent();
    }
  }

  // ---- 4. moving
  function moving(title) {
    paint(3,
      '<p style="font-weight:800;margin:0 0 .3rem">' + title + ' · <span class="latin">' + ET.esc(S.peer) + '</span></p>' +
      '<p class="latin muted" id="mv-name" style="margin:0 0 .6rem"></p>' +
      '<div class="meter"><span id="mv-bar"></span></div>' +
      '<p class="muted" id="mv-count" style="margin:.6rem 0 0"></p>');
  }
  function label(name, i, n) {
    var el = ET.$('#mv-name', root);
    if (el) el.textContent = (n > 1 ? (i + 1) + '/' + n + ' · ' : '') + name;
  }
  function meter(got, total) {
    var bar = ET.$('#mv-bar', root), count = ET.$('#mv-count', root);
    if (!bar) return;
    if (total) bar.style.width = Math.min(100, 100 * got / total).toFixed(1) + '%';
    else bar.classList.add('busy');
    count.innerHTML = '<span class="num">' + ET.human(got) + (total ? ' / ' + ET.human(total) : '') + '</span>';
  }

  // ---- 5. done
  function sent() {
    paint(4,
      '<div class="done-mark">' + ET.icon('check') + '</div>' +
      '<h3 class="center">' + h('nearby.sent') + ' → <span class="latin">' + ET.esc(S.peer) + '</span></h3>' +
      '<div class="note good" style="margin-top:1rem"><p style="margin:0">' + h('nearby.teach') + '</p></div>' +
      '<div class="stack" style="margin-top:1rem">' + btn('again', '', 'share', h('nearby.again')) +
      btn('x', 'ghost', '', h('nearby.restart')) + '</div>');
    on('again', pick);
    on('x', role);
  }

  function received() {
    var rows = S.got.map(function (g, i) {
      var open = g.blob
        ? '<a class="btn green" target="_blank" rel="noopener" href="' + URL.createObjectURL(g.blob) + '">' + ET.icon('play') + h('save.open') + '</a>' +
          '<a class="btn ghost" download="' + ET.esc(g.name) + '" href="' + URL.createObjectURL(g.blob) + '">' + ET.icon('save') + h('nearby.save') + '</a>'
        : '<button class="btn green" data-open="' + i + '">' + ET.icon('play') + h('save.open') + '</button>';
      return '<div class="card" style="padding:.9rem"><p class="latin" style="font-weight:800;margin:0 0 .6rem">' +
        ET.esc(g.name) + '</p><div class="btn-row">' + open + '</div></div>';
    }).join('');
    paint(4,
      '<div class="done-mark">' + ET.icon('check') + '</div>' +
      '<h3 class="center">' + h('nearby.got') + ' ← <span class="latin">' + ET.esc(S.peer) + '</span></h3>' +
      (S.dir ? '<p class="center muted">' + ET.esc(t('save.done.where', { place: S.dir.name })) + '</p>' : '') +
      '<div class="stack" style="margin-top:1rem">' + rows + '</div>' +
      '<div class="stack" style="margin-top:1rem">' +
        btn('pass', 'sky', 'share', h('nearby.passon')) +
        btn('x', 'ghost', '', h('nearby.restart')) + '</div>');
    ET.$$('[data-open]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        S.got[+b.getAttribute('data-open')].handle.getFile().then(function (f) {
          window.open(URL.createObjectURL(f), '_blank');
        });
      });
    });
    // The chain: what just arrived becomes what this phone sends next.
    on('pass', function () {
      Promise.all(S.got.map(function (g) {
        return g.blob ? new File([g.blob], g.name, { type: g.blob.type })
                      : g.handle.getFile();
      })).then(function (files) { var keep = files; role(); S.carry = keep; host(); });
    });
    on('x', role);
  }

  function fail(err) {
    var msg = (err && err.message) || '';
    reset();
    paint(S.step || 1,
      '<div class="note"><strong>' + h('nearby.fail') + '</strong>' +
      '<p style="margin:.3rem 0 0">' + h('nearby.fail.sub') + '</p>' +
      (msg ? '<p class="latin muted" style="margin:.3rem 0 0;font-size:.85rem">' + ET.esc(msg) + '</p>' : '') +
      '</div>' + btn('x', '', '', h('nearby.restart')));
    on('x', role);
  }

  function reset() {
    clearTimeout(S.joinTimer);
    if (S.link) { try { S.link.close(); } catch (e) {} }
    else if (S.sig) { try { S.sig.close(); } catch (e) {} }
    S.link = S.sig = S.dc = S.pc = null;
    S.sending = S.incoming = null;
    S.carry = null;
    cur = null;
  }

  function offline() {
    paint(0,
      '<div class="note"><strong>' + h('nearby.offline') + '</strong></div>' +
      '<div class="stack" style="margin-top:1rem">' +
      '<a class="btn block" href="share.html' + (item ? '?id=' + encodeURIComponent(item.id) : '') + '">' +
      ET.icon('phone') + h('share.howto') + '</a></div>');
  }

  // ------------------------------------------------------------------- start
  ET.header('nearby');
  ET.tabbar('nearby.html');
  root = ET.$('#nearby');
  window.addEventListener('beforeunload', reset);

  if (typeof RTCPeerConnection !== 'function') { offline(); }
  else {
    detect().then(function (kind) {
      S.kind = kind;
      if (kind === 'none') offline(); else role();
    });
  }
  ET.i18n.apply();
  ET.i18n.onChange(function () { if (S.step === 0 && !S.link) role(); });

  // Exposed for testing two phones in one browser.
  ET.nearby = { state: S };
})(window.ET);
