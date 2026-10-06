import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';

async function forceEnglish(page) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.textContent().catch(() => '');
    const visible = await btn.isVisible().catch(() => false);
    if (text.includes('ES') && visible) {
      await btn.click();
      await new Promise(r => setTimeout(r, 2500));
      return true;
    }
  }
  return false;
}

async function hideBanner(page) {
  await page.evaluate(() => {
    document.querySelectorAll('div').forEach(el => {
      const text = el.textContent || '';
      const rect = el.getBoundingClientRect();
      if ((text.includes('temporary') || text.includes('development preview')) && rect.height < 80 && rect.top < 50) {
        el.style.display = 'none';
      }
    });
  });
  await new Promise(r => setTimeout(r, 300));
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  // 1) Laptop screenshot (1440x900) - Landing page, English, no banner
  console.log('Capturing laptop screenshot...');
  const lCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lPage = await lCtx.newPage();
  await lPage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await forceEnglish(lPage);
  await hideBanner(lPage);
  await new Promise(r => setTimeout(r, 500));
  const lText = await lPage.textContent('body');
  console.log('  Laptop lang:', lText.includes('The Best Way') ? 'EN' : 'ES');
  await lPage.screenshot({ path: 'attached_assets/pitch_deck/screenshot_landing.png' });
  console.log('Laptop done!');
  await lCtx.close();

  // 2) Tablet screenshot (820x1180) - Quote flow step 1, English
  console.log('Capturing tablet screenshot...');
  const tCtx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const tPage = await tCtx.newPage();
  await tPage.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  const loginOk = await tPage.evaluate(async () => {
    const res = await fetch('/api/auth/email-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cliente@demo.com', password: 'demo123' })
    });
    return res.ok;
  });
  console.log('  Login:', loginOk);
  await new Promise(r => setTimeout(r, 1000));
  await tPage.goto(BASE + '/dashboard/new-quote', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  await forceEnglish(tPage);
  await hideBanner(tPage);
  await new Promise(r => setTimeout(r, 500));
  await tPage.screenshot({ path: 'attached_assets/pitch_deck/screenshot_tablet.png' });
  console.log('Tablet done!');
  await tCtx.close();

  // 3) Mobile screenshot (390x844) - Landing page mobile, English
  console.log('Capturing mobile screenshot...');
  const mCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const mPage = await mCtx.newPage();
  await mPage.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await forceEnglish(mPage);
  await hideBanner(mPage);
  await new Promise(r => setTimeout(r, 500));
  const mText = await mPage.textContent('body');
  console.log('  Mobile lang:', mText.includes('The Best Way') ? 'EN' : 'ES');
  await mPage.screenshot({ path: 'attached_assets/pitch_deck/screenshot_mobile.png' });
  console.log('Mobile done!');
  await mCtx.close();

  await browser.close();
  console.log('All screenshots captured!');
})();
