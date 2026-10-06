import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

// Run against the running development app; override for CI/staging.
const baseURL = process.env.TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const executablePath = existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined;
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  for (const width of [1280, 375, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseURL}/quote`);
    await page.addStyleTag({ content: "#replit-dev-banner { display: none !important; }" });
    const trigger = page.getByTestId("button-move-availability-calendar");
    await trigger.click();
    const days = page.locator(".move-booking-calendar td button:not(:disabled)");
    // Next month always contains enough selectable dates, including near month-end.
    await page.locator(".move-booking-calendar nav button").last().click();
    await days.nth(1).click();
    await page.waitForTimeout(250);
    await page.locator(".move-booking-calendar td button:not(:disabled)").nth(4).click();
    await page.keyboard.press("Escape");
    const rows = page.locator('[data-testid^="date-row-"]');
    await rows.first().waitFor();
    assert.equal(await rows.count(), 4);
    const setStatus = async (index, status) => {
      await rows.nth(index).click();
      await page.locator('[data-radix-popper-content-wrapper] [data-state="open"]')
        .getByRole("button", { name: status, exact: true }).click();
    };
    for (let i = 0; i < 4; i++) assert.equal(await rows.nth(i).getAttribute("data-status"), "available");
    await setStatus(0, "Preferido");
    await setStatus(1, "Preferido");
    assert.equal(await rows.nth(0).getByLabel("Prioridad 1", { exact: true }).count(), 1);
    assert.equal(await rows.nth(1).getByLabel("Prioridad 2", { exact: true }).count(), 1);
    await setStatus(0, "No disponible");
    assert.equal(await rows.nth(0).getByLabel(/Prioridad/).count(), 0);
    await setStatus(1, "Disponible");
    assert.equal(await page.locator('[aria-label^="Prioridad "]').count(), 0);
    await setStatus(1, "No disponible");
    await setStatus(2, "No disponible");
    await rows.nth(3).click();
    assert.equal(await page.locator('[data-radix-popper-content-wrapper] [data-state="open"]')
      .getByRole("button", { name: "No disponible", exact: true }).isDisabled(), true);
    await page.keyboard.press("Escape");
    await setStatus(0, "Disponible");
    await rows.nth(3).click();
    assert.equal(await page.locator('[data-radix-popper-content-wrapper] [data-state="open"]')
      .getByRole("button", { name: "No disponible", exact: true }).isDisabled(), false);
    await page.keyboard.press("Escape");
    const fits = await page.getByTestId("move-date-status-list").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth
        && el.scrollWidth <= el.clientWidth;
    });
    assert.equal(fits, true, `Date list must fit at ${width}px`);
    // A fresh single-day selection hides the unnecessary list.
    await trigger.click();
    await page.locator(".move-booking-calendar nav button").last().click();
    await days.nth(10).click();
    await page.getByRole("button", { name: "Usar solo este día", exact: true }).click();
    assert.equal(await rows.count(), 0);
    console.log(`PASS ${width}px: status transitions, optional preferences, ranking, availability safeguard, single-day list, width`);
    await page.close();
  }
  for (const width of [1280, 375, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseURL}/quote`);
    await page.addStyleTag({ content: "#replit-dev-banner { display: none !important; }" });
    await page.getByTestId("button-move-availability-calendar").click();
    const calendar = page.locator(".move-booking-calendar");
    const next = calendar.locator("nav button").last();
    for (let attempts = 0;
      attempts < 6 && await calendar.locator('[data-day="2026-10-25"] button').count() === 0;
      attempts++) await next.click();
    await calendar.locator('[data-day="2026-10-25"] button').click();
    assert.equal(await calendar.locator('[data-day="2026-11-03"] button').count(), 1,
      `The following month must be visible at ${width}px`);
    await calendar.locator('[data-day="2026-11-03"] button').click();
    assert.match(await page.getByTestId("button-move-availability-calendar").innerText(), /25 oct.*3 nov/i);
    const confirmDates = page.getByRole("button", { name: "Confirmar fechas", exact: true });
    assert.equal(await confirmDates.isVisible(), true);
    await confirmDates.click();
    await calendar.waitFor({ state: "hidden" });
    console.log(`PASS ${width}px: cross-month range selection and confirmation`);
    await page.close();
  }
} finally {
  await browser.close();
}