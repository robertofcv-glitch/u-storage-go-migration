import { chromium } from 'playwright';

const BASE_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const OUT = '/home/runner/workspace/attached_assets/pitch_deck';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await delay(2000);
  await page.fill('[data-testid="input-login-email"]', email);
  await page.fill('[data-testid="input-login-password"]', password);
  await delay(300);
  await page.click('[data-testid="button-email-login"]');
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => {});
  await delay(2000);
  console.log('  After login URL:', page.url());
}

async function switchToEnglish(page) {
  try {
    // Look for language toggle - it shows current lang code
    const toggle = page.locator('button:has-text("ES")').first();
    if (await toggle.isVisible({ timeout: 2000 })) {
      await toggle.click();
      await delay(1500);
      console.log('  Switched to English');
    }
  } catch (e) {
    console.log('  Language toggle not found');
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    // ===== SCREENSHOT 1: LANDING PAGE (English) =====
    console.log('1. Landing page...');
    const ctx1 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    const p1 = await ctx1.newPage();

    // Set i18next language to English via localStorage before navigating
    await p1.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p1.evaluate(() => { localStorage.setItem('i18nextLng', 'en'); });
    await p1.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await delay(3000);
    await switchToEnglish(p1);
    await delay(1000);

    // Hide the Replit dev banner if present
    await p1.evaluate(() => {
      const banner = document.querySelector('[class*="dev-banner"], [class*="replit-dev-banner"]');
      if (banner) banner.style.display = 'none';
      // Also remove any top banner
      const topBanners = document.querySelectorAll('div[style*="background"][style*="fixed"]');
      topBanners.forEach(b => b.style.display = 'none');
    });
    await delay(500);

    await p1.screenshot({ path: `${OUT}/screenshot_landing.png` });
    console.log('  Landing captured!');
    await ctx1.close();

    // ===== SCREENSHOT 2: RUKUBERTO / NEW QUOTE (Client) =====
    console.log('2. Rukuberto chat...');
    const ctx2 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    const p2 = await ctx2.newPage();
    // Set English
    await p2.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await p2.evaluate(() => { localStorage.setItem('i18nextLng', 'en'); });

    await login(p2, 'beta.maria@test.com', 'demo123');
    await p2.goto(`${BASE_URL}/dashboard/new-quote`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(4000);

    // Hide dev banner
    await p2.evaluate(() => {
      document.querySelectorAll('[class*="dev-banner"], [class*="replit"]').forEach(el => {
        if (el.textContent && el.textContent.includes('temporary')) el.style.display = 'none';
      });
    });
    await delay(500);

    await p2.screenshot({ path: `${OUT}/screenshot_rukuberto.png` });
    console.log('  Rukuberto captured!');
    await ctx2.close();

    // ===== SCREENSHOT 3: ADMIN ACTIVITY =====
    console.log('3. Admin activity...');
    const ctx3 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' }
    });
    const p3 = await ctx3.newPage();
    // Set English
    await p3.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await p3.evaluate(() => { localStorage.setItem('i18nextLng', 'en'); });

    await login(p3, 'admin@rukumove.com', 'admin123');
    await p3.goto(`${BASE_URL}/admin/dashboard/activity`, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(4000);

    // Hide dev banner
    await p3.evaluate(() => {
      document.querySelectorAll('[class*="dev-banner"], [class*="replit"]').forEach(el => {
        if (el.textContent && el.textContent.includes('temporary')) el.style.display = 'none';
      });
    });
    await delay(500);

    await p3.screenshot({ path: `${OUT}/screenshot_activity.png` });
    console.log('  Activity captured!');
    await ctx3.close();

    console.log('\nAll 3 screenshots done!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

main();
