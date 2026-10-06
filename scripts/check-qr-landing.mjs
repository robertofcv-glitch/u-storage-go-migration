import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseURL = process.env.TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({
  executablePath: existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/QR", "/QR/", "/qr", "/qr/"]) {
      const response = await page.goto(`${baseURL}${path}`);
      assert.equal(response.status(), 200);
      await page.getByTestId("qr-landing").waitFor();
      await page.reload();
      await page.getByTestId("qr-landing").waitFor();
      assert.equal(await page.locator("h1").innerText(), "Tus pertenencias, conectadas.");
    }
    await page.getByRole("button", { name: "Cambiar idioma a inglés" }).click();
    await page.getByRole("heading", { name: "Your belongings, connected." }).waitFor();
    assert.equal(await page.getByTestId("qr-landing").getAttribute("lang"), "en");
    for (const id of ["qr-quote", "qr-whatsapp", "qr-phone"]) {
      const action = page.getByTestId(id);
      assert.ok((await action.innerText()).trim());
      const box = await action.boundingBox();
      assert.ok(box.height >= 48 && box.width >= 48, `${id} touch target at ${width}`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    assert.equal(await page.getByTestId("qr-phone").getAttribute("href"), "tel:8001121068");
    assert.match(await page.getByTestId("qr-phone").innerText(), /800 112 1068/);
    const englishWhatsApp = new URL(await page.getByTestId("qr-whatsapp").getAttribute("href"));
    assert.equal(englishWhatsApp.origin, "https://wa.me");
    assert.equal(englishWhatsApp.pathname, "/12025550100");
    assert.match(englishWhatsApp.searchParams.get("text"), /^Hello,/);
    await page.getByText("Example WhatsApp; activation pending.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
    await page.getByText("WhatsApp de ejemplo; pendiente de activar.", { exact: true }).waitFor();
    const spanishWhatsApp = new URL(await page.getByTestId("qr-whatsapp").getAttribute("href"));
    assert.match(spanishWhatsApp.searchParams.get("text"), /^Hola,/);
    assert.equal(await page.getByTestId("qr-whatsapp").getAttribute("target"), "_blank");
    assert.equal((await page.getByTestId("qr-whatsapp").innerText()).trim(), "Escríbenos");
    assert.equal((await page.getByTestId("qr-quote").innerText()).trim(), "Cotiza tu mudanza");
    await page.getByTestId("qr-quote").focus();
    assert.equal(await page.getByTestId("qr-quote").evaluate((el) => el === document.activeElement), true);
    // Do not send test visitors to the fictional WhatsApp number.
    await page.keyboard.press("Enter");
    await page.waitForURL(`${baseURL}/quote`);
    await page.getByTestId("qr-landing").waitFor({ state: "detached" });
    assert.deepEqual(errors, [], `browser errors at ${width}`);
    console.log(`PASS QR aliases, refresh, languages, touch targets, keyboard, phone, sample WhatsApp and quote links: ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
