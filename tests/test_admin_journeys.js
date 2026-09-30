// Grouping, chronological actions and safe, persistent disclosure rendering.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let previousDetails = [];
const target = {
  innerHTML: '', listeners: {},
  querySelectorAll() { return previousDetails; },
  addEventListener(type, callback) { this.listeners[type] = callback; }
};
const sandbox = {window: {}, document: {getElementById() { return target; }}};
vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname, '../app/assets/js/admin-journeys.js'), 'utf8'), sandbox);
const render = sandbox.window.EasyTransferAdminJourneys.render;
const base = {visitorId: 'v1', sessionId: 's1', country: 'US', type: 'page_view', path: '/', language: 'en'};
const events = [
  {...base, id: 'new', at: '2026-09-30T12:02:00Z', country: 'XX', resource: 'last-action'},
  {...base, id: 'old', at: '2026-09-30T12:00:00Z', resource: '<img src=x onerror=alert(1)>'},
  {...base, id: 'middle', at: '2026-09-30T12:01:00Z', resource: 'middle-action'},
  {...base, id: 'other', visitorId: 'v2', country: 'PK', at: '2026-09-30T12:03:00Z'},
  {...base, id: 'invalid', at: 'invalid'}
];
render(events);
assert.match(target.innerHTML, /4 recent events from 2 anonymous browsers/);
assert.equal((target.innerHTML.match(/data-journey-key="browser:v1"/g) || []).length, 1);
assert.match(target.innerHTML, /data-journey-key="country:US"/);
assert.doesNotMatch(target.innerHTML, /data-journey-key="country:XX"/);
assert.match(target.innerHTML, /🇺🇸/);
assert.match(target.innerHTML, /🇵🇰/);
assert.match(target.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(target.innerHTML, /<img src=x/);
assert.ok(target.innerHTML.indexOf('&lt;img') < target.innerHTML.indexOf('middle-action'));
assert.ok(target.innerHTML.indexOf('middle-action') < target.innerHTML.indexOf('last-action'));
previousDetails = [{open: true, getAttribute() { return 'browser:v1'; }}];
render([...events, {...base, id: 'later', at: '2026-09-30T12:04:00Z'}]);
assert.match(target.innerHTML, /data-journey-key="browser:v1" open/);
previousDetails = [{open: false, getAttribute() { return 'country:US'; }}];
render(events);
assert.match(target.innerHTML, /data-journey-key="country:US"><summary>/);
render([]);
assert.match(target.innerHTML, /will appear after consented activity/);
console.log('Journey checks passed: browser/country grouping, unknown country fallback, flags, chronological actions, escaping and disclosure persistence.');
