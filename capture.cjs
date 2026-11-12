const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1280,height:950},deviceScaleFactor:1,timezoneId:'UTC'});
  page.on('pageerror', error => console.error(error.message));
  await page.route('**/api/**', route => route.abort());
  await page.goto('http://localhost:8081/.fe284-preview.html');
  await page.waitForFunction(() => window.previewReady);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path:`/workspace/fe284-evidence/${process.argv[2]}.png`,fullPage:true});
  console.log(await page.locator('main').innerText());
  await browser.close();
})();
