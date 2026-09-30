/* Recent, consented browser activity. The host report owns fetching and scope. */
(function (window) {
  'use strict';
  var openState = Object.create(null);
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function readable(value) { return String(value || 'Unspecified').replace(/_/g, ' '); }
  function flag(code) {
    return /^[A-Z]{2}$/.test(code || '') && code !== 'XX'
      ? String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) : '◎';
  }
  function date(value) {
    var parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'Time unavailable';
  }
  function name(callback, value, fallback) {
    if (!value) return fallback;
    try { return typeof callback === 'function' ? String(callback(value) || value) : String(value); }
    catch (e) { return String(value); }
  }
  function opened(key, defaultOpen) {
    return Object.prototype.hasOwnProperty.call(openState, key) ? openState[key] : defaultOpen;
  }
  function details(key, css, summary, body, defaultOpen) {
    return '<details class="' + css + '" data-journey-key="' + esc(key) + '"' +
      (opened(key, defaultOpen) ? ' open' : '') + '><summary>' + summary + '</summary>' + body + '</details>';
  }
  function eventRow(event, options) {
    var statusNames = { handed_off: 'Native handoff · delivery unverified', browser_handoff: 'Browser handoff · save unverified',
      copied: 'Link copied', received: 'Data received', sent: 'Receipt acknowledged', guide_opened: 'Guide opened' };
    var resource = name(options.resourceTitle, event.resource, event.path || 'Page unavailable');
    var meta = [];
    if (event.channel) meta.push(readable(event.channel));
    if (event.status) meta.push(statusNames[event.status] || readable(event.status));
    if (event.language) meta.push(name(options.languageName, event.language, ''));
    if (event.country) meta.push(flag(event.country) + ' ' + name(options.countryName, event.country, 'Unknown'));
    if (Number.isFinite(event.bytes) && event.bytes >= 0) meta.push('Reported bytes: ' + event.bytes.toLocaleString('en-US'));
    if (Number.isFinite(event.duration) && event.duration >= 0) meta.push('Playback position: ' + Math.floor(event.duration / 60) + ':' + ('0' + Math.floor(event.duration % 60)).slice(-2));
    return '<li class="journey-event"><span class="journey-dot" aria-hidden="true"></span><div class="journey-event-body">' +
      '<div class="journey-event-heading"><strong>' + esc(readable(event.type)) + '</strong><time datetime="' + esc(event.at) + '">' + esc(date(event.at)) + '</time></div>' +
      '<p class="journey-resource" title="' + esc(event.resource || event.path || '') + '">' + esc(resource) + '</p>' +
      (meta.length ? '<p class="journey-event-meta">' + esc(meta.join(' · ')) + '</p>' : '') + '</div></li>';
  }
  function browserBody(browser, options) {
    var sessions = Object.create(null);
    browser.events.slice().sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); }).forEach(function (event) {
      var key = String(event.sessionId || 'unavailable');
      (sessions[key] || (sessions[key] = [])).push(event);
    });
    return '<div class="journey-browser-body">' + Object.keys(sessions).map(function (session, index) {
      var records = sessions[session];
      return '<section class="journey-session"><h4>Session ' + (index + 1) + ' <span>' + records.length + ' events · ' + esc(date(records[0].at)) + '</span></h4>' +
        '<p class="journey-session-id">Session ID: <code>' + esc(session) + '</code></p><ol class="journey-timeline">' +
        records.map(function (event) { return eventRow(event, options); }).join('') + '</ol></section>';
    }).join('') + '</div>';
  }
  function render(events, options) {
    var target = document.getElementById('journeys');
    if (!target) return;
    options = options || {};
    target.querySelectorAll('details[data-journey-key]').forEach(function (el) { openState[el.getAttribute('data-journey-key')] = el.open; });
    if (!target.__journeyListener) {
      target.__journeyListener = true;
      target.addEventListener('toggle', function (event) {
        var el = event.target, key = el.getAttribute && el.getAttribute('data-journey-key');
        if (key) openState[key] = el.open;
      }, true);
    }
    var recent = (Array.isArray(events) ? events : []).filter(function (event) {
      return event && typeof event === 'object' && Number.isFinite(Date.parse(event.at));
    }).sort(function (a, b) { return Date.parse(b.at) - Date.parse(a.at); }).slice(0, 500);
    if (!recent.length) {
      target.innerHTML = '<p class="rank-list-empty">Browser journeys will appear after consented activity is recorded.</p>';
      return;
    }
    var browsers = Object.create(null), countries = Object.create(null);
    recent.forEach(function (event) {
      var id = String(event.visitorId || 'unavailable');
      var browser = browsers[id] || (browsers[id] = { id: id, events: [], country: '', latest: event.at });
      browser.events.push(event);
      if (!browser.country && /^[A-Z]{2}$/.test(event.country || '') && event.country !== 'XX') browser.country = event.country;
    });
    Object.keys(browsers).forEach(function (id) {
      var browser = browsers[id], code = browser.country || 'unknown';
      (countries[code] || (countries[code] = [])).push(browser);
    });
    var countryKeys = Object.keys(countries).sort(function (a, b) { return countries[b].length - countries[a].length || a.localeCompare(b); });
    var notice = '<p class="journey-scope">' + recent.length + ' recent events from ' + Object.keys(browsers).length +
      ' anonymous browsers. This view uses up to the newest 500 returned records, not the full period. Countries group each browser by its most recent known country; event locations may vary. Times are UTC. Browser IDs can represent shared devices.</p>';
    target.innerHTML = notice + countryKeys.map(function (code) {
      var group = countries[code].sort(function (a, b) { return Date.parse(b.latest) - Date.parse(a.latest); });
      var country = code === 'unknown' ? 'Unknown country' : name(options.countryName, code, 'Unknown country');
      var summary = '<span class="journey-flag" aria-hidden="true">' + flag(code) + '</span><span class="journey-country-label">' +
        esc(country) + '<small>Most recent known country</small></span><span class="journey-country-count">' + group.length +
        (group.length === 1 ? ' browser' : ' browsers') + '</span>';
      var body = '<div class="journey-country-body">' + group.map(function (browser) {
        var first = browser.events[browser.events.length - 1];
        var title = '<span class="journey-browser-icon" aria-hidden="true">▤</span><span class="journey-browser-label">Anonymous browser <code title="' +
          esc(browser.id) + '">' + esc(browser.id.length > 12 ? browser.id.slice(0, 6) + '…' + browser.id.slice(-6) : browser.id) + '</code><small>' + esc(date(first.at)) + ' → ' + esc(date(browser.latest)) +
          '</small></span><span class="journey-browser-count">' + browser.events.length + ' events</span>';
        return details('browser:' + browser.id, 'journey-browser', title, browserBody(browser, options), false);
      }).join('') + '</div>';
      return details('country:' + code, 'journey-country', summary, body, true);
    }).join('');
  }
  window.EasyTransferAdminJourneys = { render: render };
})(window);
