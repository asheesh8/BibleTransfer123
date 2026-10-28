// Browser tests for EasyTransfer. Dev-only: Playwright never ships to a phone or a card.
// Run: npm run test:e2e   (all device projects)
//      E2E_ENGINES=chromium npm run test:e2e   (where WebKit is not installed; iPhone screens then run in Chromium)
// See docs/guides/testing.md.
const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.E2E_PORT || 8095);
const chromiumOnly = process.env.E2E_ENGINES === 'chromium';

// The phones the people we serve hold: small, older Androids first, then iPhones.
const androidSmall = { ...devices['Galaxy S8'], viewport: { width: 360, height: 740 } };
const androidTiny = { ...devices['Galaxy S8'], viewport: { width: 320, height: 640 }, deviceScaleFactor: 2 };
const iphone = device => chromiumOnly ? { ...devices[device], defaultBrowserType: 'chromium' } : devices[device];

module.exports = defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // The same server a VillageServer Raspberry Pi runs, so Nearby uses local signalling.
  webServer: {
    command: `python3 packer/serve.py ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  projects: [
    { name: 'android-small', use: { ...androidSmall, browserName: 'chromium' }, testIgnore: /two-phones/ },
    { name: 'android-tiny', use: { ...androidTiny, browserName: 'chromium' }, testIgnore: /two-phones/ },
    { name: 'pixel', use: { ...devices['Pixel 7'], browserName: 'chromium' }, testIgnore: /two-phones/ },
    { name: 'iphone-se', use: { ...iphone('iPhone SE'), browserName: iphone('iPhone SE').defaultBrowserType }, testIgnore: /two-phones/ },
    { name: 'iphone-15', use: { ...iphone('iPhone 15'), browserName: iphone('iPhone 15').defaultBrowserType }, testIgnore: /two-phones/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /two-phones/ },
    // Two phones in one test, each launched on its own engine (see two-phones.spec.js).
    { name: 'two-phones', testMatch: /two-phones/ },
  ],
});
