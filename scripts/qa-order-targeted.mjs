#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.RELEASE_BASE_URL || "https://bookflow-green.vercel.app").replace(/\/+$/, "");
const outputDir = path.resolve("artifacts/targeted-order");
await mkdir(outputDir, { recursive: true });

const devices = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const report = { baseUrl, startedAt: new Date().toISOString(), devices: [] };
const browser = await chromium.launch({ headless: true });

async function settle(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function shot(page, device, name, fullPage = false) {
  const file = `${device}-${name}.png`;
  await page.screenshot({ path: path.join(outputDir, file), fullPage });
  return file;
}

async function layout(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const all = Array.from(document.querySelectorAll("body *"));
    const overflowElements = all
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && (rect.right > viewportWidth + 1 || rect.left < -1))
      .slice(0, 20)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || "",
        className: typeof element.className === "string" ? element.className : "",
        ariaLabel: element.getAttribute("aria-label") || "",
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        position: getComputedStyle(element).position,
      }));
    return {
      viewportWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      overflowElements,
    };
  });
}

async function openFirstProduct(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settle(page);
  const cards = page.locator("ul.book-grid > li");
  await cards.first().waitFor({ state: "visible", timeout: 20_000 });
  const target = cards.first().locator("button").first();
  await target.click();
  await settle(page);
}

async function visibleText(page) {
  return (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 4000);
}

for (const device of devices) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: 1,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    locale: "zh-TW",
  });
  const page = await context.newPage();
  const item = {
    device: device.name,
    screenshots: [],
    checks: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
  report.devices.push(item);

  page.on("console", (message) => {
    if (message.type() === "error") {
      item.consoleErrors.push({ text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => item.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED/i.test(errorText)) item.failedRequests.push({ url: request.url(), errorText });
  });

  try {
    await openFirstProduct(page);
    item.screenshots.push(await shot(page, device.name, "01-detail-viewport"));

    const directOrder = page.getByRole("button", { name: "確認下訂", exact: true });
    item.checks.push({ name: "direct order button visible", pass: await directOrder.isVisible().catch(() => false) });
    if (await directOrder.isVisible().catch(() => false)) {
      await directOrder.click();
      await page.waitForTimeout(700);
      item.screenshots.push(await shot(page, device.name, "02-direct-order-result"));
      item.checks.push({
        name: "direct order result",
        text: await visibleText(page),
        dialogs: await page.getByRole("dialog").count(),
        layout: await layout(page),
      });
    }

    await openFirstProduct(page);
    const addCart = page.getByRole("button", { name: "加入購物車", exact: true });
    item.checks.push({ name: "add cart button visible", pass: await addCart.isVisible().catch(() => false) });
    if (await addCart.isVisible().catch(() => false)) {
      await addCart.click();
      await page.waitForTimeout(600);
      item.screenshots.push(await shot(page, device.name, "03-after-add-cart"));
      item.checks.push({ name: "after add cart layout", layout: await layout(page), text: await visibleText(page) });

      const cart = page.getByRole("button", { name: /購物車，\s*1\s*項商品/ }).first();
      item.checks.push({ name: "cart button with one item visible", pass: await cart.isVisible().catch(() => false) });
      if (await cart.isVisible().catch(() => false)) {
        await cart.click();
        await page.waitForTimeout(600);
        item.screenshots.push(await shot(page, device.name, "04-cart-dialog"));
        item.checks.push({
          name: "cart dialog",
          dialogs: await page.getByRole("dialog").count(),
          text: await visibleText(page),
          layout: await layout(page),
        });

        const cartSubmit = page.getByRole("button", { name: /確認下訂|送出購買意願|送出訂單|提出購買/ }).last();
        if (await cartSubmit.isVisible().catch(() => false)) {
          await cartSubmit.click();
          await page.waitForTimeout(700);
          item.screenshots.push(await shot(page, device.name, "05-cart-submit-result"));
          item.checks.push({
            name: "cart submit result",
            dialogs: await page.getByRole("dialog").count(),
            text: await visibleText(page),
            layout: await layout(page),
          });
        }
      }
    }

    await openFirstProduct(page);
    const seller = page.locator(".seller-row").first();
    item.checks.push({
      name: "seller row",
      count: await seller.count(),
      tag: await seller.evaluate((element) => element.tagName.toLowerCase()).catch(() => null),
    });
    if (await seller.isVisible().catch(() => false)) {
      await seller.click();
      await settle(page);
      item.screenshots.push(await shot(page, device.name, "06-seller-storefront", true));
      item.checks.push({ name: "seller storefront", text: await visibleText(page), layout: await layout(page) });

      const selectors = page.getByText("加入合併清單", { exact: true });
      const selectorCount = await selectors.count();
      item.checks.push({ name: "bundle selectors", count: selectorCount });
      if (selectorCount > 0) {
        await selectors.nth(0).click();
        if (selectorCount > 1) await selectors.nth(1).click();
        await page.waitForTimeout(300);
        const bundleSubmit = page.getByRole("button", { name: /送出合併購買意願/ });
        if (await bundleSubmit.isVisible().catch(() => false)) {
          item.screenshots.push(await shot(page, device.name, "07-bundle-ready"));
          await bundleSubmit.click();
          await page.waitForTimeout(700);
          item.screenshots.push(await shot(page, device.name, "08-bundle-submit-result"));
          item.checks.push({ name: "bundle submit result", dialogs: await page.getByRole("dialog").count(), text: await visibleText(page), layout: await layout(page) });
        }
      }
    }
  } catch (error) {
    item.error = error instanceof Error ? error.stack || error.message : String(error);
    await shot(page, device.name, "99-error", true).then((file) => item.screenshots.push(file)).catch(() => {});
  } finally {
    await context.close();
  }
}

report.finishedAt = new Date().toISOString();
await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(path.join(outputDir, "summary.md"), [
  "# Targeted Order QA",
  "",
  `- Base URL: ${baseUrl}`,
  `- Authenticated state transitions: NOT VERIFIED`,
  "",
  ...report.devices.flatMap((device) => [
    `## ${device.device}`,
    `- Screenshots: ${device.screenshots.join(", ")}`,
    `- Console errors: ${device.consoleErrors.length}`,
    `- Page errors: ${device.pageErrors.length}`,
    `- Failed requests: ${device.failedRequests.length}`,
    device.error ? `- Error: ${device.error}` : "- Script completed",
    "",
  ]),
].join("\n"), "utf8");

console.log(JSON.stringify(report, null, 2));
await browser.close();
