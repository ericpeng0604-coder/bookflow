#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.RELEASE_BASE_URL || "https://bookflow-green.vercel.app").replace(/\/+$/, "");
const outputDir = path.resolve("artifacts/transaction-flow");
await mkdir(outputDir, { recursive: true });

const devices = [
  { name: "desktop", viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const report = {
  baseUrl,
  startedAt: new Date().toISOString(),
  authenticatedFlow: "NOT VERIFIED — no QA credentials were provided to this workflow",
  devices: [],
};

const browser = await chromium.launch({ headless: true });

async function screenshot(page, device, name) {
  const file = `${device}-${name}.png`;
  await page.screenshot({ path: path.join(outputDir, file), fullPage: true });
  return file;
}

async function waitForSettledPage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function closeVisibleDialog(page) {
  const close = page.getByRole("button", { name: /關閉|取消|返回|稍後再說/ }).last();
  if (await close.isVisible().catch(() => false)) {
    await close.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function captureLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const overflowElements = Array.from(document.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > viewportWidth + 1 || rect.left < -1;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className : "",
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }));
    return {
      viewportWidth,
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      bodyTextLength: body.innerText.trim().length,
      overflowElements,
    };
  });
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
  const result = {
    device: device.name,
    viewport: device.viewport,
    screenshots: [],
    checks: [],
    issues: [],
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };
  report.devices.push(result);

  page.on("console", (message) => {
    if (message.type() === "error") result.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED/i.test(failure)) result.failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
  });

  try {
    const response = await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    result.checks.push({ name: "homepage response", status: response?.ok() ? "PASS" : "FAIL", detail: response?.status() ?? null });
    await waitForSettledPage(page);

    result.screenshots.push(await screenshot(page, device.name, "01-home"));
    let layout = await captureLayout(page);
    result.checks.push({ name: "home horizontal overflow", status: layout.scrollWidth <= layout.viewportWidth + 1 ? "PASS" : "FAIL", detail: layout });
    if (layout.scrollWidth > layout.viewportWidth + 1) result.issues.push(`首頁橫向溢位：${layout.scrollWidth}px > ${layout.viewportWidth}px`);

    const cards = page.locator("ul.book-grid > li");
    await cards.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    const cardCount = await cards.count();
    result.checks.push({ name: "public listings visible", status: cardCount > 0 ? "PASS" : "FAIL", detail: { cardCount } });
    if (cardCount === 0) result.issues.push("公開市場沒有載入任何商品卡片；production DB 有 active listings 時應檢查前端查詢或 RLS。 ");

    const listingButton = page.getByRole("button", { name: /我要刊登|刊登一本書|刊登二手/ }).first();
    if (await listingButton.isVisible().catch(() => false)) {
      await listingButton.click();
      await page.waitForTimeout(500);
      result.screenshots.push(await screenshot(page, device.name, "02-sell-entry"));
      const bodyText = await page.locator("body").innerText();
      const hasRecoverableGate = /登入|Google|註冊|刊登/.test(bodyText);
      result.checks.push({ name: "sell entry unauthenticated gate", status: hasRecoverableGate ? "PASS" : "FAIL" });
      if (!hasRecoverableGate) result.issues.push("點擊刊登後沒有可理解的登入／刊登導引。");
      layout = await captureLayout(page);
      if (layout.scrollWidth > layout.viewportWidth + 1) result.issues.push(`刊登入口橫向溢位：${layout.scrollWidth}px > ${layout.viewportWidth}px`);
      await closeVisibleDialog(page);
    } else {
      result.checks.push({ name: "sell entry button", status: "FAIL" });
      result.issues.push("找不到『我要刊登／刊登一本書』按鈕。");
    }

    if (cardCount > 0) {
      const firstCard = cards.first();
      const openTarget = firstCard.locator("button").first();
      if (await openTarget.isVisible().catch(() => false)) {
        await openTarget.click();
        await waitForSettledPage(page);
        result.screenshots.push(await screenshot(page, device.name, "03-product-detail"));
        layout = await captureLayout(page);
        result.checks.push({ name: "product detail horizontal overflow", status: layout.scrollWidth <= layout.viewportWidth + 1 ? "PASS" : "FAIL", detail: layout });
        if (layout.scrollWidth > layout.viewportWidth + 1) result.issues.push(`商品詳情橫向溢位：${layout.scrollWidth}px > ${layout.viewportWidth}px`);

        const purchaseButtons = page.getByRole("button", { name: /立即購買|提出購買|送出購買|申請領取|加入購物車|購買意願/ });
        const purchaseCount = await purchaseButtons.count();
        result.checks.push({ name: "purchase action exists", status: purchaseCount > 0 ? "PASS" : "FAIL", detail: { purchaseCount } });
        if (purchaseCount === 0) {
          result.issues.push("商品詳情找不到購買／申請領取／加入購物車操作。");
        } else {
          const action = purchaseButtons.first();
          await action.click();
          await page.waitForTimeout(600);
          result.screenshots.push(await screenshot(page, device.name, "04-purchase-entry"));
          const purchaseText = await page.locator("body").innerText();
          const purchaseGate = /登入|Google|確認|購物車|購買意願|申請領取/.test(purchaseText);
          result.checks.push({ name: "purchase entry feedback", status: purchaseGate ? "PASS" : "FAIL" });
          if (!purchaseGate) result.issues.push("點擊購買操作後沒有登入、確認或購物車回饋。");
          layout = await captureLayout(page);
          if (layout.scrollWidth > layout.viewportWidth + 1) result.issues.push(`購買入口橫向溢位：${layout.scrollWidth}px > ${layout.viewportWidth}px`);
          await closeVisibleDialog(page);
        }

        const sellerButton = page.locator("button.seller-row").first();
        if (await sellerButton.isVisible().catch(() => false)) {
          await sellerButton.click();
          await waitForSettledPage(page);
          result.screenshots.push(await screenshot(page, device.name, "05-seller-storefront"));
          const bundleToggle = page.getByText(/加入合併清單/).first();
          if (await bundleToggle.isVisible().catch(() => false)) {
            await bundleToggle.click();
            await page.waitForTimeout(300);
            const submitBundle = page.getByRole("button", { name: /送出合併購買意願/ }).first();
            if (await submitBundle.isVisible().catch(() => false)) {
              await submitBundle.click();
              await page.waitForTimeout(500);
              result.screenshots.push(await screenshot(page, device.name, "06-bundle-purchase-entry"));
              const bundleText = await page.locator("body").innerText();
              const bundleGate = /登入|Google|合併購買意願/.test(bundleText);
              result.checks.push({ name: "bundle purchase unauthenticated gate", status: bundleGate ? "PASS" : "FAIL" });
              if (!bundleGate) result.issues.push("合併購買送出後沒有登入或狀態回饋。");
            }
          } else {
            result.checks.push({ name: "seller storefront bundle selector", status: "NOT_APPLICABLE", detail: "seller has fewer than two eligible listings or storefront did not load" });
          }
          layout = await captureLayout(page);
          if (layout.scrollWidth > layout.viewportWidth + 1) result.issues.push(`賣家賣場橫向溢位：${layout.scrollWidth}px > ${layout.viewportWidth}px`);
        }
      }
    }
  } catch (error) {
    result.issues.push(`測試中斷：${error instanceof Error ? error.message : String(error)}`);
    await screenshot(page, device.name, "99-fatal").then((file) => result.screenshots.push(file)).catch(() => {});
  } finally {
    if (result.consoleErrors.length > 0) result.issues.push(`console error ${result.consoleErrors.length} 筆`);
    if (result.pageErrors.length > 0) result.issues.push(`page error ${result.pageErrors.length} 筆`);
    await context.close();
  }
}

report.finishedAt = new Date().toISOString();
report.issueCount = report.devices.reduce((sum, item) => sum + item.issues.length, 0);
await writeFile(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");

const markdown = [
  "# Transaction Flow QA",
  "",
  `- Base URL: ${baseUrl}`,
  `- Authenticated flow: ${report.authenticatedFlow}`,
  `- Issue count: ${report.issueCount}`,
  "",
  ...report.devices.flatMap((item) => [
    `## ${item.device}`,
    "",
    ...item.checks.map((check) => `- ${check.status}: ${check.name}${check.detail ? ` — \`${JSON.stringify(check.detail).slice(0, 500)}\`` : ""}`),
    ...(item.issues.length ? ["", "### Issues", ...item.issues.map((issue) => `- ${issue}`)] : ["", "- No issue detected in the unauthenticated smoke scope."]),
    "",
  ]),
].join("\n");
await writeFile(path.join(outputDir, "summary.md"), markdown, "utf8");
console.log(markdown);

await browser.close();
