// Every screen opens on every phone: no script errors, no broken same-site files,
// no sideways scrolling. Language pages are checked on the two smallest phones.
const { test, expect } = require('@playwright/test');
const { RTL, languageRoutes, asReturningVisitor, answerCookieBanner, watchForProblems, expectNoSidewaysScroll, smallTouchTargets } = require('./helpers');

const SCREENS = [
  ['/', 'home'],
  ['/library.html', 'library'],
  ['/item.html', 'item'],
  ['/share.html', 'share'],
  ['/nearby.html', 'nearby'],
  ['/save-guide.html', 'save guide'],
  ['/help.html', 'help'],
  ['/privacy.html', 'privacy'],
  ['/share-libraries', 'share libraries'],
  ['/admin/', 'admin sign-in'],
];

test.describe('screens', () => {
  for (const [url, name] of SCREENS) {
    test(`${name} opens cleanly`, async ({ page }, info) => {
      await asReturningVisitor(page);
      // The test server has no analytics database, so the admin API answers 503 by design.
      const problems = watchForProblems(page, ['/api/admin']);
      await page.goto(url);
      await answerCookieBanner(page);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator('body')).toBeVisible();
      await expectNoSidewaysScroll(page);
      expect(problems).toEqual([]);
      const small = await smallTouchTargets(page);
      if (small.length) info.annotations.push({ type: 'touch targets under 56px', description: small.slice(0, 8).join(', ') + (small.length > 8 ? ` and ${small.length - 8} more` : '') });
    });
  }
});

test.describe('first visit', () => {
  test('a new visitor picks a language, then sees the cookie choice', async ({ page }) => {
    const problems = watchForProblems(page);
    await page.goto('/');
    await expect(page.locator('#et-welcome')).toBeVisible();
    await page.locator('#et-welcome-q').fill('swahili');
    await page.locator('#et-welcome [data-lang]:visible').first().click();
    await expect(page.locator('#et-welcome')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', /^sw/);
    await answerCookieBanner(page);
    expect(problems).toEqual([]);
  });
});

test.describe('language libraries', () => {
  // 57 pages x 6 phones is slow for little gain: check them on the two smallest phones.
  test.beforeEach(({}, info) => test.skip(!['android-small', 'iphone-se'].includes(info.project.name), 'checked on the two smallest phones'));
  for (const [slug, iso, english] of languageRoutes()) {
    test(`${english} (/${slug}) opens`, async ({ page }) => {
      await asReturningVisitor(page);
      const problems = watchForProblems(page);
      await page.goto('/' + slug);
      await answerCookieBanner(page);
      await expect(page).toHaveTitle(/\S/);
      await expect(page.locator('main, #main').first()).toBeVisible();
      if (RTL.has(slug)) await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expectNoSidewaysScroll(page);
      expect(problems).toEqual([]);
    });
  }
});
