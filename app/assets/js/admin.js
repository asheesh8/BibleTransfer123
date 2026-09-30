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
  var filteredEvents = [];
  var reportData = {};
  var eventPage = 1;
  var expandedEvent = '';
  var pollTimer = null;
  var pollingInFlight = false;
  var pendingReload = false;
  var sessionVersion = 0;
  var lastFingerprint = '';
  var busy = false;
  var authenticated = false;
  var resourceTitles = Object.create(null);
  if (typeof LIBRARY !== 'undefined' && LIBRARY && Array.isArray(LIBRARY.resources)) {
    LIBRARY.resources.forEach(function (resource) {
      if (resource && typeof resource.id === 'string' && typeof resource.title === 'string' && resource.title.trim()) resourceTitles[resource.id] = resource.title;
    });
  }

  var metrics = [
    ['visitors', 'Visitor browsers', 'Anonymous browser IDs; approximate reach', 'people'],
    ['pageViews', 'Page views', 'Page openings, including repeat visits', 'page'],
    ['shareIntents', 'Share attempts', 'Link actions, guides and nearby offers', 'share'],
    ['sharedVisits', 'Shared-link visits', 'Recorded openings of attributed links', 'link']
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
    exportButton.disabled = value || !filteredEvents.length;
    dashboard.setAttribute('aria-busy', value ? 'true' : 'false');
  }

  function showLogin() {
    sessionVersion++;
    stopPolling();
    authenticated = false;
    dashboard.hidden = true;
    loginPanel.hidden = false;
    logoutButton.hidden = true;
    initialLoading.hidden = true;
    currentEvents = [];
    filteredEvents = [];
    reportData = {};
    lastFingerprint = '';
    document.getElementById('events').textContent = '';
    exportButton.disabled = true;
  }

  function showDashboard() {
    authenticated = true;
    dashboard.hidden = false;
    loginPanel.hidden = true;
    logoutButton.hidden = false;
    initialLoading.hidden = true;
    startPolling();
  }

  function stopPolling() {
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; }
  }

  function startPolling() {
    if (pollTimer === null) pollTimer = setInterval(function () {
      if (authenticated && !document.hidden && !busy && !pollingInFlight) load(true);
    }, 4000);
  }

  function updated() {
    document.getElementById('report-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' · Live every 4 seconds';
  }

  function countryLabel(value) {
    var code = String(value || '').toUpperCase();
    var flag = /^[A-Z]{2}$/.test(code) && code !== 'XX' ? String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) : '◎';
    return flag + ' ' + countryName(value);
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

  function percentage(value, total) {
    if (!total) return '0%';
    var number = count(value) / count(total) * 100;
    return number > 0 && number < 0.1 ? '<0.1%' : (Math.round(number * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
  }

  function positiveRows(values) {
    return Array.isArray(values) ? values.filter(function (row) { return row && count(row.count) > 0; }).slice().sort(function (a, b) { return count(b.count) - count(a.count); }) : [];
  }

  function sumRows(values) {
    return positiveRows(values).reduce(function (total, row) { return total + count(row.count); }, 0);
  }

  function totalFor(data, key, fallback) {
    if (data.breakdownTotals && Object.prototype.hasOwnProperty.call(data.breakdownTotals, key)) return count(data.breakdownTotals[key]);
    return fallback == null ? sumRows(data[key]) : count(fallback);
  }

  function metricHTML(label, value, description, icon, featured) {
    return '<article class="metric' + (featured ? ' metric-featured' : '') + '"><div class="metric-top"><h2 class="metric-label">' + escapeHTML(label) + '</h2><span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (icons[icon] || icons.page) + '</svg></span></div><p class="metric-value">' + escapeHTML(value) + '</p><p class="metric-description">' + escapeHTML(description) + '</p></article>';
  }

  function renderMetrics(summary, data) {
    document.getElementById('metrics').innerHTML = metrics.map(function (metric, index) {
      return metricHTML(metric[1], formatNumber(summary[metric[0]]), metric[2], metric[3], index === 0);
    }).join('');
    var coverage = data.coverage || {};
    document.getElementById('developer-metrics').innerHTML = [
      metricHTML('Country coverage', Array.isArray(data.countries) && data.coverage ? percentage(coverage.pageViewsWithCountry, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithCountry) + ' page views with host country', 'people'),
      metricHTML('Referrer coverage', data.coverage ? percentage(coverage.pageViewsWithReferrer, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithReferrer) + ' page views with a referrer', 'link'),
      metricHTML('Error events', data.coverage ? formatNumber(coverage.errorEvents) : '—', 'Recorded errors, not an error rate', 'transfer'),
      metricHTML('Cancelled events', data.coverage ? formatNumber(coverage.cancelledEvents) : '—', 'Recorded cancellations or declines', 'session')
    ].join('');
  }

  function countryName(value) {
    if (!value || /^(unknown|xx)$/i.test(value)) return 'Unknown';
    if (/^[a-z]{2}$/i.test(value) && typeof Intl.DisplayNames === 'function') {
      try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()); } catch (error) { /* Keep the provided value. */ }
    }
    return String(value);
  }

  function languageName(value) {
    if (!value || /^(unknown|unspecified)$/i.test(value)) return 'Unspecified';
    if (typeof LIBRARY !== 'undefined' && LIBRARY && LIBRARY.languages && LIBRARY.languages[value] && LIBRARY.languages[value].name) return LIBRARY.languages[value].name;
    if (typeof Intl.DisplayNames === 'function') {
      try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(value); } catch (error) { /* Keep the provided value. */ }
    }
    return String(value);
  }

  function channelName(value) {
    var names = { native: 'Native share sheet', 'web-share': 'Native share sheet', native_share: 'Native share sheet', clipboard: 'Copied link', copy: 'Copied link', 'copy-link': 'Copied link', copy_link: 'Copied link', whatsapp: 'WhatsApp', telegram: 'Telegram', facebook: 'Facebook', email: 'Email', sms: 'SMS', nearby: 'Nearby transfer', bluetooth: 'Bluetooth', wifi: 'Wi-Fi', sd_card: 'SD card', usb: 'USB', qr: 'QR code', guide: 'Sharing guide', unknown: 'Unknown method' };
    return names[value] || readable(value);
  }

  function statusName(value) {
    var names = { browser_handoff: 'Browser download · unverified', handed_off: 'Native share · unverified', guide_opened: 'Guide opened', unspecified: 'Unspecified', '_unspecified': 'No status' };
    return names[value] || readable(value);
  }

  function eventTypeName(value) {
    var names = { share_complete: 'Share action result', download_complete: 'Download result', transfer_complete: 'Transfer result', play_complete: 'Playback ended', resource_open: 'Resource opened', external_open: 'External link opened' };
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

  function unavailable(id) {
    document.getElementById(id).innerHTML = '<p class="rank-list-empty">This breakdown is not available in this server response. Update the analytics API to show it here.</p>';
  }

  function renderRank(id, values, emptyText, label, tooltip, total, limit) {
    if (!Array.isArray(values)) { unavailable(id); return; }
    var rows = positiveRows(values);
    var maximum = rows.length ? count(rows[0].count) : 0;
    var shown = rows.slice(0, limit || 6);
    var target = document.getElementById(id);
    if (!rows.length) { target.innerHTML = '<p class="rank-list-empty">' + escapeHTML(emptyText) + '</p>'; return; }
    target.innerHTML = shown.map(function (row, index) {
      var name = label ? label(row.name) : (row.name || 'Unknown');
      return '<div class="rank-row"><div class="rank-labels"><span class="rank-name" title="' + escapeHTML(tooltip ? tooltip(row.name) : name) + '"><span class="rank-position" aria-hidden="true">' + (index + 1) + '</span>' + escapeHTML(name) + '</span><span class="rank-value">' + formatNumber(row.count) + (total ? '<span class="rank-percent">' + escapeHTML(percentage(row.count, total)) + '</span>' : '') + '</span></div><div class="rank-bar" aria-hidden="true"><span style="width:' + (count(row.count) / maximum * 100).toFixed(2) + '%"></span></div></div>';
    }).join('') + (rows.length > shown.length ? '<p class="rank-more">Showing the top ' + shown.length + ' categories from this report.</p>' : '');
  }

  function renderDonut(id, values, total, label, unit, emptyText) {
    if (!Array.isArray(values)) { unavailable(id); return; }
    var rows = positiveRows(values).slice(0, 5);
    var represented = sumRows(rows);
    total = Math.max(count(total), represented);
    var other = Math.max(0, total - represented);
    if (other) rows.push({ name: 'Other', count: other });
    var colors = ['#66327c', '#9b72b2', '#419579', '#d7a343', '#5b8fab', '#b8afc1'];
    var circumference = 2 * Math.PI * 56;
    var offset = 0;
    var description = total ? rows.map(function (row) { return (label ? label(row.name) : row.name) + ': ' + formatNumber(row.count) + ' (' + percentage(row.count, total) + ')'; }).join('; ') : emptyText;
    var segments = rows.map(function (row, index) {
      var length = count(row.count) / total * circumference;
      var segment = '<circle class="donut-segment" cx="80" cy="80" r="56" fill="none" stroke="' + colors[index] + '" stroke-width="18" stroke-dasharray="' + length.toFixed(3) + ' ' + (circumference - length).toFixed(3) + '" stroke-dashoffset="' + (-offset).toFixed(3) + '" transform="rotate(-90 80 80)"><title>' + escapeHTML((label ? label(row.name) : row.name) + ': ' + formatNumber(row.count) + ' (' + percentage(row.count, total) + ')') + '</title></circle>';
      offset += length;
      return segment;
    }).join('');
    document.getElementById(id).innerHTML = '<div class="donut-visual"><svg viewBox="0 0 160 160" role="img" aria-labelledby="' + id + '-chart-title"><title id="' + id + '-chart-title">' + escapeHTML(description) + '</title><circle cx="80" cy="80" r="56" fill="none" stroke="#f0eaf4" stroke-width="18"/>' + segments + '</svg><div class="donut-center" aria-hidden="true"><strong>' + formatNumber(total) + '</strong><span>' + escapeHTML(unit) + '</span></div></div>' + (total ? '<ul class="donut-legend">' + rows.map(function (row, index) {
      return '<li><span class="donut-name"><i style="background:' + colors[index] + '" aria-hidden="true"></i><span title="' + escapeHTML(label ? label(row.name) : row.name) + '">' + escapeHTML(label ? label(row.name) : row.name) + '</span></span><span class="donut-value">' + formatNumber(row.count) + '<span>' + escapeHTML(percentage(row.count, total)) + '</span></span></li>';
    }).join('') + '</ul>' : '<p class="donut-empty">' + escapeHTML(emptyText) + '</p>');
  }

  function renderInsights(data) {
    var summary = data.summary;
    var insights = [];
    var language = positiveRows(data.languages).filter(function (row) { return !/^(unknown|unspecified)$/i.test(row.name); })[0];
    var resource = positiveRows(data.resources)[0];
    if (language && count(summary.pageViews)) insights.push(['Leading library language', languageName(language.name) + ' accounts for ' + percentage(language.count, summary.pageViews) + ' of recorded page views (' + formatNumber(language.count) + ').']);
    if (resource) insights.push(['Most explored resource', resourceTitle(resource.name) + ' was opened ' + formatNumber(resource.count) + (count(resource.count) === 1 ? ' time.' : ' times.')]);
    if (count(summary.sharedVisits)) insights.push(['Shared links are being opened', formatNumber(summary.sharedVisits) + ' page openings arrived with a share-link identifier in this period.']);
    else if (count(summary.shareIntents)) insights.push(['Sharing activity is starting', formatNumber(summary.shareIntents) + ' share attempts were recorded. Shared-link visits have not appeared in this period yet.']);
    if (!insights.length && count(summary.pageViews)) insights.push(['The library is being explored', formatNumber(summary.pageViews) + ' page openings were recorded across ' + formatNumber(summary.sessions) + ' sessions. More activity will reveal language and resource preferences.']);
    document.getElementById('insights').innerHTML = insights.length ? insights.slice(0, 3).map(function (insight, index) {
      return '<article class="insight"><span class="insight-number" aria-hidden="true">0' + (index + 1) + '</span><div><h3>' + escapeHTML(insight[0]) + '</h3><p>' + escapeHTML(insight[1]) + '</p></div></article>';
    }).join('') : '<div class="insight-empty"><span aria-hidden="true">✧</span><h3>Ready for the next visit.</h3><p>Observations will appear after consented online activity is recorded. There are no assumptions or sample counts in this report.</p></div>';
  }

  function renderSignals(data) {
    var summary = data.summary;
    var values = [
      ['Confirmed share actions', summary.shareCompletions, 'Includes locally confirmed copied links', 'check'],
      ['Files saved', summary.downloads, 'Download saves confirmed in the app', 'download'],
      ['Nearby batches received', summary.transfers, 'Receiver confirmed the data arrived', 'transfer'],
      ['Resource openings', totalFor(data, 'resources'), 'Recorded openings, including repeats', 'page']
    ];
    document.getElementById('sharing-signals').innerHTML = values.map(function (item) {
      return '<div class="signal"><span class="signal-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icons[item[3]] + '</svg></span><div><h3>' + item[0] + '</h3><p>' + item[2] + '</p></div><strong>' + formatNumber(item[1]) + '</strong></div>';
    }).join('');
  }

  function renderChart(data) {
    var rows = Array.isArray(data) ? data.filter(function (row) { return row && !isNaN(new Date(row.date).getTime()); }).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }) : [];
    var target = document.getElementById('daily-chart');
    document.getElementById('daily-data').innerHTML = rows.length ? '<table><caption class="sr-only">Daily activity in UTC</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Page views</th><th scope="col">Share attempts</th></tr></thead><tbody>' + rows.map(function (row) { return '<tr><th scope="row">' + escapeHTML(row.date) + '</th><td>' + formatNumber(row.visits) + '</td><td>' + formatNumber(row.shares) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="rank-list-empty">No daily records available yet.</p>';
    if (!rows.length) { target.innerHTML = '<p class="rank-list-empty">Daily activity will appear here after the first recorded visit.</p>'; return; }
    var width = 650, height = 235, left = 68, right = 10, top = 18, bottom = 30;
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
    labelIndices.forEach(function (index) { grid += '<text class="chart-label" text-anchor="' + (index === 0 ? 'start' : (index === rows.length - 1 ? 'end' : 'middle')) + '" x="' + x(index) + '" y="' + (height - 6) + '">' + escapeHTML(formatDate(rows[index].date, false)) + '</text>'; });
    var title = 'Daily recorded page views and share attempts in UTC. ' + rows.map(function (row) { return formatDate(row.date, false) + ': ' + count(row.visits) + ' page views, ' + count(row.shares) + ' share attempts'; }).join('; ');
    var area = x(0) + ',' + y(0) + ' ' + points('visits') + ' ' + x(rows.length - 1) + ',' + y(0);
    var dots = rows.length === 1 ? '<circle cx="' + x(0) + '" cy="' + y(rows[0].visits) + '" r="3.5" fill="#623278"/><circle cx="' + x(0) + '" cy="' + y(rows[0].shares) + '" r="3" fill="#409c80"/>' : '';
    target.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-labelledby="daily-chart-title"><title id="daily-chart-title">' + escapeHTML(title) + '</title><defs><linearGradient id="visit-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9561ae" stop-opacity=".19"/><stop offset="100%" stop-color="#9561ae" stop-opacity=".01"/></linearGradient></defs>' + grid + '<polygon class="chart-fill" points="' + area + '"/><polyline class="chart-visits" points="' + points('visits') + '"/><polyline class="chart-shares" points="' + points('shares') + '"/>' + dots + '</svg>';
  }

  function populateFilter(id, key, label, allLabel) {
    var target = document.getElementById(id);
    var prior = target.value;
    var values = Object.create(null);
    currentEvents.forEach(function (event) { values[event[key] || '_unspecified'] = true; });
    target.innerHTML = '<option value="">' + allLabel + '</option>' + Object.keys(values).sort().map(function (value) { return '<option value="' + escapeHTML(value) + '">' + escapeHTML(value === '_unspecified' ? 'Not specified' : label(value)) + '</option>'; }).join('');
    if (prior && !values[prior]) target.innerHTML += '<option value="' + escapeHTML(prior) + '">' + escapeHTML(label(prior)) + ' (no recent records)</option>';
    target.value = prior || '';
  }

  function eventDetails(event) {
    var fields = [['Event ID', event.id], ['Visitor browser ID', event.visitorId], ['Session ID', event.sessionId], ['Share link ID', event.shareId], ['Resource ID', event.resource], ['Page path', event.path], ['Event type', event.type], ['Status', event.status], ['Channel', event.channel], ['Recorded at (UTC)', event.at], ['Referrer', event.referrer], ['Size (bytes)', event.bytes], ['Playback position (seconds)', event.duration]];
    return '<dl class="event-details">' + fields.filter(function (field) { return field[1] !== undefined && field[1] !== null && field[1] !== ''; }).map(function (field) { return '<div><dt>' + field[0] + '</dt><dd>' + escapeHTML(field[1]) + '</dd></div>'; }).join('') + '</dl>';
  }

  function renderExplorer() {
    var search = document.getElementById('event-search').value.trim().toLowerCase();
    var type = document.getElementById('event-filter-type').value;
    var channel = document.getElementById('event-filter-channel').value;
    var status = document.getElementById('event-filter-status').value;
    filteredEvents = currentEvents.filter(function (event) {
      if (type && (event.type || '_unspecified') !== type) return false;
      if (channel && (event.channel || '_unspecified') !== channel) return false;
      if (status && (event.status || '_unspecified') !== status) return false;
      if (!search) return true;
      return [event.id, event.type, event.path, event.resource, resourceTitle(event.resource), event.channel, channelName(event.channel), event.status, statusName(event.status), event.language, languageName(event.language), event.country, countryName(event.country), event.referrer, event.shareId, event.visitorId, event.sessionId].join(' ').toLowerCase().indexOf(search) !== -1;
    });
    var pageSize = [10, 25, 50].indexOf(Number(document.getElementById('event-page-size').value)) !== -1 ? Number(document.getElementById('event-page-size').value) : 25;
    var pages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
    eventPage = Math.min(Math.max(eventPage, 1), pages);
    var first = (eventPage - 1) * pageSize;
    var shown = filteredEvents.slice(first, first + pageSize);
    document.getElementById('event-count').textContent = filteredEvents.length ? 'Showing ' + formatNumber(first + 1) + '–' + formatNumber(first + shown.length) + ' of ' + formatNumber(filteredEvents.length) + ' matching recent events · Local times' : '0 matching recent events';
    document.getElementById('event-page-label').textContent = 'Page ' + eventPage + ' of ' + pages;
    document.getElementById('event-prev').disabled = eventPage <= 1;
    document.getElementById('event-next').disabled = eventPage >= pages;
    exportButton.disabled = busy || !filteredEvents.length;
    document.getElementById('event-note').textContent = (reportData.recentEventsTruncated ? 'Available: the newest ' + formatNumber(currentEvents.length) + ' of ' + formatNumber(reportData.analyzedEvents) + ' analyzed events. ' : 'Available: ' + formatNumber(currentEvents.length) + ' recent events. ') + 'CSV exports all ' + formatNumber(filteredEvents.length) + ' matching records, including anonymous browser, session and share identifiers. Filters do not change the aggregate charts.';
    document.getElementById('events').innerHTML = shown.length ? shown.map(function (event) {
      var index = currentEvents.indexOf(event);
      var isExpanded = expandedEvent === event.id;
      var shareEvent = /share|transfer/.test(event.type);
      var statusClass = /^(complete|completed|success|copied|saved|received)$/.test(event.status) ? ' status-completed' : (/^(failed|cancelled|canceled|error|declined)$/.test(event.status) ? ' status-failed' : '');
      var resource = event.resource ? resourceTitle(event.resource) : event.path || '—';
      var tooltip = event.resource ? resourceTooltip(event.resource) : resource;
      return '<tr><td><span class="event-kind"><span class="event-dot' + (shareEvent ? ' share' : '') + '" aria-hidden="true"></span>' + escapeHTML(eventTypeName(event.type)) + '</span></td><td><time datetime="' + escapeHTML(event.at) + '">' + escapeHTML(formatDate(event.at, true)) + '</time></td><td><span class="cell-content" title="' + escapeHTML(tooltip) + '">' + escapeHTML(resource) + '</span>' + (event.resource && event.path ? '<span class="cell-content cell-secondary" title="' + escapeHTML(event.path) + '">' + escapeHTML(event.path) + '</span>' : '') + '</td><td>' + escapeHTML(event.channel ? channelName(event.channel) : '—') + (event.status ? '<br><span class="status' + statusClass + '">' + escapeHTML(statusName(event.status)) + '</span>' : '') + '</td><td>' + escapeHTML(event.language ? languageName(event.language) : '—') + '<div class="cell-secondary">' + escapeHTML(countryName(event.country)) + '</div></td><td><span class="cell-content cell-referrer" title="' + escapeHTML(referrerName(event.referrer)) + '">' + escapeHTML(referrerName(event.referrer)) + '</span></td><td><button class="event-detail-button" type="button" id="event-detail-button-' + index + '" data-event-details="' + index + '" aria-expanded="' + isExpanded + '" aria-controls="event-detail-' + index + '" aria-label="' + (isExpanded ? 'Hide' : 'Show') + ' details for ' + escapeHTML(eventTypeName(event.type)) + '">' + (isExpanded ? '−' : '+') + '</button></td></tr><tr class="event-detail-row" id="event-detail-' + index + '"' + (isExpanded ? '' : ' hidden') + '><td colspan="7">' + eventDetails(event) + '</td></tr>';
    }).join('') : '<tr><td class="table-empty" colspan="7">' + (currentEvents.length ? 'No matching events. Try another keyword or clear the filters.' : 'No events in this period. Try a longer reporting period or check back after the next consented visit.') + '</td></tr>';
  }

  function renderMetadata(data) {
    var coverage = data.coverage;
    var rows = [
      ['Reporting period', count(data.periodDays || period.value) + ' days · ' + (data.reportingTimezone || 'UTC')],
      ['Generated', data.generatedAt || 'Not supplied by this server'],
      ['Analyzed events', formatNumber(data.analyzedEvents == null ? currentEvents.length : data.analyzedEvents)],
      ['Recent events available', formatNumber(currentEvents.length) + (data.recentEventsTruncated ? ' · newest records only' : '')],
      ['Report completeness', data.truncated ? 'Partial · analysis limit reached' : 'Complete analyzed period'],
      ['Analysis limit', data.analysisLimit ? formatNumber(data.analysisLimit) + ' events' : 'Not supplied by this server'],
      ['Activity window', count(data.retentionDays || 90) + ' days'],
      ['Sessions', formatNumber(data.summary.sessions)],
      ['Distinct resources in activity', coverage ? formatNumber(coverage.distinctResources) : 'Not supplied by this server'],
      ['Shared visits with a share ID', coverage ? formatNumber(coverage.sharedVisitsWithShareId) : 'Not supplied by this server']
    ];
    document.getElementById('report-metadata').innerHTML = rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + escapeHTML(row[1]) + '</dd></div>'; }).join('');
  }

  function render(data) {
    var summary = data && data.summary;
    if (!summary || typeof summary !== 'object' || !Array.isArray(data.events)) throw new Error('The analytics server returned an unexpected response. Please refresh or check the server configuration.');
    reportData = data;
    currentEvents = data.events.filter(function (event) { return event && typeof event === 'object'; }).slice().sort(function (a, b) { return (new Date(b.at).getTime() || 0) - (new Date(a.at).getTime() || 0); });
    renderMetrics(summary, data);
    renderChart(data.daily);
    renderDonut('channels', data.channels, totalFor(data, 'channels', summary.shareIntents), channelName, 'attempts', 'No sharing activity recorded in this period.');
    renderDonut('countries', data.countries, totalFor(data, 'countries', summary.pageViews), countryLabel, 'page views', 'No recorded page views to show by country yet.');
    renderDonut('languages', data.languages, totalFor(data, 'languages', summary.pageViews), languageName, 'page views', 'No recorded page views to show by language yet.');
    renderRank('resources', data.resources, 'No resource openings recorded yet.', resourceTitle, resourceTooltip, totalFor(data, 'resources'), 7);
    renderInsights(data);
    renderSignals(data);
    renderRank('event-types', data.eventTypes, 'No event types recorded yet.', eventTypeName, null, totalFor(data, 'eventTypes'), 7);
    renderRank('statuses', data.statuses, 'No event statuses recorded yet.', statusName, null, totalFor(data, 'statuses'), 7);
    renderDonut('share-outcomes', data.shareOutcomes, totalFor(data, 'shareOutcomes'), statusName, 'events', 'No terminal share actions recorded yet.');
    renderDonut('download-outcomes', data.downloadOutcomes, totalFor(data, 'downloadOutcomes'), statusName, 'files / events', 'No terminal download events recorded yet.');
    renderDonut('transfer-outcomes', data.transferOutcomes, totalFor(data, 'transferOutcomes'), statusName, 'batch events', 'No terminal transfer events recorded yet.');
    renderRank('pages', data.pages, 'No page views recorded yet.', null, null, totalFor(data, 'pages', summary.pageViews), 7);
    renderRank('referrers', data.referrers, 'No referring page views recorded yet.', referrerName, null, totalFor(data, 'referrers', summary.pageViews), 7);
    populateFilter('event-filter-type', 'type', eventTypeName, 'All types');
    populateFilter('event-filter-channel', 'channel', channelName, 'All channels');
    populateFilter('event-filter-status', 'status', statusName, 'All statuses');
    renderExplorer();
    if (typeof window !== 'undefined' && window.EasyTransferAdminJourneys) window.EasyTransferAdminJourneys.render(currentEvents, {resourceTitle: resourceTitle, languageName: languageName, countryName: countryName});
    renderMetadata(data);
    var warning = document.getElementById('report-warning');
    warning.hidden = data.truncated !== true;
    warning.textContent = data.truncated === true ? 'Partial report: this period exceeds the server’s analysis limit. Counts and charts cover the newest ' + formatNumber(data.analyzedEvents || data.analysisLimit) + ' events, so totals may be lower than actual activity. Choose a shorter reporting period for a more complete view.' : '';
    document.getElementById('empty-overview').hidden = currentEvents.length > 0 || metrics.some(function (metric) { return count(summary[metric[0]]) > 0; });
    updated();
    document.getElementById('retention-note').textContent = 'Reports cover a ' + count(data.retentionDays || 90) + '-day activity window. Random browser identifiers may reset or be shared across multiple people, so visitor counts are estimates.';
    showDashboard();
  }

  function load(silent) {
    silent = silent === true;
    if (busy || pollingInFlight) { if (!silent) { pendingReload = true; exportButton.disabled = true; } return Promise.resolve(); }
    var hadSession = authenticated;
    var version = sessionVersion;
    var requestedPeriod = period.value;
    pollingInFlight = true;
    if (!silent) { showMessage(''); setBusy(true); }
    return request().then(function (data) {
      if (version !== sessionVersion || requestedPeriod !== period.value) return;
      var fingerprint = JSON.stringify(data, function (key, value) { return key === 'generatedAt' ? undefined : value; });
      if (fingerprint !== lastFingerprint) { render(data); lastFingerprint = fingerprint; }
      else { reportData = data; renderMetadata(data); updated(); }
      showMessage('');
    }).catch(function (error) {
      if (version !== sessionVersion || requestedPeriod !== period.value) return;
      if (error.status === 401 || !authenticated) showLogin();
      if (error.status !== 401 || hadSession) showMessage(silent && error.status !== 401 ? 'Automatic update paused by a connection error. Showing the last successful report. ' + error.message : error.message);
    }).finally(function () {
      pollingInFlight = false;
      initialLoading.hidden = true;
      if (!silent) setBusy(false);
      if (pendingReload && authenticated) { pendingReload = false; load(); }
    });
  }

  function switchView(developer, focus) {
    ['overview', 'developer'].forEach(function (name) {
      var selected = (name === 'developer') === developer;
      var tab = document.getElementById(name + '-tab');
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      document.getElementById(name + '-panel').hidden = !selected;
      if (selected && focus) tab.focus();
    });
  }
  ['overview', 'developer'].forEach(function (name) {
    var tab = document.getElementById(name + '-tab');
    tab.addEventListener('click', function () { switchView(name === 'developer'); });
    tab.addEventListener('keydown', function (event) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
      event.preventDefault();
      switchView(event.key === 'End' || (event.key !== 'Home' && name === 'overview'), true);
    });
  });
  ['event-search', 'event-filter-type', 'event-filter-channel', 'event-filter-status', 'event-page-size'].forEach(function (id) {
    document.getElementById(id).addEventListener(id === 'event-search' ? 'input' : 'change', function () { eventPage = 1; renderExplorer(); });
  });
  document.getElementById('event-clear').addEventListener('click', function () {
    ['event-search', 'event-filter-type', 'event-filter-channel', 'event-filter-status'].forEach(function (id) { document.getElementById(id).value = ''; });
    eventPage = 1; renderExplorer();
  });
  document.getElementById('event-prev').addEventListener('click', function () { eventPage--; renderExplorer(); });
  document.getElementById('event-next').addEventListener('click', function () { eventPage++; renderExplorer(); });
  document.getElementById('events').addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-event-details]') : null;
    if (!button) return;
    var record = currentEvents[Number(button.getAttribute('data-event-details'))];
    if (!record) return;
    expandedEvent = expandedEvent === record.id ? '' : record.id;
    renderExplorer();
    document.getElementById(button.id).focus();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && authenticated) load(true); });

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
    sessionVersion++;
    stopPolling();
    request({ action: 'logout' }).then(function () {
      showLogin();
      password.value = '';
    }).catch(function (error) { showMessage(error.message); if (authenticated) startPolling(); }).finally(function () { setBusy(false); if (!authenticated) password.focus(); });
  });

  period.addEventListener('change', function () { eventPage = 1; expandedEvent = ''; load(); });
  refreshButton.addEventListener('click', load);

  function csvCell(value) {
    var text = String(value == null ? '' : value).replace(/\u0000/g, '');
    // Prevent spreadsheet formulas even when an attacker prefixes whitespace.
    if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  exportButton.addEventListener('click', function () {
    if (!filteredEvents.length || busy || exportButton.disabled) return;
    var columns = ['id', 'type', 'at', 'path', 'language', 'resource', 'channel', 'status', 'country', 'referrer', 'shareId', 'visitorId', 'sessionId', 'bytes', 'duration'];
    var rows = [columns.map(csvCell).join(',')].concat(filteredEvents.map(function (event) {
      return columns.map(function (column) { return csvCell(event[column]); }).join(',');
    }));
    var blob = new Blob(['\uFEFF' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'easytransfer-events-' + count(reportData.periodDays || period.value) + 'days-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  load();
})();
