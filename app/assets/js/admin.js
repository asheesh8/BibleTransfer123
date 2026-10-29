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

  // Catalogue lookups so reports show titles, kinds and language names.
  var resourceTitles = Object.create(null);
  var resourceInfo = Object.create(null);
  if (typeof LIBRARY !== 'undefined' && LIBRARY && Array.isArray(LIBRARY.resources)) {
    LIBRARY.resources.forEach(function (resource) {
      if (!resource || typeof resource.id !== 'string') return;
      if (typeof resource.title === 'string' && resource.title.trim()) resourceTitles[resource.id] = resource.title;
      resourceInfo[resource.id] = { type: resource.type, lang: resource.lang };
    });
  }
  var typeNames = { film: 'Films', 'audio-bible': 'Audio Bibles', audio: 'Audio teaching', scripture: 'Scripture', historic: 'Historic scans', book: 'Books', link: 'Partner links' };

  var views = ['overview', 'people', 'content', 'sharing', 'activity', 'developer'];

  // Headline numbers. Selecting one charts it day by day (daily key, label,
  // totals key, unit, chart title).
  var metrics = [
    ['visitors', 'Visitors', 'visitors', 'visitor browsers', 'Visitors per day'],
    ['visits', 'Page views', 'pageViews', 'page views', 'Page views per day'],
    ['opens', 'Opened', 'opens', 'items opened', 'Items opened per day'],
    ['plays', 'Plays', 'plays', 'plays', 'Plays per day'],
    ['saves', 'Saved', 'saves', 'saves', 'Files saved or received per day'],
    ['shares', 'Shares', 'shares', 'share attempts', 'Share attempts per day']
  ];
  var trendMetric = 'visitors';

  // Report-wide filters, sent to the server so every number agrees.
  var filterRules = {
    country: /^(?:[A-Z]{2}|Unknown)$/,
    language: /^(?:[a-z]{3}|Unspecified)$/,
    resource: /^[A-Za-z0-9][A-Za-z0-9_.-]{0,199}$/,
    visitor: /^[A-Za-z0-9_-]{8,80}$/
  };
  var filterOrder = ['country', 'language', 'resource', 'visitor'];
  var filters = {};

  // Tabbed dashboard cards: card id → [tab key, label] and the selected tab.
  var cardTabs = {
    'top-content': [['opens', 'Opened'], ['plays', 'Played'], ['saves', 'Saved'], ['shares', 'Shared']],
    'top-places': [['countries', 'Countries'], ['languages', 'Languages'], ['platforms', 'Website / apps']],
    'top-sources': [['referrers', 'Referrers'], ['channels', 'Share methods'], ['qr', 'QR scans']]
  };
  var cardSelected = { 'top-content': 'opens', 'top-places': 'countries', 'top-sources': 'referrers' };

  var sortState = {
    'people-table': { key: 'lastSeen', dir: -1 },
    'country-table': { key: 'visitors', dir: -1 },
    'language-table': { key: 'visitors', dir: -1 },
    'resource-table': { key: 'opens', dir: -1 }
  };
  var tableLimits = { 'people-table': 25, 'country-table': 10, 'language-table': 10, 'resource-table': 25 };
  var tableStep = { 'people-table': 25, 'country-table': 25, 'language-table': 25, 'resource-table': 25 };

  /* ---------- Formatting ---------- */

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

  function plural(value, one, many) {
    return formatNumber(value) + ' ' + (count(value) === 1 ? one : many);
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

  function formatTime(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? '—' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function percentage(value, total) {
    if (!total) return '0%';
    var number = count(value) / count(total) * 100;
    return number > 0 && number < 0.1 ? '<0.1%' : (Math.round(number * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%';
  }

  function hourLabel(hour) {
    return ('0' + hour).slice(-2) + ':00';
  }

  function countryName(value) {
    if (!value || /^(unknown|xx)$/i.test(value)) return 'Unknown';
    if (/^[a-z]{2}$/i.test(value) && typeof Intl.DisplayNames === 'function') {
      try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(value.toUpperCase()); } catch (error) { /* Keep the provided value. */ }
    }
    return String(value);
  }

  function countryFlag(value) {
    var code = String(value || '').toUpperCase();
    return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) : '◎';
  }

  function countryLabel(value) {
    return countryFlag(value) + ' ' + countryName(value);
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

  function platformName(value) {
    return { web: 'Website', ios: 'iPhone app', android: 'Android app' }[value] || readable(value);
  }

  function statusName(value) {
    var names = { browser_handoff: 'Browser download · unverified', handed_off: 'Native share · unverified', guide_opened: 'Guide opened', sent: 'Sent',  unspecified: 'Unspecified', '_unspecified': 'No status' };
    return names[value] || readable(value);
  }

  function eventTypeName(value) {
    var names = { page_view: 'Viewed a page', session_start: 'Started a visit', resource_open: 'Opened', play: 'Played', play_complete: 'Finished playing', share_intent: 'Started a share', share_complete: 'Share action result', share_cancel: 'Cancelled a share', shared_visit: 'Arrived from a shared link', download_start: 'Started a download', download_complete: 'Download result', download_cancel: 'Cancelled a download', download_error: 'Download failed', transfer_complete: 'Transfer result', transfer_error: 'Transfer failed', language_change: 'Changed language', external_open: 'Opened an external link' };
    return names[value] || readable(value);
  }

  function resourceTitle(value) {
    return resourceTitles[value] || value || 'Unknown';
  }

  function resourceTooltip(value) {
    var title = resourceTitle(value);
    return title !== value ? title + ' · ' + value : title;
  }

  function resourceMeta(id) {
    var info = resourceInfo[id];
    if (!info) return '';
    return [info.lang ? languageName(info.lang) : '', typeNames[info.type] || readable(info.type)].filter(Boolean).join(' · ');
  }

  function referrerName(value) {
    if (!value || value === 'Direct / unknown') return 'Direct / unknown';
    try { return new URL(value).hostname || 'Direct / unknown'; } catch (error) { return String(value); }
  }

  // A short, stable handle for an anonymous browser ID.
  function browserName(id) {
    return 'Browser ' + String(id || '').slice(-6).toUpperCase();
  }

  function filterLabel(name, value) {
    if (name === 'country') return countryLabel(value);
    if (name === 'language') return languageName(value);
    if (name === 'resource') return resourceTitle(value);
    return browserName(value);
  }

  /* ---------- Data helpers ---------- */

  function emptyHTML(title, text) {
    return '<div class="empty-state"><p><strong>' + escapeHTML(title) + '</strong>' + (text ? ' ' + escapeHTML(text) : '') + '</p></div>';
  }

  function unavailable(id) {
    document.getElementById(id).innerHTML = emptyHTML('Not available yet.', 'This part needs the updated analytics API. It appears after the next deploy.');
  }

  function dailyRows(data) {
    return Array.isArray(data.daily) ? data.daily.filter(function (row) { return row && !isNaN(new Date(row.date).getTime()); }).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }) : [];
  }

  function positiveRows(values) {
    return Array.isArray(values) ? values.filter(function (row) { return row && count(row.count) > 0; }).slice().sort(function (a, b) { return count(b.count) - count(a.count); }) : [];
  }

  function tableRows(values, key) {
    return Array.isArray(values) ? values.filter(function (row) { return row && typeof row === 'object'; }).map(function (row) {
      return { name: row.name, count: count(row[key]), extra: row };
    }) : null;
  }

  function totalFor(data, key, fallback) {
    if (data.breakdownTotals && Object.prototype.hasOwnProperty.call(data.breakdownTotals, key)) return count(data.breakdownTotals[key]);
    if (fallback != null) return count(fallback);
    return positiveRows(data[key]).reduce(function (total, row) { return total + count(row.count); }, 0);
  }

  // Older servers send no totals; derive what the summary can support.
  function totalsOf(data) {
    if (data.totals && typeof data.totals === 'object') return data.totals;
    var summary = data.summary || {};
    return { visitors: summary.visitors, sessions: summary.sessions, pageViews: summary.pageViews, opens: totalFor(data, 'resources'), plays: data.engagement ? data.engagement.plays : 0, saves: count(summary.downloads) + count(summary.transfers), shares: summary.shareIntents, sharedVisits: summary.sharedVisits };
  }

  // Change against the previous period of the same length.
  function change(key, data) {
    var previous = data.previous;
    if (!previous || typeof previous !== 'object' || previous[key] == null) return null;
    var now = count(totalsOf(data)[key]), before = count(previous[key]);
    if (!before && !now) return null;
    if (!before) return { kind: 'new', now: now, before: before };
    var percent = Math.round((now - before) / before * 100);
    return { kind: percent > 0 ? 'up' : (percent < 0 ? 'down' : 'flat'), percent: percent, now: now, before: before };
  }

  function deltaHTML(key, data) {
    var delta = change(key, data);
    if (!delta) return '';
    var days = count(data.periodDays || period.value);
    var title = formatNumber(delta.before) + ' in the previous ' + days + ' days';
    var text = delta.kind === 'new' ? 'New' : delta.kind === 'flat' ? '0%' : (delta.kind === 'up' ? '↑ ' : '↓ ') + Math.abs(delta.percent).toLocaleString() + '%';
    return '<span class="delta delta-' + delta.kind + '" title="' + escapeHTML(title) + '"><span class="sr-only">Change from previous period: </span>' + escapeHTML(text) + '</span>';
  }

  /* ---------- Charts and lists ---------- */

  function niceCeiling(maximum) {
    if (maximum <= 4) return 4;
    var raw = maximum / 4;
    var magnitude = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var step = [1, 2, 2.5, 5, 10].map(function (factor) { return factor * magnitude; }).filter(function (value) { return value >= raw; })[0];
    return Math.round(step * 4);
  }

  function barPath(x, y, width, height) {
    var radius = Math.min(3, width / 2, height);
    return 'M' + x.toFixed(2) + ',' + (y + height).toFixed(2) + 'V' + (y + radius).toFixed(2) + 'Q' + x.toFixed(2) + ',' + y.toFixed(2) + ' ' + (x + radius).toFixed(2) + ',' + y.toFixed(2) + 'H' + (x + width - radius).toFixed(2) + 'Q' + (x + width).toFixed(2) + ',' + y.toFixed(2) + ' ' + (x + width).toFixed(2) + ',' + (y + radius).toFixed(2) + 'V' + (y + height).toFixed(2) + 'Z';
  }

  // Vertical columns with gridlines, axis labels and a hover target per day.
  function columnChart(rows, options) {
    var width = options.width, height = options.height, left = 40, right = 6, top = 10, bottom = 26;
    var innerWidth = width - left - right, innerHeight = height - top - bottom;
    var ceiling = niceCeiling(Math.max.apply(null, rows.map(function (row) { return row.value; }).concat([1])));
    var slot = innerWidth / rows.length;
    var barWidth = Math.max(1.5, Math.min(slot - 2, slot * 0.7, 26));
    function y(value) { return top + innerHeight - value / ceiling * innerHeight; }
    var svg = '';
    for (var level = 0; level <= 4; level++) {
      var value = ceiling / 4 * level;
      svg += '<line class="' + (level ? 'chart-grid' : 'chart-base') + '" x1="' + left + '" x2="' + (width - right) + '" y1="' + y(value).toFixed(2) + '" y2="' + y(value).toFixed(2) + '"/><text class="chart-label" text-anchor="end" x="' + (left - 8) + '" y="' + (y(value) + 4).toFixed(2) + '">' + formatNumber(value) + '</text>';
    }
    options.labels.forEach(function (index) {
      svg += '<text class="chart-label" text-anchor="middle" x="' + Math.min(width - right - 14, Math.max(left + 14, left + slot * index + slot / 2)).toFixed(2) + '" y="' + (height - 6) + '">' + escapeHTML(rows[index].label) + '</text>';
    });
    svg += rows.map(function (row, index) {
      var x = left + slot * index + (slot - barWidth) / 2;
      return '<g class="column" data-tip="' + escapeHTML(row.tip) + '"><rect class="column-hit" x="' + (left + slot * index).toFixed(2) + '" y="' + top + '" width="' + slot.toFixed(2) + '" height="' + innerHeight + '"/>' + (row.value ? '<path class="column-bar" d="' + barPath(x, y(row.value), barWidth, row.value / ceiling * innerHeight) + '"/>' : '') + '</g>';
    }).join('');
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHTML(options.title) + '">' + svg + '</svg>';
  }

  // Ranked rows with a thin bar behind each. With options.filter, each row is
  // a button that narrows the whole report to that value.
  function renderBars(id, values, options) {
    options = options || {};
    var target = document.getElementById(id);
    if (!Array.isArray(values)) { unavailable(id); return; }
    var rows = positiveRows(values);
    if (!rows.length) { target.innerHTML = emptyHTML(options.emptyTitle || 'Nothing recorded yet.', options.empty || ''); return; }
    var maximum = count(rows[0].count);
    var shown = rows.slice(0, options.limit || 7);
    var total = options.total;
    target.innerHTML = '<ol class="bar-list">' + shown.map(function (row) {
      var name = options.label ? options.label(row.name) : (row.name || 'Unknown');
      var sub = options.sub ? options.sub(row) : '';
      var share = total ? percentage(row.count, total) : '';
      var tip = name + ': ' + formatNumber(row.count) + (options.unit ? ' ' + options.unit : '') + (share ? ' (' + share + ')' : '');
      var filterable = options.filter && filterRules[options.filter].test(String(row.name || ''));
      var active = filterable && filters[options.filter] === row.name;
      var inner = '<span class="bar-fill" aria-hidden="true" style="width:' + Math.max(1, count(row.count) / maximum * 100).toFixed(2) + '%"></span><span class="bar-name" title="' + escapeHTML(options.tooltip ? options.tooltip(row.name) : name) + '">' + escapeHTML(name) + (sub ? '<small>' + escapeHTML(sub) + '</small>' : '') + '</span><span class="bar-value">' + formatNumber(row.count) + (share ? '<span class="bar-percent">' + escapeHTML(share) + '</span>' : '') + '</span>';
      return '<li class="bar-row' + (active ? ' is-active' : '') + '" data-tip="' + escapeHTML(tip) + '">' + (filterable ? '<button type="button" class="bar-inner bar-button" data-filter="' + options.filter + '" data-value="' + escapeHTML(row.name) + '" aria-label="' + escapeHTML(tip + '. Show only this') + '">' + inner + '</button>' : '<div class="bar-inner">' + inner + '</div>') + '</li>';
    }).join('') + '</ol>' + (rows.length > shown.length ? '<p class="bar-more">Top ' + shown.length + ' of ' + formatNumber(rows.length) + '</p>' : '');
  }

  // Sortable tables. A column with bar: true carries an inline share bar.
  function renderTable(id, values, columns, emptyTitle, emptyText, filter) {
    var target = document.getElementById(id);
    if (!Array.isArray(values)) { unavailable(id); return 0; }
    var rows = values.filter(function (row) { return row && typeof row === 'object'; });
    if (filter) rows = rows.filter(filter);
    if (!rows.length) { target.innerHTML = emptyHTML(emptyTitle, emptyText); return 0; }
    var state = sortState[id];
    var sortColumn = columns.filter(function (column) { return column.key === state.key; })[0] || columns[1];
    rows = rows.slice().sort(function (a, b) {
      var left = sortColumn.numeric ? count(a[sortColumn.key]) : String(sortColumn.text ? sortColumn.text(a) : a[sortColumn.key] || '').toLowerCase();
      var right = sortColumn.numeric ? count(b[sortColumn.key]) : String(sortColumn.text ? sortColumn.text(b) : b[sortColumn.key] || '').toLowerCase();
      if (left < right) return -state.dir;
      if (left > right) return state.dir;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
    var maxima = {}, totals = {};
    columns.forEach(function (column) {
      if (!column.numeric) return;
      maxima[column.key] = Math.max.apply(null, rows.map(function (row) { return count(row[column.key]); }).concat([1]));
      totals[column.key] = rows.reduce(function (sum, row) { return sum + count(row[column.key]); }, 0);
    });
    var head = columns.map(function (column) {
      var active = column.key === state.key;
      return '<th scope="col"' + (column.numeric ? ' class="num"' : '') + (active ? ' aria-sort="' + (state.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button type="button" class="sort-button" data-sort-table="' + id + '" data-sort-key="' + column.key + '">' + escapeHTML(column.label) + '<span class="sort-mark" aria-hidden="true">' + (active ? (state.dir < 0 ? '↓' : '↑') : '') + '</span></button></th>';
    }).join('');
    var limit = tableLimits[id] || 100;
    var body = rows.slice(0, limit).map(function (row) {
      return '<tr>' + columns.map(function (column, index) {
        if (!column.numeric) return (index === 0 ? '<th scope="row">' : '<td>') + column.render(row) + (index === 0 ? '</th>' : '</td>');
        var value = count(row[column.key]);
        var cell = formatNumber(value);
        if (column.bar) cell = '<div class="cell-bar"><span>' + formatNumber(value) + '<small>' + escapeHTML(percentage(value, totals[column.key])) + '</small></span><span class="mini-track" aria-hidden="true"><span style="width:' + (value / maxima[column.key] * 100).toFixed(2) + '%"></span></span></div>';
        return '<td class="num' + (value ? '' : ' zero') + '">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');
    target.innerHTML = '<div class="table-wrap" tabindex="0" role="region" aria-label="' + escapeHTML(id.replace(/-/g, ' ')) + '; scroll sideways on small screens"><table class="crm-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' + (rows.length > limit ? '<div class="table-more"><span>Showing ' + formatNumber(limit) + ' of ' + formatNumber(rows.length) + '</span><button class="button button-quiet" type="button" data-more-table="' + id + '">Show ' + formatNumber(Math.min(tableStep[id] || 25, rows.length - limit)) + ' more</button></div>' : '');
    return rows.length;
  }

  function filterCell(name, value, label, sub) {
    var usable = filterRules[name].test(String(value || ''));
    var text = '<span class="cell-title">' + escapeHTML(label) + '</span>' + (sub ? '<small>' + escapeHTML(sub) + '</small>' : '');
    return usable ? '<button type="button" class="row-link" data-filter="' + name + '" data-value="' + escapeHTML(value) + '">' + text + '</button>' : text;
  }

  function miniTabs(card) {
    document.getElementById(card + '-tabs').innerHTML = cardTabs[card].map(function (tab) {
      return '<button type="button" data-card="' + card + '" data-card-tab="' + tab[0] + '" aria-pressed="' + (tab[0] === cardSelected[card]) + '">' + escapeHTML(tab[1]) + '</button>';
    }).join('');
  }

  function kpiHTML(label, value, note, extra) {
    return '<article class="kpi"><h3 class="kpi-label">' + escapeHTML(label) + '</h3><p class="kpi-value">' + escapeHTML(value) + (extra || '') + '</p><p class="kpi-note">' + escapeHTML(note) + '</p></article>';
  }

  /* ---------- Dashboard ---------- */

  function renderMetrics(data) {
    var totals = totalsOf(data);
    document.getElementById('metrics').innerHTML = metrics.map(function (metric) {
      var selected = metric[0] === trendMetric;
      return '<button type="button" class="kpi-tile" data-trend="' + metric[0] + '" aria-pressed="' + selected + '"><span class="kpi-label">' + escapeHTML(metric[1]) + '</span><span class="kpi-value">' + formatNumber(totals[metric[2]]) + '</span>' + deltaHTML(metric[2], data) + '</button>';
    }).join('');
  }

  function renderChart(data) {
    var rows = dailyRows(data);
    if (rows.length && rows[0][trendMetric] == null) trendMetric = 'visits';
    var metric = metrics.filter(function (item) { return item[0] === trendMetric; })[0];
    renderMetrics(data);
    var target = document.getElementById('daily-chart');
    document.getElementById('trend-title').textContent = metric[4];
    document.getElementById('daily-data').innerHTML = rows.length ? '<table><caption class="sr-only">Daily activity in UTC</caption><thead><tr><th scope="col">Date (UTC)</th>' + metrics.map(function (item) { return '<th scope="col" class="num">' + item[1] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.slice().reverse().map(function (row) { return '<tr><th scope="row">' + escapeHTML(row.date) + '</th>' + metrics.map(function (item) { return '<td class="num">' + (row[item[0]] == null ? '—' : formatNumber(row[item[0]])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' : emptyHTML('No daily records yet.', '');
    var total = rows.reduce(function (sum, row) { return sum + count(row[trendMetric]); }, 0);
    if (!rows.length || !total) {
      document.getElementById('trend-subtitle').textContent = 'UTC';
      target.innerHTML = emptyHTML('No ' + metric[3] + ' recorded in this period.', rows.length && rows[0][trendMetric] == null ? 'This metric needs the updated analytics API.' : 'The chart fills in day by day as activity is recorded.');
      return;
    }
    // Daily unique visitors don't add up to the period's unique visitors.
    var headline = trendMetric === 'visitors' ? formatNumber(totalsOf(data).visitors) + ' different visitor browsers' : formatNumber(total) + ' ' + metric[3];
    document.getElementById('trend-subtitle').textContent = headline + ' in ' + rows.length + ' days · average ' + (Math.round(total / rows.length * 10) / 10).toLocaleString() + ' a day · UTC';
    // Phones get a narrower drawing so labels stay legible.
    var narrow = typeof window !== 'undefined' && window.innerWidth < 640;
    var labels = [];
    var step = Math.max(1, Math.ceil(rows.length / (narrow ? 4 : 7)));
    for (var index = 0; index < rows.length; index += step) labels.push(index);
    if (labels[labels.length - 1] !== rows.length - 1 && rows.length - 1 - labels[labels.length - 1] >= step / 2) labels.push(rows.length - 1);
    target.innerHTML = columnChart(rows.map(function (row) {
      return { value: count(row[trendMetric]), label: formatDate(row.date, false), tip: formatDate(row.date, false) + ' · ' + formatNumber(row[trendMetric]) + ' ' + metric[3] };
    }), { width: narrow ? 420 : 960, height: narrow ? 220 : 240, labels: labels, title: metric[4] + ' in UTC. Open the table below the chart for every value.' });
  }

  function renderCards(data) {
    var totals = totalsOf(data);
    Object.keys(cardTabs).forEach(miniTabs);
    var key = cardSelected['top-content'];
    var verbs = { opens: 'openings', plays: 'plays', saves: 'saves', shares: 'share attempts' };
    renderBars('top-content', tableRows(data.resourceTable, key) || (key === 'opens' ? data.resources : null), { label: resourceTitle, tooltip: resourceTooltip, sub: function (row) { return resourceMeta(row.name); }, total: totals[key], unit: verbs[key], filter: 'resource', empty: 'Items appear here once someone ' + { opens: 'opens', plays: 'plays', saves: 'saves', shares: 'shares' }[key] + ' one.' });
    if (cardSelected['top-places'] === 'countries') renderBars('top-places', tableRows(data.countryTable, 'visitors') || data.countries, { label: countryLabel, total: totals.visitors, unit: 'visitor browsers', filter: 'country', sub: function (row) { return row.extra ? plural(row.extra.pageViews, 'page view', 'page views') : ''; }, empty: 'Countries appear after the first recorded visit.' });
    else if (cardSelected['top-places'] === 'platforms') renderBars('top-places', data.platforms, { label: platformName, total: totalFor(data, 'platforms', totals.pageViews), unit: 'page views', sub: function (row) { return (data.appVersions || []).filter(function (v) { return v.name.indexOf(row.name + ' ') === 0; }).slice(0, 3).map(function (v) { return 'v' + v.name.slice(row.name.length + 1) + ' · ' + formatNumber(v.count); }).join(', '); }, empty: 'Page views appear after the first recorded visit.' });
    else renderBars('top-places', tableRows(data.languageTable, 'visitors') || data.languages, { label: languageName, total: totals.visitors, unit: 'visitor browsers', filter: 'language', sub: function (row) { return row.extra ? plural(row.extra.opens, 'item opened', 'items opened') : ''; }, empty: 'Languages appear after the first recorded visit.' });
    if (cardSelected['top-sources'] === 'referrers') renderBars('top-sources', data.referrers, { label: referrerName, total: totalFor(data, 'referrers', totals.pageViews), unit: 'page views', empty: 'Referring sites appear after the first recorded visit.' });
    else if (cardSelected['top-sources'] === 'qr') renderBars('top-sources', qrScans(data) && qrScans(data).languages, { label: languageName, total: qrScans(data) && qrScans(data).total, unit: 'scans', filter: 'language', empty: 'Languages appear after the first printed QR code is scanned.' });
    else renderBars('top-sources', data.channels, { label: channelName, total: totalFor(data, 'channels', totals.shares), unit: 'share attempts', empty: 'Share methods appear after the first share attempt.' });
  }

  function renderFunnel(data) {
    var target = document.getElementById('funnel');
    var engagement = data.engagement;
    if (!engagement) { unavailable('funnel'); return; }
    var visitors = count(totalsOf(data).visitors);
    if (!visitors) { target.innerHTML = emptyHTML('No visitors yet.', 'Each step fills in as people browse, play and share.'); return; }
    var steps = [['Visited the library', visitors], ['Opened an item', engagement.openedVisitors], ['Played or saved something', engagement.engagedVisitors], ['Started a share', engagement.sharedVisitors]];
    target.innerHTML = '<ol class="funnel-steps">' + steps.map(function (step, index) {
      var share = percentage(step[1], visitors);
      var lost = index ? count(steps[index - 1][1]) - count(step[1]) : 0;
      return '<li class="funnel-step step-' + index + '" data-tip="' + escapeHTML(step[0] + ': ' + formatNumber(step[1]) + ' visitor browsers (' + share + ')') + '">' + (index && lost > 0 ? '<p class="funnel-drop">' + formatNumber(lost) + ' stopped here</p>' : '') + '<div class="funnel-labels"><span>' + escapeHTML(step[0]) + '</span><span class="funnel-value">' + formatNumber(step[1]) + '<small>' + share + '</small></span></div><div class="funnel-track" aria-hidden="true"><span style="width:' + Math.max(count(step[1]) ? 1.5 : 0, Math.min(100, count(step[1]) / visitors * 100)).toFixed(2) + '%"></span></div></li>';
    }).join('') + '</ol><p class="funnel-foot"><strong>' + formatNumber(engagement.arrivedBySharedLink) + '</strong> visitor ' + (count(engagement.arrivedBySharedLink) === 1 ? 'browser' : 'browsers') + ' arrived through a shared link.</p>';
  }

  function renderHeatmap(data) {
    var target = document.getElementById('heatmap');
    var week = Array.isArray(data.weekHours) && data.weekHours.length === 7 ? data.weekHours : null;
    if (!week) { unavailable('heatmap'); return; }
    var maximum = 0, total = 0, peak = null;
    week.forEach(function (row) {
      (row.hours || []).forEach(function (value, hour) {
        total += count(value);
        if (count(value) > maximum) { maximum = count(value); peak = row.day + ' ' + hourLabel(hour) + '–' + hourLabel((hour + 1) % 24); }
      });
    });
    if (!total) { target.innerHTML = emptyHTML('No page views yet.', 'Busy days and hours show up once visits are recorded.'); return; }
    document.getElementById('heatmap-note').textContent = 'Page views by weekday and hour, UTC · busiest ' + peak;
    var head = '<span></span>' + Array.from({ length: 24 }, function (unused, hour) { return '<span class="heat-hour">' + (hour % 3 ? '' : ('0' + hour).slice(-2)) + '</span>'; }).join('');
    var body = week.map(function (row) {
      return '<span class="heat-day">' + escapeHTML(row.day) + '</span>' + Array.from({ length: 24 }, function (unused, hour) {
        var value = count((row.hours || [])[hour]);
        var level = value ? (0.12 + 0.88 * value / maximum).toFixed(2) : 0;
        return '<span class="heat-cell' + (value ? '' : ' heat-empty') + '"' + (value ? ' style="opacity:' + level + '"' : '') + ' data-tip="' + escapeHTML(row.day + ' ' + hourLabel(hour) + '–' + hourLabel((hour + 1) % 24) + ' UTC · ' + plural(value, 'page view', 'page views')) + '"></span>';
      }).join('');
    }).join('');
    target.innerHTML = '<div class="heat-grid" role="img" aria-label="' + escapeHTML('Page views by weekday and hour in UTC. Busiest: ' + peak + '.') + '">' + head + body + '</div><div class="heat-legend" aria-hidden="true"><span>Fewer</span><i style="opacity:.15"></i><i style="opacity:.4"></i><i style="opacity:.7"></i><i></i><span>More</span></div>';
  }

  function renderInsights(data) {
    var totals = totalsOf(data);
    var insights = [];
    var days = count(data.periodDays || period.value);
    var visitorsChange = change('visitors', data);
    if (visitorsChange && visitorsChange.kind === 'up') insights.push(['Growing', 'Visitors are up ' + visitorsChange.percent + '% on the previous ' + days + ' days (' + formatNumber(visitorsChange.before) + ' → ' + formatNumber(visitorsChange.now) + ').']);
    else if (visitorsChange && visitorsChange.kind === 'down') insights.push(['Quieter', 'Visitors are down ' + Math.abs(visitorsChange.percent) + '% on the previous ' + days + ' days (' + formatNumber(visitorsChange.before) + ' → ' + formatNumber(visitorsChange.now) + ').']);
    var country = positiveRows(tableRows(data.countryTable, 'visitors') || data.countries).filter(function (row) { return !/^(unknown|xx)$/i.test(row.name); })[0];
    var language = positiveRows(tableRows(data.languageTable, 'visitors') || data.languages).filter(function (row) { return !/^(unknown|unspecified)$/i.test(row.name); })[0];
    var resource = positiveRows(tableRows(data.resourceTable, 'opens') || data.resources)[0];
    if (country) insights.push(['Leading country', countryLabel(country.name) + ' with ' + plural(country.count, 'visitor browser', 'visitor browsers') + ' (' + percentage(country.count, totals.visitors) + ').']);
    if (language) insights.push(['Leading language', languageName(language.name) + ' with ' + plural(language.count, 'visitor browser', 'visitor browsers') + '.']);
    if (resource) insights.push(['Most opened', resourceTitle(resource.name) + ', opened ' + plural(resource.count, 'time', 'times') + '.']);
    if (count(totals.sharedVisits)) insights.push(['Sharing works', plural(totals.sharedVisits, 'visit', 'visits') + ' came from a shared link.']);
    else if (count(totals.shares)) insights.push(['Sharing has started', plural(totals.shares, 'share attempt', 'share attempts') + ', but no visits from shared links yet.']);
    document.getElementById('insights').innerHTML = insights.length ? '<dl class="insights">' + insights.slice(0, 5).map(function (insight) {
      return '<div class="insight"><dt>' + escapeHTML(insight[0]) + '</dt><dd>' + escapeHTML(insight[1]) + '</dd></div>';
    }).join('') + '</dl>' : emptyHTML('Ready for the first visit.', 'Highlights appear after consented online activity is recorded.');
  }

  /* ---------- People ---------- */

  function renderPeople(data) {
    var totals = totalsOf(data);
    var engagement = data.engagement || {};
    var known = function (rows, pattern) { return Array.isArray(rows) ? rows.filter(function (row) { return row && !pattern.test(row.name || ''); }).length : 0; };
    document.getElementById('audience-metrics').innerHTML = [
      kpiHTML('Visitor browsers', formatNumber(totals.visitors), 'Anonymous browser IDs', deltaHTML('visitors', data)),
      kpiHTML('Came back', data.engagement ? formatNumber(engagement.returningVisitors) : '—', data.engagement ? percentage(engagement.returningVisitors, totals.visitors) + ' had more than one visit' : 'Needs the updated analytics API'),
      kpiHTML('Visits', formatNumber(totals.sessions), count(totals.visitors) ? (Math.round(count(totals.sessions) / count(totals.visitors) * 10) / 10).toLocaleString() + ' per visitor browser' : 'Separate sessions'),
      kpiHTML('From a shared link', data.engagement ? formatNumber(engagement.arrivedBySharedLink) : '—', 'Visitor browsers that arrived this way'),
      kpiHTML('Countries', formatNumber(known(data.countryTable || data.countries, /^(unknown|xx)$/i)), 'With recorded activity'),
      kpiHTML('Languages', formatNumber(known(data.languageTable || data.languages, /^(unknown|unspecified)$/i)), 'Library languages in use')
    ].join('');
    var people = Array.isArray(data.visitorTable) ? data.visitorTable : null;
    var shown = renderTable('people-table', people, [
      { key: 'id', label: 'Visitor browser', text: function (row) { return row.id; }, render: function (row) {
        var where = [countryName(row.country), row.language ? languageName(row.language) : ''].filter(Boolean).join(' · ');
        return '<button type="button" class="row-link person-link" data-filter="visitor" data-value="' + escapeHTML(row.id) + '"><span class="person-flag" aria-hidden="true">' + countryFlag(row.country) + '</span><span><span class="cell-title">' + escapeHTML(browserName(row.id)) + (row.arrivedByShare ? ' <span class="tag">Shared link</span>' : '') + '</span><small>' + escapeHTML(where) + '</small></span></button>';
      } },
      { key: 'lastSeen', label: 'Last seen', text: function (row) { return row.lastSeen; }, render: function (row) { return '<time datetime="' + escapeHTML(row.lastSeen) + '">' + escapeHTML(formatDate(row.lastSeen, true)) + '</time><small>First ' + escapeHTML(formatDate(row.firstSeen, false)) + '</small>'; } },
      { key: 'sessions', label: 'Visits', numeric: true },
      { key: 'pageViews', label: 'Views', numeric: true },
      { key: 'opens', label: 'Opened', numeric: true },
      { key: 'plays', label: 'Plays', numeric: true },
      { key: 'saves', label: 'Saved', numeric: true },
      { key: 'shares', label: 'Shares', numeric: true }
    ], 'No visitor browsers yet.', 'Each browser gets a row after its first recorded visit.');
    document.getElementById('people-count').textContent = people ? plural(shown, 'visitor browser', 'visitor browsers') + (data.breakdownTruncated && data.breakdownTruncated.visitorTable ? ' · the 200 most recent' : '') + ' · select one to see its timeline' : '';
    var number = function (key, label, bar) { return { key: key, label: label, numeric: true, bar: bar }; };
    renderTable('country-table', data.countryTable, [
      { key: 'name', label: 'Country', text: function (row) { return countryName(row.name); }, render: function (row) { return filterCell('country', row.name, countryLabel(row.name)); } },
      number('visitors', 'Visitors', true), number('pageViews', 'Views'), number('opens', 'Opened'), number('shares', 'Shares')
    ], 'No countries recorded yet.', 'Each country gets a row after its first recorded visit.');
    renderTable('language-table', data.languageTable, [
      { key: 'name', label: 'Language', text: function (row) { return languageName(row.name); }, render: function (row) { return filterCell('language', row.name, languageName(row.name), /^(unknown|unspecified)$/i.test(row.name || '') ? '' : row.name); } },
      number('visitors', 'Visitors', true), number('pageViews', 'Views'), number('opens', 'Opened'), number('saves', 'Saved')
    ], 'No languages recorded yet.', 'Each library language gets a row after its first recorded visit.');
    renderPerson(data);
  }

  // A HubSpot-style record for one anonymous browser: facts and a timeline.
  function renderPerson(data) {
    var card = document.getElementById('person-detail');
    var id = filters.visitor;
    card.hidden = !id;
    if (!id) return;
    var person = (Array.isArray(data.visitorTable) ? data.visitorTable : []).filter(function (row) { return row && row.id === id; })[0];
    if (!person) {
      document.getElementById('person-facts').innerHTML = '<h2>' + escapeHTML(browserName(id)) + '</h2><p class="muted">No activity from this browser in the selected period.</p>';
      document.getElementById('person-timeline').innerHTML = emptyHTML('Nothing in this period.', 'Try a longer reporting period.');
      return;
    }
    var facts = [
      ['Country', countryLabel(person.country)],
      ['Language', person.language ? languageName(person.language) : 'Unspecified'],
      ['First seen', formatDate(person.firstSeen, true)],
      ['Last seen', formatDate(person.lastSeen, true)],
      ['Visits', formatNumber(person.sessions)],
      ['Came from a shared link', person.arrivedByShare ? 'Yes' : 'No']
    ];
    var stats = [['Views', person.pageViews], ['Opened', person.opens], ['Plays', person.plays], ['Saved', person.saves], ['Shares', person.shares]];
    document.getElementById('person-facts').innerHTML = '<p class="eyebrow">Anonymous visitor browser</p><h2>' + countryFlag(person.country) + ' ' + escapeHTML(browserName(id)) + '</h2><p class="person-id">' + escapeHTML(id) + '</p><div class="person-stats">' + stats.map(function (stat) { return '<div><strong>' + formatNumber(stat[1]) + '</strong><span>' + stat[0] + '</span></div>'; }).join('') + '</div><dl class="person-list">' + facts.map(function (fact) { return '<div><dt>' + escapeHTML(fact[0]) + '</dt><dd>' + escapeHTML(fact[1]) + '</dd></div>'; }).join('') + '</dl><button class="button button-quiet" type="button" data-clear-filter="visitor">Back to everyone</button>';
    var events = currentEvents.filter(function (event) { return event.visitorId === id; });
    var lastDay = '';
    document.getElementById('person-timeline').innerHTML = events.length ? '<ol class="timeline">' + events.map(function (event) {
      var day = formatDate(event.at, false);
      var heading = day !== lastDay ? '<li class="timeline-day">' + escapeHTML(day) + '</li>' : '';
      lastDay = day;
      var what = event.resource ? resourceTitle(event.resource) : (event.type === 'page_view' ? event.path : '');
      var detail = [event.channel ? channelName(event.channel) : '', event.status ? statusName(event.status) : '', event.language ? languageName(event.language) : ''].filter(Boolean).join(' · ');
      return heading + '<li class="timeline-item' + (/share|transfer/.test(event.type) ? ' is-share' : '') + '"><time datetime="' + escapeHTML(event.at) + '">' + escapeHTML(formatTime(event.at)) + '</time><div><strong>' + escapeHTML(eventTypeName(event.type)) + '</strong>' + (what ? ' <span>' + escapeHTML(what) + '</span>' : '') + (detail ? '<small>' + escapeHTML(detail) + '</small>' : '') + '</div></li>';
    }).join('') + '</ol>' + (reportData.recentEventsTruncated ? '<p class="card-note">Showing the newest ' + formatNumber(events.length) + ' events.</p>' : '') : emptyHTML('No events to show.', '');
  }

  /* ---------- Content, sharing, developer ---------- */

  function renderContent(data) {
    var totals = totalsOf(data);
    var byType = Object.create(null);
    var source = tableRows(data.resourceTable, 'opens') || data.resources;
    if (Array.isArray(source)) {
      source.forEach(function (row) {
        if (!row || !count(row.count)) return;
        var info = resourceInfo[row.name];
        var type = info ? (typeNames[info.type] || readable(info.type)) : 'Not in this catalogue';
        byType[type] = (byType[type] || 0) + count(row.count);
      });
      renderBars('content-types', Object.keys(byType).map(function (name) { return { name: name, count: byType[name] }; }), { total: totals.opens, unit: 'openings', empty: 'Kinds of content appear once items are opened.' });
    } else unavailable('content-types');
    renderBars('content-languages', tableRows(data.languageTable, 'opens'), { label: languageName, total: totals.opens, unit: 'openings', limit: 8, filter: 'language', sub: function (row) { return plural(row.extra.visitors, 'visitor browser', 'visitor browsers'); }, empty: 'Languages appear here once items are opened.' });
    var search = document.getElementById('resource-search').value.trim().toLowerCase();
    var number = function (key, label, bar) { return { key: key, label: label, numeric: true, bar: bar }; };
    var shown = renderTable('resource-table', data.resourceTable, [
      { key: 'name', label: 'Item', text: function (row) { return resourceTitle(row.name); }, render: function (row) { var meta = resourceMeta(row.name); return filterCell('resource', row.name, resourceTitle(row.name), meta ? meta + ' · ' + row.name : row.name); } },
      number('visitors', 'Visitors'), number('opens', 'Opened', true), number('plays', 'Plays'), number('saves', 'Saved'), number('shares', 'Shares')
    ], search ? 'No matching items.' : 'No content activity yet.', search ? 'Try another word or clear the search.' : 'Items get a row when someone opens, plays, saves or shares them.', search ? function (row) {
      return [row.name, resourceTitle(row.name), resourceMeta(row.name)].join(' ').toLowerCase().indexOf(search) !== -1;
    } : null);
    document.getElementById('resource-table-count').textContent = Array.isArray(data.resourceTable) ? (search ? plural(shown, 'matching item', 'matching items') : plural(shown, 'item with activity', 'items with activity')) + ' · select a title to filter the report' : '';
  }

  // Printed QR scans are counted apart from consented events (older servers send none).
  function qrScans(data) {
    return data.qrScans && typeof data.qrScans === 'object' && Array.isArray(data.qrScans.languages) ? data.qrScans : null;
  }

  function renderSharing(data) {
    var totals = totalsOf(data);
    var qr = qrScans(data);
    var summary = data.summary;
    var engagement = data.engagement || {};
    document.getElementById('sharing-signals').innerHTML = [
      kpiHTML('Share attempts', formatNumber(totals.shares), 'Link actions, guides and nearby offers', deltaHTML('shares', data)),
      kpiHTML('Confirmed share actions', formatNumber(summary.shareCompletions), 'Includes copied links confirmed on the device'),
      kpiHTML('Visits from shared links', formatNumber(totals.sharedVisits), data.engagement ? plural(engagement.arrivedBySharedLink, 'visitor browser', 'visitor browsers') + ' arrived this way' : 'Openings of attributed links', deltaHTML('sharedVisits', data)),
      kpiHTML('Saved', formatNumber(totals.saves), 'Files saved or downloaded, plus nearby batches', deltaHTML('saves', data)),
      kpiHTML('Nearby batches received', formatNumber(summary.transfers), 'Receiver confirmed the data arrived'),
      kpiHTML('QR code scans', qr ? formatNumber(qr.total) : '—', 'Printed library codes, every scan counted', qr ? deltaHTML('qr', { totals: { qr: qr.total }, previous: data.previous ? { qr: qr.previous } : null, periodDays: data.periodDays }) : '')
    ].join('');
    renderBars('qr-languages', qr && qr.languages, { label: languageName, total: qr && qr.total, unit: 'scans', filter: 'language', empty: 'Languages appear after the first printed QR code is scanned.' });
    renderBars('channels', data.channels, { label: channelName, total: totalFor(data, 'channels', totals.shares), unit: 'attempts', empty: 'Share methods appear after the first share attempt.' });
    renderBars('share-outcomes', data.shareOutcomes, { label: statusName, total: totalFor(data, 'shareOutcomes'), unit: 'events', empty: 'Results appear after a share action finishes.' });
    renderBars('shared-content', tableRows(data.resourceTable, 'shares'), { label: resourceTitle, tooltip: resourceTooltip, total: totals.shares, unit: 'share attempts', filter: 'resource', sub: function (row) { return resourceMeta(row.name); }, empty: 'Items appear here once someone shares one.' });
    renderBars('shared-languages', tableRows(data.languageTable, 'shares'), { label: languageName, total: totals.shares, unit: 'share attempts', filter: 'language', empty: 'Languages appear here after the first share attempt.' });
    renderChains(data.shareChains);
  }

  function renderChains(chains) {
    var signals = document.getElementById('chain-signals');
    if (!chains || typeof chains !== 'object') {
      signals.innerHTML = '';
      unavailable('chain-depth'); unavailable('chain-top');
      return;
    }
    signals.innerHTML = [
      kpiHTML('Passed on', formatNumber(chains.passedOn), 'Shares of a link someone was sent'),
      kpiHTML('Longest chain', chains.longest ? plural(chains.longest, 'step', 'steps') : '—', 'Furthest a link has been passed along'),
      kpiHTML('Chains', formatNumber(chains.chains), 'First shares that were passed on at least once')
    ].join('');
    renderBars('chain-depth', chains.byDepth, { label: function (step) { return 'Step ' + step; }, total: count(chains.shares), unit: 'share attempts', limit: 10, empty: 'Steps appear after the first share attempt.' });
    renderBars('chain-top', (chains.top || []).map(function (chain) {
      return { name: chain.resource, count: chain.shares, extra: chain };
    }), { label: resourceTitle, tooltip: resourceTooltip, unit: 'shares', limit: 8, sub: function (row) {
      var chain = row.extra || {};
      return plural(chain.depth, 'step', 'steps') + ' · ' + plural(chain.sharers, 'sharer', 'sharers') + ' · ' + plural(chain.visits, 'visit', 'visits');
    }, empty: 'Chains appear once a shared link is passed on.' });
  }

  function renderDeveloper(data) {
    var summary = data.summary;
    var coverage = data.coverage || {};
    document.getElementById('developer-metrics').innerHTML = [
      kpiHTML('Country coverage', data.coverage ? percentage(coverage.pageViewsWithCountry, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithCountry) + ' page views with a country'),
      kpiHTML('Referrer coverage', data.coverage ? percentage(coverage.pageViewsWithReferrer, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithReferrer) + ' page views with a referrer'),
      kpiHTML('Error events', data.coverage ? formatNumber(coverage.errorEvents) : '—', 'Recorded errors, not an error rate'),
      kpiHTML('Cancelled events', data.coverage ? formatNumber(coverage.cancelledEvents) : '—', 'Recorded cancellations or declines')
    ].join('');
    renderBars('event-types', data.eventTypes, { label: eventTypeName, total: totalFor(data, 'eventTypes'), unit: 'events', limit: 12, empty: 'No event types recorded yet.' });
    renderBars('statuses', data.statuses, { label: statusName, total: totalFor(data, 'statuses'), unit: 'events', limit: 10, empty: 'No event statuses recorded yet.' });
    renderBars('download-outcomes', data.downloadOutcomes, { label: statusName, total: totalFor(data, 'downloadOutcomes'), unit: 'events', empty: 'No finished download events yet.' });
    renderBars('transfer-outcomes', data.transferOutcomes, { label: statusName, total: totalFor(data, 'transferOutcomes'), unit: 'events', empty: 'No finished nearby transfers yet.' });
    renderBars('pages', data.pages, { total: totalFor(data, 'pages', summary.pageViews), unit: 'page views', limit: 10, empty: 'No page views recorded yet.' });
  }

  function renderMetadata(data) {
    var coverage = data.coverage;
    var rows = [
      ['Reporting period', count(data.periodDays || period.value) + ' days · ' + (data.reportingTimezone || 'UTC')],
      ['Filters', filterOrder.filter(function (name) { return filters[name]; }).map(function (name) { return name + ' = ' + filters[name]; }).join(', ') || 'None'],
      ['Generated', data.generatedAt || 'Not supplied by this server'],
      ['Analyzed events', formatNumber(data.analyzedEvents == null ? currentEvents.length : data.analyzedEvents)],
      ['Recent events available', formatNumber(currentEvents.length) + (data.recentEventsTruncated ? ' · newest records only' : '')],
      ['Report completeness', data.truncated ? 'Partial · analysis limit reached' : 'Complete analyzed period'],
      ['Previous-period comparison', data.previous ? 'Available' : 'Not available for this period'],
      ['Analysis limit', data.analysisLimit ? formatNumber(data.analysisLimit) + ' events' : 'Not supplied by this server'],
      ['Activity window', count(data.retentionDays || 90) + ' days'],
      ['Sessions', formatNumber(data.summary.sessions)],
      ['Distinct resources in activity', coverage ? formatNumber(coverage.distinctResources) : 'Not supplied by this server'],
      ['Shared visits with a share ID', coverage ? formatNumber(coverage.sharedVisitsWithShareId) : 'Not supplied by this server']
    ];
    document.getElementById('report-metadata').innerHTML = rows.map(function (row) { return '<div><dt>' + row[0] + '</dt><dd>' + escapeHTML(row[1]) + '</dd></div>'; }).join('');
  }

  function renderFilters() {
    var active = filterOrder.filter(function (name) { return filters[name]; });
    document.getElementById('filter-bar').hidden = !active.length;
    document.getElementById('filter-chips').innerHTML = active.map(function (name) {
      var label = { country: 'Country', language: 'Language', resource: 'Item', visitor: 'Visitor' }[name];
      return '<span class="chip"><span><span class="chip-key">' + label + '</span> ' + escapeHTML(filterLabel(name, filters[name])) + '</span><button type="button" data-clear-filter="' + name + '" aria-label="' + escapeHTML('Remove the ' + label.toLowerCase() + ' filter') + '">×</button></span>';
    }).join('');
  }

  /* ---------- Activity log ---------- */

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
    document.getElementById('event-count').textContent = filteredEvents.length ? 'Showing ' + formatNumber(first + 1) + '–' + formatNumber(first + shown.length) + ' of ' + formatNumber(filteredEvents.length) + ' matching recent events · local times' : '0 matching recent events';
    document.getElementById('event-page-label').textContent = 'Page ' + eventPage + ' of ' + pages;
    document.getElementById('event-prev').disabled = eventPage <= 1;
    document.getElementById('event-next').disabled = eventPage >= pages;
    exportButton.disabled = busy || !filteredEvents.length;
    document.getElementById('event-note').textContent = (reportData.recentEventsTruncated ? 'Available: the newest ' + formatNumber(currentEvents.length) + ' of ' + formatNumber(reportData.analyzedEvents) + ' analyzed events. ' : 'Available: ' + formatNumber(currentEvents.length) + ' recent events. ') + 'CSV exports all ' + formatNumber(filteredEvents.length) + ' matching records, including anonymous browser, session and share identifiers.';
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

  /* ---------- Rendering a report ---------- */

  function renderBreakdowns(data) {
    renderCards(data);
    renderPeople(data);
    renderContent(data);
  }

  function render(data) {
    var summary = data && data.summary;
    if (!summary || typeof summary !== 'object' || !Array.isArray(data.events)) throw new Error('The analytics server returned an unexpected response. Please refresh or check the server configuration.');
    reportData = data;
    currentEvents = data.events.filter(function (event) { return event && typeof event === 'object'; }).slice().sort(function (a, b) { return (new Date(b.at).getTime() || 0) - (new Date(a.at).getTime() || 0); });
    renderFilters();
    renderChart(data);
    renderBreakdowns(data);
    renderFunnel(data);
    renderHeatmap(data);
    renderInsights(data);
    renderSharing(data);
    renderDeveloper(data);
    populateFilter('event-filter-type', 'type', eventTypeName, 'All types');
    populateFilter('event-filter-channel', 'channel', channelName, 'All channels');
    populateFilter('event-filter-status', 'status', statusName, 'All statuses');
    renderExplorer();
    if (typeof window !== 'undefined' && window.EasyTransferAdminJourneys) window.EasyTransferAdminJourneys.render(currentEvents, { resourceTitle: resourceTitle, languageName: languageName, countryName: countryName });
    renderMetadata(data);
    var warning = document.getElementById('report-warning');
    warning.hidden = data.truncated !== true;
    warning.textContent = data.truncated === true ? 'Partial report: this period exceeds the server’s analysis limit. Counts and charts cover the newest ' + formatNumber(data.analyzedEvents || data.analysisLimit) + ' events, so totals may be lower than actual activity. Choose a shorter period for a complete view.' : '';
    document.getElementById('empty-overview').hidden = currentEvents.length > 0 || ['visitors', 'pageViews', 'shareIntents', 'sharedVisits'].some(function (key) { return count(summary[key]) > 0; });
    updated();
    document.getElementById('retention-note').textContent = 'Reports cover a ' + count(data.retentionDays || 90) + '-day window. Browser IDs can reset or be shared by several people, so visitor counts are estimates.';
    showDashboard();
  }

  /* ---------- Session, loading and polling ---------- */

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
    document.getElementById('report-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function reportQuery() {
    return '?days=' + encodeURIComponent(period.value) + filterOrder.filter(function (name) { return filters[name]; }).map(function (name) { return '&' + name + '=' + encodeURIComponent(filters[name]); }).join('');
  }

  function request(options) {
    var url = '/api/admin' + (options ? '' : reportQuery());
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

  function load(silent) {
    silent = silent === true;
    if (busy || pollingInFlight) { if (!silent) { pendingReload = true; exportButton.disabled = true; } return Promise.resolve(); }
    var hadSession = authenticated;
    var version = sessionVersion;
    var requested = reportQuery();
    pollingInFlight = true;
    if (!silent) { showMessage(''); setBusy(true); }
    return request().then(function (data) {
      if (version !== sessionVersion || requested !== reportQuery()) return;
      var fingerprint = requested + JSON.stringify(data, function (key, value) { return key === 'generatedAt' ? undefined : value; });
      if (fingerprint !== lastFingerprint) { render(data); lastFingerprint = fingerprint; }
      else { reportData = data; renderMetadata(data); updated(); }
      showMessage('');
    }).catch(function (error) {
      if (version !== sessionVersion || requested !== reportQuery()) return;
      if (error.status === 401 || !authenticated) showLogin();
      if (error.status !== 401 || hadSession) showMessage(silent && error.status !== 401 ? 'Automatic update paused by a connection error. Showing the last successful report. ' + error.message : error.message);
    }).finally(function () {
      pollingInFlight = false;
      initialLoading.hidden = true;
      if (!silent) setBusy(false);
      if (pendingReload && authenticated) { pendingReload = false; load(); }
    });
  }

  function setFilter(name, value) {
    if (value == null) delete filters[name];
    else if (filterRules[name] && filterRules[name].test(String(value))) filters[name] = String(value);
    else return;
    renderFilters();
    eventPage = 1;
    expandedEvent = '';
    load();
  }

  /* ---------- Interaction ---------- */

  function switchView(view, focus) {
    views.forEach(function (name) {
      var selected = name === view;
      var tab = document.getElementById(name + '-tab');
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      document.getElementById(name + '-panel').hidden = !selected;
      if (selected && focus) tab.focus();
    });
  }
  views.forEach(function (name, index) {
    var tab = document.getElementById(name + '-tab');
    tab.addEventListener('click', function () { switchView(name); });
    tab.addEventListener('keydown', function (event) {
      var keys = { ArrowUp: index - 1, ArrowLeft: index - 1, ArrowDown: index + 1, ArrowRight: index + 1, Home: 0, End: views.length - 1 };
      if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
      event.preventDefault();
      switchView(views[(keys[event.key] + views.length) % views.length], true);
    });
  });

  // Shared tooltip: any element with data-tip shows its text on hover or focus.
  var tip = document.getElementById('chart-tip');
  function moveTip(event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-tip]') : null;
    if (!target) { tip.hidden = true; return; }
    tip.textContent = target.getAttribute('data-tip');
    tip.hidden = false;
    var x = event.clientX, y = event.clientY;
    if (x == null) { var box = target.getBoundingClientRect(); x = box.left + box.width / 2; y = box.top; }
    var width = tip.offsetWidth || 160;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - width - 8, x - width / 2)) + 'px';
    tip.style.top = Math.max(8, y - (tip.offsetHeight || 32) - 12) + 'px';
  }
  document.addEventListener('pointermove', moveTip);
  document.addEventListener('pointerleave', function () { tip.hidden = true; });
  document.addEventListener('focusin', moveTip);
  document.addEventListener('focusout', function () { tip.hidden = true; });
  document.addEventListener('scroll', function () { tip.hidden = true; }, true);

  document.addEventListener('click', function (event) {
    var origin = event.target && event.target.closest ? event.target : null;
    if (!origin) return;
    var trend = origin.closest('[data-trend]');
    if (trend) { trendMetric = trend.getAttribute('data-trend'); renderChart(reportData); return; }
    var card = origin.closest('[data-card]');
    if (card) { cardSelected[card.getAttribute('data-card')] = card.getAttribute('data-card-tab'); renderCards(reportData); return; }
    var clear = origin.closest('[data-clear-filter]');
    if (clear) { setFilter(clear.getAttribute('data-clear-filter'), null); return; }
    var filter = origin.closest('[data-filter]');
    if (filter) {
      var name = filter.getAttribute('data-filter');
      if (name === 'visitor') switchView('people');
      setFilter(name, filter.getAttribute('data-value'));
      return;
    }
    var goto = origin.closest('[data-goto]');
    if (goto) { switchView(goto.getAttribute('data-goto'), true); return; }
    var more = origin.closest('[data-more-table]');
    if (more) { var table = more.getAttribute('data-more-table'); tableLimits[table] += tableStep[table]; renderBreakdowns(reportData); return; }
    var sort = origin.closest('[data-sort-table]');
    if (sort) {
      var id = sort.getAttribute('data-sort-table'), key = sort.getAttribute('data-sort-key');
      var state = sortState[id];
      state.dir = state.key === key ? -state.dir : (key === 'name' || key === 'id' ? 1 : -1);
      state.key = key;
      renderBreakdowns(reportData);
      var again = document.querySelector && document.querySelector('[data-sort-table="' + id + '"][data-sort-key="' + key + '"]');
      if (again) again.focus();
    }
  });
  document.getElementById('clear-filters').addEventListener('click', function () { filters = {}; setFilter('visitor', null); });
  document.getElementById('resource-search').addEventListener('input', function () { tableLimits['resource-table'] = 25; if (reportData.summary) renderContent(reportData); });
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
    if (/^[\s﻿]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  exportButton.addEventListener('click', function () {
    if (!filteredEvents.length || busy || exportButton.disabled) return;
    var columns = ['id', 'type', 'at', 'path', 'language', 'resource', 'channel', 'status', 'country', 'referrer', 'shareId', 'visitorId', 'sessionId', 'bytes', 'duration'];
    var rows = [columns.map(csvCell).join(',')].concat(filteredEvents.map(function (event) {
      return columns.map(function (column) { return csvCell(event[column]); }).join(',');
    }));
    var blob = new Blob(['﻿' + rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
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
