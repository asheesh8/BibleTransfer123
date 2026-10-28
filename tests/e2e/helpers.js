// Shared setup for the browser tests: a returning English visitor who has answered
// the cookie banner, and a watch on everything that goes wrong on the page.
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');

const APP = path.resolve(__dirname, '../../app');

// Every one-language library, from the language registry, so a new language is tested
// the moment it is added there: [slug, ISO code, English name, native name].
function languageRoutes() {
  const registry = JSON.parse(fs.readFileSync(path.join(APP, '../registry/languages.json'), 'utf8'));
  return registry.languages.map(l => [l.slug, l.lang, l.name, l.native]);
}

// Pages whose interface reads right to left.
const RTL = new Set(['arabic', 'urdu', 'pashto', 'sindhi', 'western-punjabi']);

// Skip the first-visit language picker; the picker has its own test.
async function asReturningVisitor(page, lang = 'en') {
  await page.addInitScript(code => {
    try { localStorage.setItem('et.lang', code); localStorage.setItem('et.langknown', '1'); } catch (e) {}
  }, lang);
}

async function answerCookieBanner(page) {
  const reject = page.locator('#et-consent [data-consent="reject"]');
  try { await reject.waitFor({ state: 'visible', timeout: 3000 }); } catch (e) { return; }  // already answered
  await reject.click();
  await expect(page.locator('#et-consent')).toBeHidden();
}

// Collects script errors and broken same-site requests. `allow` lists URL parts that
// may fail on purpose (e.g. /api/admin with no database behind the test server).
function watchForProblems(page, allow = []) {
  const problems = [];
  const allowed = url => allow.some(part => url.includes(part));
  page.on('pageerror', error => problems.push('script error: ' + error.message));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && url.startsWith(page.url().split('/').slice(0, 3).join('/')) && !allowed(url))
      problems.push(response.status() + ' ' + url);
  });
  return problems;
}

async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls sideways by this many px').toBeLessThanOrEqual(1);
}

// Controls smaller than the design rule. Reported for now, enforced once W6 sets the size.
async function smallTouchTargets(page, min = 56) {
  return page.evaluate(min => [...document.querySelectorAll('button, a[href], [role=button], input, select')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden' && r.height < min; })
    .map(el => `${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} (${Math.round(el.getBoundingClientRect().height)}px)`), min);
}

module.exports = { APP, RTL, languageRoutes, asReturningVisitor, answerCookieBanner, watchForProblems, expectNoSidewaysScroll, smallTouchTargets };
