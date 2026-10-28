// Phone to phone with Nearby: a sender and a receiver, each its own browser with its own
// storage, joined only through the app over the Pi server's local signalling (no internet).
// Each pairing runs the sender and receiver on their real engines (iPhone = WebKit,
// Android = Chromium); with E2E_ENGINES=chromium both run in Chromium at their phone sizes.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test, expect, chromium, webkit, devices } = require('@playwright/test');
const { asReturningVisitor, answerCookieBanner, watchForProblems } = require('./helpers');

const PHONES = {
  iPhone: { engine: 'webkit', device: devices['iPhone 15'] },
  Android: { engine: 'chromium', device: { ...devices['Galaxy S8'], viewport: { width: 360, height: 740 } } },
};
const PAIRS = [['iPhone', 'Android'], ['Android', 'iPhone'], ['Android', 'Android']];
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

async function phone(name, baseURL, browsers) {
  const { engine, device } = PHONES[name];
  const use = process.env.E2E_ENGINES === 'chromium' ? 'chromium' : engine;
  // Browsers hide their local address behind a random name.local, which real phones on the
  // same Wi-Fi resolve over multicast DNS but a test machine cannot, so WebKit and Chromium
  // never find each other. Letting the Android browser show its address, as a phone that
  // granted camera access does, lets the iPhone reach it; the Pi path is otherwise unchanged.
  const args = use === 'chromium' ? ['--disable-features=WebRtcHideLocalIpsWithMdns'] : [];
  browsers[use] = browsers[use] || await (use === 'webkit' ? webkit : chromium).launch({ args });
  const { defaultBrowserType, ...options } = device;
  const context = await browsers[use].newContext({ ...options, baseURL, acceptDownloads: true });
  const page = await context.newPage();
  await asReturningVisitor(page);
  return page;
}

for (const [from, to] of PAIRS) {
  test(`${from} sends a file to ${to} with a 6-digit code`, async ({ baseURL }, info) => {
    const browsers = {};
    try {
      const sender = await phone(from, baseURL, browsers);
      const receiver = await phone(to, baseURL, browsers);
      const problems = [...[sender, receiver].map(p => watchForProblems(p))];
      await Promise.all([sender.goto('/nearby.html?signal=local'), receiver.goto('/nearby.html?signal=local')]);
      await answerCookieBanner(sender);
      await answerCookieBanner(receiver);

      await sender.locator('#r-send').click();
      const code = (await sender.locator('.code').innerText()).replace(/\D/g, '');
      expect(code).toMatch(/^\d{6}$/);
      await receiver.locator('#r-recv').click();
      await receiver.locator('#code-in').fill(code);   // joins as soon as six digits are in

      const file = path.join(info.outputDir, 'psalm-23.mp3');
      const sent = crypto.randomBytes(512 * 1024);
      fs.mkdirSync(info.outputDir, { recursive: true });
      fs.writeFileSync(file, sent);
      await sender.locator('#pick-file').setInputFiles(file, { timeout: 30000 });
      await receiver.locator('#acc').click({ timeout: 30000 });

      const download = receiver.waitForEvent('download', { timeout: 60000 });
      await receiver.locator('[data-download="0"]').click({ timeout: 60000 });
      const got = await download;
      expect(got.suggestedFilename()).toBe('psalm-23.mp3');
      const saved = path.join(info.outputDir, 'received.mp3');
      await got.saveAs(saved);
      expect(sha256(fs.readFileSync(saved)), 'received file matches what was sent').toBe(sha256(sent));
      expect(problems.flat()).toEqual([]);
    } finally {
      await Promise.all(Object.values(browsers).map(b => b.close()));
    }
  });
}

// The camera route: the receiver never taps Receive or types. Its camera opens the
// link inside the sender's QR code, and the page joins by itself.
for (const [from, to] of [['iPhone', 'Android'], ['Android', 'iPhone']]) {
  test(`${from} sends a file to ${to} that scanned its QR code`, async ({ baseURL }, info) => {
    const browsers = {};
    try {
      const sender = await phone(from, baseURL, browsers);
      const receiver = await phone(to, baseURL, browsers);
      const problems = [...[sender, receiver].map(p => watchForProblems(p))];
      await sender.goto('/nearby.html?signal=local');
      await answerCookieBanner(sender);
      await sender.locator('#r-send').click();
      await expect(sender.locator('.et-qr svg path')).toHaveCount(1);
      const link = await sender.locator('.et-qr').getAttribute('data-join');
      expect(link).toMatch(/\/nearby\.html\?signal=local&join=\d{6}$/);

      await receiver.goto(link);
      await answerCookieBanner(receiver);
      // The code is forgotten as soon as it is used, so a reload cannot reuse it.
      await expect(receiver).not.toHaveURL(/join=/);

      const file = path.join(info.outputDir, 'john-3.mp3');
      const sent = crypto.randomBytes(256 * 1024);
      fs.mkdirSync(info.outputDir, { recursive: true });
      fs.writeFileSync(file, sent);
      await sender.locator('#pick-file').setInputFiles(file, { timeout: 30000 });
      await receiver.locator('#acc').click({ timeout: 30000 });

      const download = receiver.waitForEvent('download', { timeout: 60000 });
      await receiver.locator('[data-download="0"]').click({ timeout: 60000 });
      const got = await download;
      const saved = path.join(info.outputDir, 'received.mp3');
      await got.saveAs(saved);
      expect(sha256(fs.readFileSync(saved)), 'received file matches what was sent').toBe(sha256(sent));
      expect(problems.flat()).toEqual([]);
    } finally {
      await Promise.all(Object.values(browsers).map(b => b.close()));
    }
  });
}

test('a wrong code tells the receiver, instead of waiting forever', async ({ baseURL }) => {
  test.setTimeout(60000);
  const browsers = {};
  try {
    const receiver = await phone('Android', baseURL, browsers);
    await receiver.goto('/nearby.html?signal=local');
    await answerCookieBanner(receiver);
    await receiver.locator('#r-recv').click();
    await receiver.locator('#code-in').fill('000000');
    // Local signalling cannot say "nobody has that code", so the app gives up after 20 s.
    await expect(receiver.locator('#code-in')).toBeVisible({ timeout: 30000 });
    await expect(receiver.locator('.note')).toBeVisible();
  } finally {
    await Promise.all(Object.values(browsers).map(b => b.close()));
  }
});
