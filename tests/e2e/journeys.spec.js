// The tasks people come for, end to end: play, save and share one recording.
// Online media is answered from tests/e2e/fixtures, so a slow or changed CDN can
// never fail the build; what is tested is the app's own behaviour.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { asReturningVisitor, answerCookieBanner, watchForProblems } = require('./helpers');

const TONE = fs.readFileSync(path.join(__dirname, 'fixtures/tone.mp3'));

// Any recording or download from a DBS server is answered with the test tone.
async function serveMediaFromFixtures(page) {
  await page.route(/^https:\/\/[^/]*dbs\.org\/.*\.(mp3|zip)(\?.*)?$/, route => route.fulfill({
    status: 200, body: TONE,
    headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' },
  }));
}

// The first audio Bible on the English library page, as a visitor would find it, so
// the test follows the catalogue instead of hard-coding an id that may change.
async function firstAudioBible(page) {
  await asReturningVisitor(page);
  await page.goto('/english');
  await answerCookieBanner(page);
  const link = page.locator('a[href*="item.html?id="][href*="audio-bible"]').first();
  await expect(link).toBeAttached();
  return link.getAttribute('href');
}

async function openItem(page) {
  const href = await firstAudioBible(page);
  await serveMediaFromFixtures(page);
  const problems = watchForProblems(page);
  await page.goto('/' + href);
  await answerCookieBanner(page);
  await expect(page.locator('#item h1, #item h2').first()).toBeVisible();
  return problems;
}

test('play: an audio Bible chapter starts playing', async ({ page }) => {
  const problems = await openItem(page);
  const player = page.locator('#a');
  await expect(player).toHaveAttribute('src', /dbs\.org\/.+\.mp3/);
  await player.scrollIntoViewIfNeeded();
  await player.click();                                  // a real tap, so autoplay rules allow it
  await player.evaluate(a => a.play().catch(() => {}));
  await expect.poll(() => player.evaluate(a => a.currentTime), { timeout: 10000 }).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test('save: the recording downloads intact', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'iPhone Safari hands downloads to the share sheet; covered in the manual pass');
  const problems = await openItem(page);
  await page.locator('#save').click();
  const flow = page.locator('#save-flow');
  await expect(flow).toBeVisible();
  // Step 1 lists the files when there is more than one; take the chapter that is open.
  const first = flow.locator('[data-i]').first();
  if (await first.count()) await first.click();
  const download = page.waitForEvent('download');
  await flow.locator('[data-w="downloads"]').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.(mp3|zip)$/);
  expect(fs.readFileSync(await file.path()).equals(TONE), 'saved file matches the recording').toBe(true);
  // Kandili's celebration, or the green tick where the mascot can't draw.
  await expect(flow.locator('.cheer, .done-mark').first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('share: WhatsApp and Telegram open with a link back to this recording', async ({ page }) => {
  const problems = await openItem(page);
  await page.locator('#share').click();
  const whatsapp = page.locator('[data-s="whatsapp"]');
  await expect(whatsapp).toBeVisible();
  const wa = new URL(await whatsapp.getAttribute('href'));
  expect(wa.host).toBe('wa.me');
  const id = new URL(page.url()).searchParams.get('id');
  expect(wa.searchParams.get('text')).toContain(`id=${id}`);
  const tg = new URL(await page.locator('[data-s="telegram"]').getAttribute('href'));
  expect(tg.host).toBe('t.me');
  expect(tg.searchParams.get('url')).toContain(`id=${id}`);
  // Send to a phone nearby goes to Nearby with this recording ready to send.
  await page.locator('[data-s="nearby"]').click();
  await expect(page).toHaveURL(new RegExp(`nearby\\.html\\?.*id=${id}`));
  expect(problems).toEqual([]);
});

test('library: find a film by name and open it', async ({ page }) => {
  await asReturningVisitor(page);
  const problems = watchForProblems(page);
  await page.goto('/library.html');
  await answerCookieBanner(page);
  await page.locator('input[type="search"]').first().fill('Jesus');
  const result = page.locator('a[href*="item.html?id="][href*="film"]').first();
  await expect(result).toBeVisible();
  const id = new URL(await result.getAttribute('href'), page.url()).searchParams.get('id');
  await result.click();
  await expect(page).toHaveURL(new RegExp(`item\\.html\\?.*id=${id}`));
  await expect(page.locator('#v, video').first()).toBeAttached();
  expect(problems).toEqual([]);
});
