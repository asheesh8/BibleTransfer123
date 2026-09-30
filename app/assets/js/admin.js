/* Standalone admin: analytics requests use only the HttpOnly admin session. */
(function () {
  'use strict';

  var dashboard = document.getElementById('dashboard');
  var loginPanel = document.getElementById('login-panel');
  var initialLoading = document.getElementById('initial-loading');
  var message = document.getElementById('message');
  var loginForm = document.getElementById('login-form');
  var password = document.getElementById('admin-password');
  var loginButton = document.getElementById('login-button');
  var logoutButton = document.getElementById('logout');
  var period = document.getElementById('period');
  var refreshButton = document.getElementById('refresh');
  var exportButton = document.getElementById('export');
  var currentEvents = [];
  var busy = false;
  var authenticated = false;
  var resourceTitles = Object.create(null);
  if (typeof LIBRARY !== 'undefined' && LIBRARY && Array.isArray(LIBRARY.resources)) {
    LIBRARY.resources.forEach(function (resource) {
      if (resource && typeof resource.id === 'string' && typeof resource.title === 'string' && resource.title.trim()) resourceTitles[resource.id] = resource.title;
    });
  }

  var metrics = [
    ['visitors', 'Visitors', 'Distinct analytics identifiers', 'people'],
    ['sessions', 'Sessions', 'Visits grouped into sessions', 'session'],
    ['pageViews', 'Page views', 'Recorded page openings', 'page'],
    ['sharedVisits', 'Shared-link visits', 'Visits with a share link identifier', 'link'],
    ['shareIntents', 'Share attempts', 'Started sharing or copied a link', 'share'],
    ['shareCompletions', 'Confirmed share actions', 'Confirmed copy actions, not delivery', 'check'],
    ['downloads', 'Saved downloads', 'Downloads confirmed saved in the app', 'download'],
    ['transfers', 'Received transfers', 'Nearby transfers confirmed received', 'transfer']
  ];

  var icons = {
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m4 10v-2a6 6 0 0 0-3-5"/>',
    session: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
    link: '<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    transfer: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>'
  };

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function count(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
  }

  function formatNumber(value) {
    return count(value).toLocaleString();
  }

  function readable(value) {
    if (!value) return '—';
    return String(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function formatDate(value, withTime) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, withTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function showMessage(text) {
    message.textContent = text || '';
    message.hidden = !text;
  }

  function setBusy(value) {
    busy = value;
    loginButton.disabled = value;
    password.disabled = value;
    logoutButton.disabled = value;
    refreshButton.disabled = value;
    period.disabled = value;
    exportButton.disabled = value || !currentEvents.length;
    dashboard.setAttribute('aria-busy', value ? 'true' : 'false');
  }

  function showLogin() {
    authenticated = false;
    dashboard.hidden = true;
    loginPanel.hidden = false;
    logoutButton.hidden = true;
    initialLoading.hidden = true;
    currentEvents = [];
    document.getElementById('events').textContent = '';
    exportButton.disabled = true;
  }

  function showDashboard() {
    authenticated = true;
    dashboard.hidden = false;
    loginPanel.hidden = true;
    logoutButton.hidden = false;
    initialLoading.hidden = true;
  }

  function request(options) {
    var url = '/api/admin' + (options ? '' : '?days=' + encodeURIComponent(period.value));
    var settings = { credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } };
    if (options) {
      settings.method = 'POST';
      settings.headers['Content-Type'] = 'application/json';
      settings.body = JSON.stringify(options);
    }
    return fetch(url, settings).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          var error = new Error(errorMessage(response.status, data));
          error.status = response.status;
          throw error;
        }
        return data;
      });
    }).catch(function (error) {
      if (error.status) throw error;
      throw new Error('The analytics server could not be reached. Check your connection and open this dashboard on the deployed online site.');
    });
  }

  function errorMessage(status, data) {
    if (status === 401) return 'Your admin session has ended. Sign in to continue.';
    if (status === 403) return data && typeof data.error === 'string' ? data.error.slice(0, 400) : 'The server could not authorize this request. Open the dashboard using its configured site address.';
    if (status === 429) return 'Too many sign-in attempts. Wait a few minutes before trying again.';
    if (status === 503) return (data && typeof data.error === 'string' ? data.error.slice(0, 400) : 'Admin analytics is not configured yet.') + ' Configure the required server environment variables and redeploy the online site.';
    if (status === 404) return 'The admin API is unavailable on this host. Open the dashboard on the deployed online site.';
    if (data && typeof data.error === 'string') return data.error.slice(0, 400);
    return 'Analytics could not be loaded. Please try again.';
  }

  function renderMetrics(summary) {
    document.getElementById('metrics').innerHTML = metrics.map(function (metric) {
      return '<article class="metric"><div class="metric-top"><h2 class="metric-label">' + metric[1] + '</h2><span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icons[metric[3]] + '</svg></span></div><p class="metric-value">' + formatNumber(summary[metric[0]]) + '</p><p class="metric-description">' + metric[2] + '</p></article>';
    }).join('');
  }

  function renderRank(id, values, emptyText, label, tooltip) {
    var rows = Array.isArray(values) ? values.filter(function (row) { return row && count(row.count) > 0; }).slice().sort(function (a, b) { return count(b.count) - count(a.count); }) : [];
    var maximum = rows.length ? count(rows[0].count) : 0;
    var target = document.getElementById(id);
    if (!rows.length) {
      target.innerHTML = '<p class="rank-list-empty">' + escapeHTML(emptyText) + '</p>';
      return;
    }
    target.innerHTML = rows.slice(0, 5).map(function (row) {
      var name = label ? label(row.name) : (row.name || 'Unknown');
      return '<div class="rank-row"><div class="rank-labels"><span class="rank-name" title="' + escapeHTML(tooltip ? tooltip(row.name) : name) + '">' + escapeHTML(name) + '</span><span class="rank-value">' + formatNumber(row.count) + '</span></div><div class="rank-bar" aria-hidden="true"><span style="width:' + (count(row.count) / maximum * 100).toFixed(2) + '%"></span></div></div>';
    }).join('') + (rows.length > 5 ? '<p class="rank-more">Showing the top 5 of ' + rows.length + '</p>' : '');
  }

  function countryName(value) {
    if (!value || /^(unknown|xx)$/i.test(value)) return 'Unknown';
    if (/^[a-z]{2}$/i.test(value) && typeof Intl.DisplayNames === 'function') {
      try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()); } catch (error) { /* Keep the provided value. */ }
    }
    return String(value);
  }

  function languageName(value) {
    if (!value || value === 'unknown') return 'Unknown';
    if (typeof Intl.DisplayNames === 'function') {
      try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(value); } catch (error) { /* Keep the provided value. */ }
    }
    return String(value);
  }

  function channelName(value) {
    var names = { native: 'Native share sheet', native_share: 'Native share sheet', clipboard: 'Copied link', copy: 'Copied link', copy_link: 'Copied link', whatsapp: 'WhatsApp', telegram: 'Telegram', facebook: 'Facebook', email: 'Email', sms: 'SMS', nearby: 'Nearby transfer', bluetooth: 'Bluetooth', wifi: 'Wi-Fi', sd_card: 'SD card', usb: 'USB', qr: 'QR code', guide: 'Sharing guide' };
    return names[value] || readable(value);
  }

  function statusName(value) {
    var names = { browser_handoff: 'Browser download · unverified', handed_off: 'Native share · unverified' };
    return names[value] || readable(value);
  }

  function resourceTitle(value) {
    return resourceTitles[value] || value || 'Unknown';
  }

  function resourceTooltip(value) {
    var title = resourceTitle(value);
    return title !== value ? title + ' · ' + value : title;
  }

  function referrerName(value) {
    if (!value) return 'Direct / unknown';
    try { return new URL(value).hostname || 'Direct / unknown'; } catch (error) { return String(value); }
  }

  function renderReferrers(events) {
    var counts = Object.create(null);
    events.forEach(function (event) {
      if (!/^(page_view|pageview)$/.test(event.type)) return;
      var name = referrerName(event.referrer);
      counts[name] = (counts[name] || 0) + 1;
    });
    renderRank('referrers', Object.keys(counts).map(function (name) { return { name: name, count: counts[name] }; }), 'No referring visits recorded yet.');
  }

  function renderChart(data) {
    var rows = Array.isArray(data) ? data.filter(function (row) { return row && !isNaN(new Date(row.date).getTime()); }).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }) : [];
    var target = document.getElementById('daily-chart');
    if (!rows.length) {
      target.innerHTML = '<p class="rank-list-empty">Daily activity will appear here after the first recorded visit.</p>';
      return;
    }
    var width = 650, height = 230, left = 68, right = 10, top = 18, bottom = 30;
    var innerWidth = width - left - right, innerHeight = height - top - bottom;
    var maximum = Math.max.apply(null, rows.map(function (row) { return Math.max(count(row.visits), count(row.shares)); }).concat([1]));
    var ceiling = maximum <= 4 ? 4 : Math.ceil(maximum / 4) * 4;
    function x(index) { return left + (rows.length === 1 ? innerWidth / 2 : index / (rows.length - 1) * innerWidth); }
    function y(value) { return top + innerHeight - count(value) / ceiling * innerHeight; }
    function points(key) { return rows.map(function (row, index) { return x(index).toFixed(2) + ',' + y(row[key]).toFixed(2); }).join(' '); }
    var grid = '';
    for (var level = 0; level <= 4; level++) {
      var value = ceiling / 4 * level;
      grid += '<line class="chart-grid" x1="' + left + '" x2="' + (width - right) + '" y1="' + y(value) + '" y2="' + y(value) + '"/><text class="chart-label" text-anchor="end" x="' + (left - 10) + '" y="' + (y(value) + 3) + '">' + formatNumber(value) + '</text>';
    }
    var labelIndices = [0];
    if (rows.length > 3) labelIndices.push(Math.floor((rows.length - 1) / 2));
    if (rows.length > 1) labelIndices.push(rows.length - 1);
    labelIndices.forEach(function (index) {
      grid += '<text class="chart-label" text-anchor="' + (index === 0 ? 'start' : (index === rows.length - 1 ? 'end' : 'middle')) + '" x="' + x(index) + '" y="' + (height - 6) + '">' + escapeHTML(formatDate(rows[index].date, false)) + '</text>';
    });
    var title = 'Daily recorded page views and share attempts. ' + rows.map(function (row) { return formatDate(row.date, false) + ': ' + count(row.visits) + ' page views, ' + count(row.shares) + ' share attempts'; }).join('; ');
    var area = x(0) + ',' + y(0) + ' ' + points('visits') + ' ' + x(rows.length - 1) + ',' + y(0);
    var dots = rows.length === 1 ? '<circle cx="' + x(0) + '" cy="' + y(rows[0].visits) + '" r="3.5" fill="#623278"/><circle cx="' + x(0) + '" cy="' + y(rows[0].shares) + '" r="3" fill="#409c80"/>' : '';
    target.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="daily-chart-title"><title id="daily-chart-title">' + escapeHTML(title) + '</title><defs><linearGradient id="visit-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9561ae" stop-opacity=".13"/><stop offset="100%" stop-color="#9561ae" stop-opacity="0"/></linearGradient></defs>' + grid + '<polygon class="chart-fill" points="' + area + '"/><polyline class="chart-visits" points="' + points('visits') + '"/><polyline class="chart-shares" points="' + points('shares') + '"/>' + dots + '</svg>';
  }

  function renderEvents(events, data) {
    var target = document.getElementById('events');
    currentEvents = events;
    document.getElementById('event-count').textContent = formatNumber(events.length) + ' event' + (events.length === 1 ? '' : 's') + ' shown · Times in your local timezone';
    document.getElementById('event-note').textContent = (data.recentEventsTruncated ? 'Showing and exporting the newest ' + formatNumber(events.length) + ' of ' + formatNumber(data.analyzedEvents) + ' analyzed events. ' : '') + 'CSV exports the events displayed here, including random visitor, session and share identifiers.';
    if (!events.length) {
      target.innerHTML = '<tr><td class="table-empty" colspan="7">No events in this period. Try a longer reporting period or check back after the next consented visit.</td></tr>';
      exportButton.disabled = true;
      return;
    }
    target.innerHTML = events.map(function (event) {
      var shareEvent = /share|transfer/.test(event.type);
      var statusClass = /^(complete|completed|success|copied|saved|received)$/.test(event.status) ? ' status-completed' : (/^(failed|cancelled|canceled|error|declined)$/.test(event.status) ? ' status-failed' : '');
      var resource = event.resource ? resourceTitle(event.resource) : event.path || '—';
      var tooltip = event.resource ? resourceTooltip(event.resource) : resource;
      return '<tr><td><span class="event-kind"><span class="event-dot' + (shareEvent ? ' share' : '') + '" aria-hidden="true"></span>' + escapeHTML(readable(event.type)) + '</span></td><td><time datetime="' + escapeHTML(event.at) + '">' + escapeHTML(formatDate(event.at, true)) + '</time></td><td><span class="cell-content" title="' + escapeHTML(tooltip) + '">' + escapeHTML(resource) + '</span>' + (event.resource && event.path ? '<span class="cell-content cell-secondary" title="' + escapeHTML(event.path) + '">' + escapeHTML(event.path) + '</span>' : '') + '</td><td>' + escapeHTML(event.channel ? channelName(event.channel) : '—') + (event.status ? '<br><span class="status' + statusClass + '">' + escapeHTML(statusName(event.status)) + '</span>' : '') + '</td><td>' + escapeHTML(event.language ? languageName(event.language) : '—') + '</td><td>' + escapeHTML(countryName(event.country)) + '</td><td><span class="cell-content cell-referrer" title="' + escapeHTML(referrerName(event.referrer)) + '">' + escapeHTML(referrerName(event.referrer)) + '</span></td></tr>';
    }).join('');
    exportButton.disabled = false;
  }

  function render(data) {
    var summary = data && data.summary;
    if (!summary || typeof summary !== 'object' || !Array.isArray(data.events)) throw new Error('The analytics server returned an unexpected response. Please refresh or check the server configuration.');
    var events = data.events.filter(function (event) { return event && typeof event === 'object'; }).slice().sort(function (a, b) { return (new Date(b.at).getTime() || 0) - (new Date(a.at).getTime() || 0); });
    renderMetrics(summary);
    renderChart(data.daily);
    renderRank('channels', data.channels, 'No sharing channels recorded yet.', channelName);
    renderRank('countries', data.countries, 'No country information available yet.', countryName);
    renderRank('languages', data.languages, 'No language activity recorded yet.', languageName);
    renderRank('resources', data.resources, 'No resource activity recorded yet.', resourceTitle, resourceTooltip);
    renderReferrers(events);
    renderEvents(events, data);
    var warning = document.getElementById('report-warning');
    warning.hidden = data.truncated !== true;
    warning.textContent = data.truncated === true ? 'Partial report: this period exceeds the server’s analysis limit. Counts and charts cover the newest ' + formatNumber(data.analyzedEvents || data.analysisLimit) + ' events, so totals may be lower than actual activity. Choose a shorter reporting period for a more complete view.' : '';
    document.getElementById('empty-overview').hidden = events.length > 0 || metrics.some(function (metric) { return count(summary[metric[0]]) > 0; });
    document.getElementById('report-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    document.getElementById('retention-note').textContent = 'Reports cover a ' + count(data.retentionDays || 90) + '-day activity window. Random browser identifiers may reset or be shared across multiple people, so visitor counts are estimates.';
    showDashboard();
  }

  function load() {
    if (busy) return Promise.resolve();
    var hadSession = authenticated;
    showMessage('');
    setBusy(true);
    return request().then(render).catch(function (error) {
      if (error.status === 401 || !authenticated) showLogin();
      if (error.status !== 401 || hadSession) showMessage(error.message);
    }).finally(function () {
      initialLoading.hidden = true;
      setBusy(false);
    });
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy || !password.value) return;
    showMessage('');
    var value = password.value;
    setBusy(true);
    var failed = false;
    request({ action: 'login', password: value }).then(function () {
      password.value = '';
      return request().then(render);
    }).catch(function (error) {
      failed = true;
      if (error.status === 401) showMessage('The password was not accepted. Please try again.');
      else showMessage(error.message);
    }).finally(function () { setBusy(false); if (failed) { password.focus(); password.select(); } });
  });

  logoutButton.addEventListener('click', function () {
    if (busy) return;
    showMessage('');
    setBusy(true);
    request({ action: 'logout' }).then(function () {
      showLogin();
      password.value = '';
    }).catch(function (error) { showMessage(error.message); }).finally(function () { setBusy(false); if (!authenticated) password.focus(); });
  });

  period.addEventListener('change', load);
  refreshButton.addEventListener('click', load);

  function csvCell(value) {
    var text = String(value == null ? '' : value).replace(/\u0000/g, '');
    // Prevent spreadsheet formulas even when an attacker prefixes whitespace.
    if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  exportButton.addEventListener('click', function () {
    if (!currentEvents.length || busy) return;
    var columns = ['id', 'type', 'at', 'path', 'language', 'resource', 'channel', 'status', 'country', 'referrer', 'shareId', 'visitorId', 'sessionId'];
    var rows = [columns.map(csvCell).join(',')].concat(currentEvents.map(function (event) {
      return columns.map(function (column) { return csvCell(event[column]); }).join(',');
    }));
    var blob = new Blob(['\uFEFF' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'easytransfer-events-' + period.value + 'days-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  load();
})();
