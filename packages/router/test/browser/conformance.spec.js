import { expect, test } from '@playwright/test';

// Runs the shared driver and router conformance suites against the browser's
// Navigation API on the page served by test/browser/server.js.
test('navigationDriver conformance', async({ page, browserName }, testInfo) => {
  let loads = 0;
  page.on('load', () => {
    if (page.url() !== 'about:blank') loads += 1;
  });

  await page.goto('/');
  await page.waitForFunction(() => window.__conformance?.done, null, { timeout: 120000 });
  const { supported, results, userAgent } = await page.evaluate(() => ({
    ...window.__conformance,
    userAgent: navigator.userAgent,
  }));

  testInfo.annotations.push({ type: 'browser', description: `${ browserName }: ${ userAgent }` });
  expect(supported, 'Navigation API and URLPattern are available').toBe(true);
  expect(loads, 'every conformance navigation stays same-document').toBe(1);

  for (const result of results) {
    await test.step(result.title, () => {
      expect.soft(result.error, result.title).toBeUndefined();
    });
  }

  const passed = results.filter(result => result.ok).length;
  testInfo.annotations.push({ type: 'conformance', description: `${ passed }/${ results.length } passed` });
  expect(results.length).toBeGreaterThan(0);
});
