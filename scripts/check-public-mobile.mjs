#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.RELEASE_BASE_URL || "https://bookflow-green.vercel.app").replace(/\/+$/, "");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();

try {
  const response = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
  assert.ok(response && response.ok(), `homepage returned ${response?.status()}`);

  const search = page.getByRole("textbox").first();
  await search.waitFor({ state: "visible", timeout: 10_000 });
  await search.fill("no-match-mobile-check-20260717");
  await page.waitForTimeout(500);

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyText: document.body.innerText,
  }));
  assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, `horizontal overflow: ${layout.scrollWidth}px > ${layout.viewportWidth}px`);
  assert.match(layout.bodyText, /找不到|沒有|無結果|沒有符合|搜尋/, "mobile empty/search state is not visible");

  const listingButton = page.getByRole("button", { name: /我要刊登|刊登一本書/ }).first();
  await listingButton.click();
  await page.waitForTimeout(250);
  const afterListingClick = await page.locator("body").innerText();
  assert.match(afterListingClick, /登入|刊登|登入後/, "listing action has no recoverable unauthenticated path");

  console.log(`Mobile public smoke passed (${baseUrl}, 390x844).`);
} finally {
  await context.close();
  await browser.close();
}
