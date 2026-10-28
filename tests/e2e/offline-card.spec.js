// The library opened straight off a microSD card (file://), with no server and no internet.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { APP, asReturningVisitor, answerCookieBanner } = require('./helpers');

test.skip(({ browserName }) => browserName !== 'chromium', 'WebKit blocks file:// storage differently; covered in the manual pass');

for (const page of ['index.html', 'library.html', 'item.html', 'swahili/index.html', 'arabic/index.html']) {
  test(`${page} opens from a card`, async ({ page: tab }) => {
    await asReturningVisitor(tab);
    const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    await tab.goto(pathToFileURL(path.join(APP, page)).href);
    await answerCookieBanner(tab);
    await expect(tab).toHaveTitle(/\S/);
    await expect(tab.locator('main, #main').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
