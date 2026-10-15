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

  var views = ['overview', 'audience', 'content', 'sharing', 'activity', 'developer'];
  var trendMetric = 'visitors';
  var trendMetrics = [
    ['visitors', 'Visitors', 'visitor browsers', 'Visitor browsers per day'],
    ['visits', 'Page views', 'page views', 'Page views per day'],
    ['opens', 'Opens', 'items opened', 'Items opened per day'],
    ['shares', 'Shares', 'share attempts', 'Share attempts per day'],
    ['saves', 'Saves', 'saves and nearby receipts', 'Files saved and nearby batches received per day']
  ];
  var sortState = {
    'country-table': { key: 'visitors', dir: -1 },
    'language-table': { key: 'visitors', dir: -1 },
    'resource-table': { key: 'opens', dir: -1 }
  };
  var tableLimits = { 'country-table': 100, 'language-table': 100, 'resource-table': 25 };
  var typeNames = { film: 'Films', 'audio-bible': 'Audio Bibles', audio: 'Audio teaching', scripture: 'Scripture', historic: 'Historic scans', book: 'Books', link: 'Partner links' };
  var resourceInfo = Object.create(null);
  if (typeof LIBRARY !== 'undefined' && LIBRARY && Array.isArray(LIBRARY.resources)) {
    LIBRARY.resources.forEach(function (resource) {
      if (resource && typeof resource.id === 'string') resourceInfo[resource.id] = { type: resource.type, lang: resource.lang };
    });
  }

  var icons = {
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-16a3 3 0 0 1 0 6m4 10v-2a6 6 0 0 0-3-5"/>',
    repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
    session: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    language: '<path d="M4 5h9M8.5 3v2m3 0c-1 5-4 8-7.5 9.5M6 9c1.5 2.5 3.5 4 6 5M13 21l4-9 4 9m-6.6-3h5.2"/>',
    page: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8m-8 4h8m-8 4h4"/>',
    open: '<path d="M4 5h16v14H4zM10 9l5 3-5 3V9Z"/>',
    link: '<path d="m10 13 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    transfer: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>'
  };

  function emptyHTML(title, text) {
    return '<div class="empty-state"><span class="empty-dot" aria-hidden="true"></span><p><strong>' + escapeHTML(title) + '</strong>' + (text ? ' ' + escapeHTML(text) : '') + '</p></div>';
  }

  function unavailable(id) {
    document.getElementById(id).innerHTML = emptyHTML('Not available yet.', 'This breakdown needs the updated analytics API. It appears after the next deploy.');
  }

  function dailyRows(data) {
    return Array.isArray(data.daily) ? data.daily.filter(function (row) { return row && !isNaN(new Date(row.date).getTime()); }).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }) : [];
  }

  function peakDay(rows, key) {
    var best = null;
    rows.forEach(function (row) { if (count(row[key]) > 0 && (!best || count(row[key]) > count(best[key]))) best = row; });
    return best;
  }

  function sparkHTML(rows, key) {
    if (rows.length < 2) return '';
    var values = rows.map(function (row) { return count(row[key]); });
    if (!values.some(Boolean)) return '';
    var maximum = Math.max.apply(null, values.concat([1]));
    var points = values.map(function (value, index) { return (index / (values.length - 1) * 100).toFixed(2) + ',' + (30 - value / maximum * 26).toFixed(2); }).join(' ');
    return '<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="0,30 ' + points + ' 100,30" class="spark-fill"/><polyline points="' + points + '" class="spark-line"/></svg>';
  }

  function kpiHTML(label, value, note, icon, spark, featured) {
    return '<article class="kpi' + (featured ? ' kpi-featured' : '') + '"><div class="kpi-top"><h3 class="kpi-label">' + escapeHTML(label) + '</h3><span class="kpi-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (icons[icon] || icons.page) + '</svg></span></div><p class="kpi-value">' + escapeHTML(value) + '</p>' + (spark || '') + '<p class="kpi-note">' + escapeHTML(note) + '</p></article>';
  }

  function peakNote(rows, key, unit) {
    var peak = peakDay(rows, key);
    return peak ? 'Busiest day ' + formatDate(peak.date, false) + ' · ' + formatNumber(peak[key]) + ' ' + unit : 'Nothing recorded yet';
  }

  function renderMetrics(summary, data) {
    var rows = dailyRows(data);
    var hasDaily = rows.length && Object.prototype.hasOwnProperty.call(rows[0], 'visitors');
    document.getElementById('metrics').innerHTML = [
      kpiHTML('Visitor browsers', formatNumber(summary.visitors), hasDaily ? peakNote(rows, 'visitors', 'visitors') : 'Anonymous browser IDs', 'people', hasDaily ? sparkHTML(rows, 'visitors') : '', true),
      kpiHTML('Page views', formatNumber(summary.pageViews), peakNote(rows, 'visits', 'views'), 'page', sparkHTML(rows, 'visits')),
      kpiHTML('Items opened', formatNumber(totalFor(data, 'resources')), hasDaily ? peakNote(rows, 'opens', 'opened') : 'Including repeat openings', 'open', hasDaily ? sparkHTML(rows, 'opens') : ''),
      kpiHTML('Share attempts', formatNumber(summary.shareIntents), peakNote(rows, 'shares', 'shares'), 'share', sparkHTML(rows, 'shares')),
      kpiHTML('Saved or received', formatNumber(count(summary.downloads) + count(summary.transfers)), hasDaily ? peakNote(rows, 'saves', 'saves') : 'Files saved plus nearby batches', 'download', hasDaily ? sparkHTML(rows, 'saves') : '')
    ].join('');
    var engagement = data.engagement || {};
    var countryRows = Array.isArray(data.countryTable) ? data.countryTable : data.countries;
    var languageRows = Array.isArray(data.languageTable) ? data.languageTable : data.languages;
    var known = function (rows, pattern) { return Array.isArray(rows) ? rows.filter(function (row) { return row && !pattern.test(row.name || ''); }).length : 0; };
    document.getElementById('audience-metrics').innerHTML = [
      kpiHTML('Visitor browsers', formatNumber(summary.visitors), 'Anonymous browser IDs; approximate reach', 'people', '', true),
      kpiHTML('Returning', data.engagement ? formatNumber(engagement.returningVisitors) : '—', data.engagement ? percentage(engagement.returningVisitors, summary.visitors) + ' came back for another session' : 'Needs the updated analytics API', 'repeat'),
      kpiHTML('Sessions', formatNumber(summary.sessions), count(summary.visitors) ? (Math.round(count(summary.sessions) / count(summary.visitors) * 10) / 10).toLocaleString() + ' per visitor browser' : 'Separate visits to the library', 'session'),
      kpiHTML('Countries', formatNumber(known(countryRows, /^(unknown|xx)$/i)), 'With at least one recorded event', 'globe'),
      kpiHTML('Languages', formatNumber(known(languageRows, /^(unknown|unspecified)$/i)), 'Library languages in use', 'language')
    ].join('');
    var coverage = data.coverage || {};
    document.getElementById('developer-metrics').innerHTML = [
      kpiHTML('Country coverage', Array.isArray(data.countries) && data.coverage ? percentage(coverage.pageViewsWithCountry, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithCountry) + ' page views with host country', 'globe'),
      kpiHTML('Referrer coverage', data.coverage ? percentage(coverage.pageViewsWithReferrer, summary.pageViews) : '—', formatNumber(coverage.pageViewsWithReferrer) + ' page views with a referrer', 'link'),
      kpiHTML('Error events', data.coverage ? formatNumber(coverage.errorEvents) : '—', 'Recorded errors, not an error rate', 'transfer'),
      kpiHTML('Cancelled events', data.coverage ? formatNumber(coverage.cancelledEvents) : '—', 'Recorded cancellations or declines', 'session')
    ].join('');
  }

  function resourceMeta(id) {
    var info = resourceInfo[id];
    if (!info) return '';
    return [info.lang ? languageName(info.lang) : '', typeNames[info.type] || readable(info.type)].filter(Boolean).join(' · ');
  }

  // Horizontal bars: the most readable form for ranked categories.
  function renderBars(id, values, options) {
    options = options || {};
    if (!Array.isArray(values)) { unavailable(id); return; }
    var rows = positiveRows(values);
    var target = document.getElementById(id);
    if (!rows.length) { target.innerHTML = emptyHTML(options.emptyTitle || 'Nothing recorded yet.', options.empty || ''); return; }
    var maximum = count(rows[0].count);
    var shown = rows.slice(0, options.limit || 6);
    var total = options.total;
    var unit = options.unit || '';
    target.innerHTML = '<ol class="bar-list">' + shown.map(function (row) {
      var name = options.label ? options.label(row.name) : (row.name || 'Unknown');
      var sub = options.sub ? options.sub(row) : '';
      var share = total ? percentage(row.count, total) : '';
      var tip = name + ': ' + formatNumber(row.count) + (unit ? ' ' + unit : '') + (share ? ' (' + share + ')' : '');
      return '<li class="bar-row" data-tip="' + escapeHTML(tip) + '"><div class="bar-labels"><span class="bar-name" title="' + escapeHTML(options.tooltip ? options.tooltip(row.name) : name) + '">' + escapeHTML(name) + (sub ? '<small>' + escapeHTML(sub) + '</small>' : '') + '</span><span class="bar-value">' + formatNumber(row.count) + (share ? '<span class="bar-percent">' + escapeHTML(share) + '</span>' : '') + '</span></div><div class="bar-track" aria-hidden="true"><span style="width:' + Math.max(1, count(row.count) / maximum * 100).toFixed(2) + '%"></span></div></li>';
    }).join('') + '</ol>' + (rows.length > shown.length ? '<p class="bar-more">Top ' + shown.length + ' of ' + formatNumber(rows.length) + '</p>' : '');
  }

  function tableRows(values, key) {
    return Array.isArray(values) ? values.filter(function (row) { return row && typeof row === 'object'; }).map(function (row) {
      return { name: row.name, count: count(row[key]) };
    }) : null;
  }

  // Sortable tables for the CRM views. The first numeric column carries an inline bar.
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
      return String(a.name).localeCompare(String(b.name));
    });
    var maxima = {};
    var totals = {};
    columns.forEach(function (column) {
      if (!column.numeric) return;
      maxima[column.key] = Math.max.apply(null, rows.map(function (row) { return count(row[column.key]); }).concat([1]));
      totals[column.key] = rows.reduce(function (sum, row) { return sum + count(row[column.key]); }, 0);
    });
    var head = columns.map(function (column) {
      var active = column.key === state.key;
      return '<th scope="col"' + (column.numeric ? ' class="num"' : '') + (active ? ' aria-sort="' + (state.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button type="button" class="sort-button" data-sort-table="' + id + '" data-sort-key="' + column.key + '">' + escapeHTML(column.label) + '<span class="sort-mark" aria-hidden="true">' + (active ? (state.dir < 0 ? '↓' : '↑') : '↕') + '</span></button></th>';
    }).join('');
    var limit = tableLimits[id] || 100;
    var body = rows.slice(0, limit).map(function (row) {
      return '<tr>' + columns.map(function (column, index) {
        if (!column.numeric) return (index === 0 ? '<th scope="row">' : '<td>') + column.render(row) + (index === 0 ? '</th>' : '</td>');
        var value = count(row[column.key]);
        var cell = '<span class="cell-number">' + formatNumber(value) + '</span>';
        if (column.bar) cell = '<div class="cell-bar"><span class="cell-number">' + formatNumber(value) + '<small>' + escapeHTML(percentage(value, totals[column.key])) + '</small></span><span class="mini-track" aria-hidden="true"><span style="width:' + (value / maxima[column.key] * 100).toFixed(2) + '%"></span></span></div>';
        return '<td class="num' + (value ? '' : ' zero') + '">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');
    target.innerHTML = '<div class="table-wrap" tabindex="0" role="region" aria-label="' + escapeHTML(id.replace(/-/g, ' ')) + '; scroll sideways on small screens"><table class="crm-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>' + (rows.length > limit ? '<div class="table-more"><span>Showing ' + formatNumber(limit) + ' of ' + formatNumber(rows.length) + '</span><button class="button button-quiet" type="button" data-more-table="' + id + '">Show ' + formatNumber(Math.min(25, rows.length - limit)) + ' more</button></div>' : '');
    return rows.length;
  }

  function niceCeiling(maximum) {
    if (maximum <= 4) return 4;
    var raw = maximum / 4;
    var magnitude = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var step = [1, 2, 2.5, 5, 10].map(function (factor) { return factor * magnitude; }).filter(function (value) { return value >= raw; })[0];
    return Math.round(step * 4);
  }

  function barPath(x, y, width, height) {
    var radius = Math.min(4, width / 2, height);
    return 'M' + x.toFixed(2) + ',' + (y + height).toFixed(2) + 'V' + (y + radius).toFixed(2) + 'Q' + x.toFixed(2) + ',' + y.toFixed(2) + ' ' + (x + radius).toFixed(2) + ',' + y.toFixed(2) + 'H' + (x + width - radius).toFixed(2) + 'Q' + (x + width).toFixed(2) + ',' + y.toFixed(2) + ' ' + (x + width).toFixed(2) + ',' + (y + radius).toFixed(2) + 'V' + (y + height).toFixed(2) + 'Z';
  }

  // Vertical column chart with gridlines, axis labels and a per-column hover target.
  function columnChart(rows, options) {
    var width = options.width, height = options.height, left = 40, right = 6, top = 12, bottom = 26;
    var innerWidth = width - left - right, innerHeight = height - top - bottom;
    var maximum = Math.max.apply(null, rows.map(function (row) { return row.value; }).concat([1]));
    var ceiling = niceCeiling(maximum);
    var slot = innerWidth / rows.length;
    var barWidth = Math.max(1.5, Math.min(slot - 2, slot * 0.72, 28));
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
      var barHeight = row.value / ceiling * innerHeight;
      return '<g class="column" data-tip="' + escapeHTML(row.tip) + '"><rect class="column-hit" x="' + (left + slot * index).toFixed(2) + '" y="' + top + '" width="' + slot.toFixed(2) + '" height="' + innerHeight + '"/>' + (row.value ? '<path class="column-bar" d="' + barPath(x, y(row.value), barWidth, barHeight) + '"/>' : '') + '</g>';
    }).join('');
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHTML(options.title) + '">' + svg + '</svg>';
  }

  function renderTrendControls() {
    document.getElementById('trend-metric').innerHTML = trendMetrics.map(function (metric) {
      return '<button type="button" data-trend="' + metric[0] + '" aria-pressed="' + (metric[0] === trendMetric) + '">' + metric[1] + '</button>';
    }).join('');
  }

  function renderChart(data) {
    var rows = dailyRows(data);
    if (rows.length && rows[0][trendMetric] == null) trendMetric = 'visits';
    var metric = trendMetrics.filter(function (item) { return item[0] === trendMetric; })[0];
    var target = document.getElementById('daily-chart');
    renderTrendControls();
    document.getElementById('trend-subtitle').textContent = metric[3] + ' · UTC';
    document.getElementById('daily-data').innerHTML = rows.length ? '<table><caption class="sr-only">Daily activity in UTC</caption><thead><tr><th scope="col">Date (UTC)</th>' + trendMetrics.map(function (item) { return '<th scope="col" class="num">' + item[1] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.slice().reverse().map(function (row) { return '<tr><th scope="row">' + escapeHTML(row.date) + '</th>' + trendMetrics.map(function (item) { return '<td class="num">' + (row[item[0]] == null ? '—' : formatNumber(row[item[0]])) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' : emptyHTML('No daily records yet.', '');
    var total = rows.reduce(function (sum, row) { return sum + count(row[trendMetric]); }, 0);
    if (!rows.length || !total) {
      target.innerHTML = emptyHTML('No ' + metric[2] + ' recorded in this period.', rows.length && rows[0][trendMetric] == null ? 'This metric needs the updated analytics API.' : 'The chart fills in day by day as activity is recorded.');
      return;
    }
    var labels = [];
    var step = Math.max(1, Math.ceil(rows.length / 6));
    for (var index = 0; index < rows.length; index += step) labels.push(index);
    if (labels[labels.length - 1] !== rows.length - 1 && rows.length - 1 - labels[labels.length - 1] >= step / 2) labels.push(rows.length - 1);
    // Daily unique visitors don't add up to the period's unique visitors, so show the real total.
    var headline = trendMetric === 'visitors' && data.summary ? '<strong>' + formatNumber(data.summary.visitors) + '</strong> different visitor browsers in ' + rows.length + ' days' : '<strong>' + formatNumber(total) + '</strong> ' + escapeHTML(metric[2]) + ' in ' + rows.length + ' days';
    target.innerHTML = '<div class="trend-total">' + headline + ' · average ' + (Math.round(total / rows.length * 10) / 10).toLocaleString() + ' a day</div>' + columnChart(rows.map(function (row) {
      return { value: count(row[trendMetric]), label: formatDate(row.date, false), tip: formatDate(row.date, false) + ' · ' + formatNumber(row[trendMetric]) + ' ' + metric[2] };
    }), { width: 720, height: 250, labels: labels, title: metric[3] + ' in UTC. Open the table below the chart for every value.' });
  }

  function renderHours(data) {
    var target = document.getElementById('hours');
    if (!Array.isArray(data.hours) || data.hours.length !== 24) { unavailable('hours'); return; }
    var total = data.hours.reduce(function (sum, value) { return sum + count(value); }, 0);
    if (!total) { target.innerHTML = emptyHTML('No page views yet.', 'Busy hours show up once visits are recorded.'); return; }
    var peak = data.hours.indexOf(Math.max.apply(null, data.hours.map(count)));
    target.innerHTML = '<p class="hours-peak">Busiest hour <strong>' + ('0' + peak).slice(-2) + ':00–' + ('0' + ((peak + 1) % 24)).slice(-2) + ':00 UTC</strong></p>' + columnChart(data.hours.map(function (value, hour) {
      var label = ('0' + hour).slice(-2) + ':00';
      return { value: count(value), label: label, tip: label + '–' + ('0' + ((hour + 1) % 24)).slice(-2) + ':00 UTC · ' + formatNumber(value) + ' page views' };
    }), { width: 360, height: 190, labels: [0, 6, 12, 18], title: 'Page views by hour of day, UTC' });
  }

  function renderFunnel(data) {
    var target = document.getElementById('funnel');
    var summary = data.summary, engagement = data.engagement;
    if (!engagement) { unavailable('funnel'); return; }
    var visitors = count(summary.visitors);
    if (!visitors) { target.innerHTML = emptyHTML('No visitors yet.', 'Each step fills in as people browse, play and share.'); return; }
    var steps = [
      ['Visited the library', visitors],
      ['Opened an item', engagement.openedVisitors],
      ['Played or saved something', engagement.engagedVisitors],
      ['Started a share', engagement.sharedVisitors]
    ];
    target.innerHTML = '<ol class="funnel-steps">' + steps.map(function (step, index) {
      var share = percentage(step[1], visitors);
      return '<li class="funnel-step step-' + index + '" data-tip="' + escapeHTML(step[0] + ': ' + formatNumber(step[1]) + ' visitor browsers (' + share + ')') + '"><div class="funnel-labels"><span>' + escapeHTML(step[0]) + '</span><span class="funnel-value">' + formatNumber(step[1]) + '<small>' + share + '</small></span></div><div class="funnel-track" aria-hidden="true"><span style="width:' + Math.max(count(step[1]) ? 1.5 : 0, Math.min(100, count(step[1]) / visitors * 100)).toFixed(2) + '%"></span></div></li>';
    }).join('') + '</ol><p class="funnel-foot"><strong>' + formatNumber(engagement.arrivedBySharedLink) + '</strong> visitor ' + (count(engagement.arrivedBySharedLink) === 1 ? 'browser' : 'browsers') + ' arrived through a shared link.</p>';
  }

  function renderInsights(data) {
    var summary = data.summary;
    var insights = [];
    var languageRows = Array.isArray(data.languageTable) ? tableRows(data.languageTable, 'visitors') : data.languages;
    var language = positiveRows(languageRows).filter(function (row) { return !/^(unknown|unspecified)$/i.test(row.name); })[0];
    var countryRows = Array.isArray(data.countryTable) ? tableRows(data.countryTable, 'visitors') : data.countries;
    var country = positiveRows(countryRows).filter(function (row) { return !/^(unknown|xx)$/i.test(row.name); })[0];
    var resource = positiveRows(data.resources)[0];
    var peak = peakDay(dailyRows(data), 'visits');
    var unit = Array.isArray(data.languageTable) ? 'visitor browsers' : 'page views';
    var base = Array.isArray(data.languageTable) ? summary.visitors : summary.pageViews;
    if (language) insights.push(['Leading language', languageName(language.name) + ' · ' + formatNumber(language.count) + ' ' + unit + ' (' + percentage(language.count, base) + ')']);
    if (country) insights.push(['Leading country', countryLabel(country.name) + ' · ' + formatNumber(country.count) + ' ' + unit]);
    if (resource) insights.push(['Most opened item', resourceTitle(resource.name) + ' · opened ' + formatNumber(resource.count) + (count(resource.count) === 1 ? ' time' : ' times')]);
    if (peak) insights.push(['Busiest day', formatDate(peak.date, false) + ' · ' + formatNumber(peak.visits) + ' page views']);
    if (count(summary.sharedVisits)) insights.push(['Shared links are working', formatNumber(summary.sharedVisits) + ' visits came from a shared link']);
    else if (count(summary.shareIntents)) insights.push(['Sharing has started', formatNumber(summary.shareIntents) + ' share attempts; no visits from shared links yet']);
    document.getElementById('insights').innerHTML = insights.length ? '<dl class="insights">' + insights.slice(0, 5).map(function (insight) {
      return '<div class="insight"><dt>' + escapeHTML(insight[0]) + '</dt><dd>' + escapeHTML(insight[1]) + '</dd></div>';
    }).join('') + '</dl>' : emptyHTML('Ready for the first visit.', 'Highlights appear after consented online activity is recorded. Nothing here is estimated or sampled.');
  }

  function renderSignals(data) {
    var summary = data.summary;
    var engagement = data.engagement || {};
    document.getElementById('sharing-signals').innerHTML = [
      kpiHTML('Share attempts', formatNumber(summary.shareIntents), 'Link actions, guides and nearby offers', 'share', sparkHTML(dailyRows(data), 'shares'), true),
      kpiHTML('Confirmed share actions', formatNumber(summary.shareCompletions), 'Includes locally confirmed copied links', 'check'),
      kpiHTML('Shared-link visits', formatNumber(summary.sharedVisits), data.engagement ? formatNumber(engagement.arrivedBySharedLink) + ' visitor browsers arrived this way' : 'Openings of attributed links', 'link'),
      kpiHTML('Files saved', formatNumber(summary.downloads), 'Download saves confirmed in the app', 'download'),
      kpiHTML('Nearby batches received', formatNumber(summary.transfers), 'Receiver confirmed the data arrived', 'transfer')
    ].join('');
  }

  function renderBreakdowns(data) {
    var summary = data.summary;
    var hasLanguageTable = Array.isArray(data.languageTable);
    var hasCountryTable = Array.isArray(data.countryTable);
    var subFor = function (key, unit) { return function (row) { return row.extra && row.extra[key] != null ? formatNumber(row.extra[key]) + ' ' + unit : ''; }; };
    var withExtra = function (values, key) { return Array.isArray(values) ? values.filter(function (row) { return row && typeof row === 'object'; }).map(function (row) { return { name: row.name, count: count(row[key]), extra: row }; }) : null; };
    renderBars('languages', hasLanguageTable ? withExtra(data.languageTable, 'visitors') : data.languages, { label: languageName, total: hasLanguageTable ? summary.visitors : totalFor(data, 'languages', summary.pageViews), unit: hasLanguageTable ? 'visitor browsers' : 'page views', sub: subFor('pageViews', 'page views'), empty: 'Languages appear after the first recorded visit.' });
    renderBars('countries', hasCountryTable ? withExtra(data.countryTable, 'visitors') : data.countries, { label: countryLabel, total: hasCountryTable ? summary.visitors : totalFor(data, 'countries', summary.pageViews), unit: hasCountryTable ? 'visitor browsers' : 'page views', sub: subFor('pageViews', 'page views'), empty: 'Countries appear after the first recorded visit.' });
    renderBars('resources', data.resources, { label: resourceTitle, tooltip: resourceTooltip, total: totalFor(data, 'resources'), unit: 'openings', sub: function (row) { return resourceMeta(row.name); }, limit: 7, empty: 'Items appear here once someone opens one.' });
    renderHours(data);
    renderFunnel(data);
    renderBars('referrers', data.referrers, { label: referrerName, total: totalFor(data, 'referrers', summary.pageViews), unit: 'page views', limit: 8, empty: 'Referring sites appear after the first recorded visit.' });
    var number = function (key, label, bar) { return { key: key, label: label, numeric: true, bar: bar }; };
    renderTable('country-table', data.countryTable, [
      { key: 'name', label: 'Country', text: function (row) { return countryName(row.name); }, render: function (row) { return escapeHTML(countryLabel(row.name)); } },
      number('visitors', 'Visitors', true), number('pageViews', 'Page views'), number('opens', 'Opens'), number('shares', 'Shares')
    ], 'No countries recorded yet.', 'Each country gets a row after its first recorded visit.');
    renderTable('language-table', data.languageTable, [
      { key: 'name', label: 'Language', text: function (row) { return languageName(row.name); }, render: function (row) { return escapeHTML(languageName(row.name)) + (row.name && !/^(unknown|unspecified)$/i.test(row.name) ? '<small>' + escapeHTML(row.name) + '</small>' : ''); } },
      number('visitors', 'Visitors', true), number('pageViews', 'Page views'), number('opens', 'Opens'), number('shares', 'Shares'), number('saves', 'Saves')
    ], 'No languages recorded yet.', 'Each library language gets a row after its first recorded visit.');
    // Content
    if (Array.isArray(data.resourceTable) || Array.isArray(data.resources)) {
      var byType = Object.create(null);
      var source = Array.isArray(data.resourceTable) ? tableRows(data.resourceTable, 'opens') : data.resources;
      source.forEach(function (row) {
        if (!row || !count(row.count)) return;
        var info = resourceInfo[row.name];
        var type = info ? (typeNames[info.type] || readable(info.type)) : 'Not in this catalog';
        byType[type] = (byType[type] || 0) + count(row.count);
      });
      renderBars('content-types', Object.keys(byType).map(function (name) { return { name: name, count: byType[name] }; }), { total: totalFor(data, 'resources'), unit: 'openings', empty: 'Kinds of content appear once items are opened.' });
    } else unavailable('content-types');
    renderBars('content-languages', hasLanguageTable ? withExtra(data.languageTable, 'opens') : null, { label: languageName, total: totalFor(data, 'resources'), unit: 'openings', limit: 8, sub: subFor('visitors', 'visitor browsers'), empty: 'Languages appear here once items are opened.' });
    var search = document.getElementById('resource-search').value.trim().toLowerCase();
    var shown = renderTable('resource-table', data.resourceTable, [
      { key: 'name', label: 'Item', text: function (row) { return resourceTitle(row.name); }, render: function (row) { var meta = resourceMeta(row.name); return '<span class="cell-title" title="' + escapeHTML(resourceTooltip(row.name)) + '">' + escapeHTML(resourceTitle(row.name)) + '</span><small>' + escapeHTML(meta ? meta + ' · ' + row.name : row.name) + '</small>'; } },
      number('visitors', 'Visitors'), number('opens', 'Opens', true), number('plays', 'Plays'), number('saves', 'Saves'), number('shares', 'Shares')
    ], search ? 'No matching items.' : 'No content activity yet.', search ? 'Try another word or clear the search.' : 'Items get a row when someone opens, plays, saves or shares them.', search ? function (row) {
      return [row.name, resourceTitle(row.name), resourceMeta(row.name)].join(' ').toLowerCase().indexOf(search) !== -1;
    } : null);
    document.getElementById('resource-table-count').textContent = Array.isArray(data.resourceTable) ? formatNumber(shown) + (search ? ' matching items' : (shown === 1 ? ' item with activity' : ' items with activity')) + ' · select a column heading to sort' : '';
    // Sharing
    renderBars('channels', data.channels, { label: channelName, total: totalFor(data, 'channels', summary.shareIntents), unit: 'attempts', empty: 'Share methods appear after the first share attempt.' });
    renderBars('share-outcomes', data.shareOutcomes, { label: statusName, total: totalFor(data, 'shareOutcomes'), unit: 'events', empty: 'Results appear after a share action finishes.' });
    renderBars('shared-content', Array.isArray(data.resourceTable) ? tableRows(data.resourceTable, 'shares') : null, { label: resourceTitle, tooltip: resourceTooltip, total: summary.shareIntents, unit: 'share attempts', sub: function (row) { return resourceMeta(row.name); }, empty: 'Items appear here once someone shares one.' });
    renderBars('shared-languages', hasLanguageTable ? tableRows(data.languageTable, 'shares') : null, { label: languageName, total: summary.shareIntents, unit: 'share attempts', empty: 'Languages appear here after the first share attempt.' });
    // Developer
    renderBars('event-types', data.eventTypes, { label: eventTypeName, total: totalFor(data, 'eventTypes'), unit: 'events', limit: 10, empty: 'No event types recorded yet.' });
    renderBars('statuses', data.statuses, { label: statusName, total: totalFor(data, 'statuses'), unit: 'events', limit: 10, empty: 'No event statuses recorded yet.' });
    renderBars('download-outcomes', data.downloadOutcomes, { label: statusName, total: totalFor(data, 'downloadOutcomes'), unit: 'events', empty: 'No finished download events yet.' });
    renderBars('transfer-outcomes', data.transferOutcomes, { label: statusName, total: totalFor(data, 'transferOutcomes'), unit: 'events', empty: 'No finished nearby transfers yet.' });
    renderBars('pages', data.pages, { total: totalFor(data, 'pages', summary.pageViews), unit: 'page views', limit: 10, empty: 'No page views recorded yet.' });
  }

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
    document.getElementById('report-updated').textContent = 'Updated ' + new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
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
    renderChart(data);
    renderInsights(data);
    renderSignals(data);
    renderBreakdowns(data);
    populateFilter('event-filter-type', 'type', eventTypeName, 'All types');
    populateFilter('event-filter-channel', 'channel', channelName, 'All channels');
    populateFilter('event-filter-status', 'status', statusName, 'All statuses');
    renderExplorer();
    if (typeof window !== 'undefined' && window.EasyTransferAdminJourneys) window.EasyTransferAdminJourneys.render(currentEvents, {resourceTitle: resourceTitle, languageName: languageName, countryName: countryName});
    renderMetadata(data);
    var warning = document.getElementById('report-warning');
    warning.hidden = data.truncated !== true;
    warning.textContent = data.truncated === true ? 'Partial report: this period exceeds the server’s analysis limit. Counts and charts cover the newest ' + formatNumber(data.analyzedEvents || data.analysisLimit) + ' events, so totals may be lower than actual activity. Choose a shorter reporting period for a more complete view.' : '';
    document.getElementById('empty-overview').hidden = currentEvents.length > 0 || ['visitors', 'pageViews', 'shareIntents', 'sharedVisits'].some(function (key) { return count(summary[key]) > 0; });
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

  // Shared chart tooltip: any element with data-tip shows its text on hover or focus.
  var tip = document.getElementById('chart-tip');
  function tipTarget(event) { return event.target && event.target.closest ? event.target.closest('[data-tip]') : null; }
  function moveTip(event) {
    var target = tipTarget(event);
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
    var goto = origin.closest('[data-goto]');
    if (goto) { switchView(goto.getAttribute('data-goto'), true); return; }
    var more = origin.closest('[data-more-table]');
    if (more) { tableLimits[more.getAttribute('data-more-table')] += 25; renderBreakdowns(reportData); return; }
    var sort = origin.closest('[data-sort-table]');
    if (sort) {
      var id = sort.getAttribute('data-sort-table'), key = sort.getAttribute('data-sort-key');
      var state = sortState[id];
      state.dir = state.key === key ? -state.dir : (key === 'name' ? 1 : -1);
      state.key = key;
      renderBreakdowns(reportData);
      var again = document.querySelector && document.querySelector('[data-sort-table="' + id + '"][data-sort-key="' + key + '"]');
      if (again) again.focus();
    }
  });
  document.getElementById('resource-search').addEventListener('input', function () { tableLimits['resource-table'] = 25; if (reportData.summary) renderBreakdowns(reportData); });
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
