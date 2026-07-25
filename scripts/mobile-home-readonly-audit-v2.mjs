import { chromium } from 'playwright';

const TARGET = 'https://bookflow-green.vercel.app/';
const out = {
  checks: [],
  closeButtons: [],
  consoleSources: [],
  failedNetwork: [],
  badResponses: [],
  fatal: null,
};
const compact = (value, max = 220) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const add = (name, status, detail = '') => out.checks.push({ name, status, detail: compact(detail) });
const unique = (items) => [...new Map(items.map((item) => [JSON.stringify(item), item])).values()];

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    let host = '';
    try { host = new URL(location.url).hostname; } catch {}
    out.consoleSources.push({ host, text: compact(message.text()), line: location.lineNumber, column: location.columnNumber });
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText || '';
    if (/ERR_ABORTED/.test(error)) return;
    let host = '';
    try { host = new URL(request.url()).hostname; } catch {}
    out.failedNetwork.push({ host, error, resourceType: request.resourceType() });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    let host = '';
    try { host = new URL(response.url()).hostname; } catch {}
    out.badResponses.push({ host, status: response.status(), resourceType: response.request().resourceType() });
  });

  const fresh = async () => {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(900);
  };
  const openMenu = async () => {
    const menu = page.getByRole('button', { name: /開啟選單|關閉選單/ }).first();
    await menu.click();
    await page.waitForTimeout(250);
  };

  // Verify the exact secondhand -> books control.
  try {
    await fresh();
    await openMenu();
    const toSecondhand = page.getByRole('button', { name: '逛二手物品', exact: true }).filter({ visible: true }).first();
    if (!(await toSecondhand.count())) throw new Error('找不到「逛二手物品」');
    await toSecondhand.click();
    await page.waitForTimeout(650);
    const secondhandUrl = page.url();
    await openMenu();
    const backToBooks = page.getByRole('button', { name: '回二手書籍市場', exact: true }).filter({ visible: true }).first();
    if (!(await backToBooks.count())) throw new Error('找不到「回二手書籍市場」');
    await backToBooks.click();
    await page.waitForTimeout(650);
    const bookUrl = page.url();
    const body = await page.locator('body').innerText();
    const returned = /[?&]market=book/.test(bookUrl) ||
      (!/[?&]market=secondhand/.test(bookUrl) && /二手書|課本/.test(body));
    add('二手物品返回二手書籍', returned ? 'PASS' : 'FAIL', `secondhand=${secondhandUrl}, books=${bookUrl}`);
  } catch (error) {
    add('二手物品返回二手書籍', 'FAIL', error?.message || error);
  }

  // Verify the actual close control rather than the backdrop dismiss button.
  try {
    await fresh();
    await page.getByRole('button', { name: '問題回報', exact: true }).click();
    await page.waitForTimeout(350);
    const closeButtons = page.locator('button[aria-label="關閉視窗"]:visible');
    out.closeButtons = await closeButtons.evaluateAll((buttons) =>
      buttons.map((button, index) => ({
        index,
        className: button.className,
        type: button.getAttribute('type'),
        outerHTML: button.outerHTML.slice(0, 260),
      })),
    );
    const count = await closeButtons.count();
    if (!count) throw new Error('找不到關閉視窗按鈕');
    await closeButtons.last().click();
    await page.waitForTimeout(300);
    const visibleDialogs = await page.getByRole('dialog').filter({ visible: true }).count();
    add('問題回報真正關閉按鈕', visibleDialogs === 0 ? 'PASS' : 'FAIL', `closeButtons=${count}, visibleDialogs=${visibleDialogs}`);
  } catch (error) {
    add('問題回報真正關閉按鈕', 'FAIL', error?.message || error);
  }

  // Open login once to capture Turnstile behavior in a headless runner.
  try {
    await fresh();
    await openMenu();
    const login = page.getByRole('button', { name: /登入\s*[／/]\s*註冊/ }).filter({ visible: true }).first();
    await login.click();
    await page.waitForTimeout(2200);
    add('登入 Dialog 開啟', (await page.getByRole('dialog').count()) > 0 ? 'PASS' : 'FAIL');
  } catch (error) {
    add('登入 Dialog 開啟', 'FAIL', error?.message || error);
  }
} catch (error) {
  out.fatal = compact(error?.stack || error, 500);
} finally {
  if (browser) await browser.close();
}

out.consoleSources = unique(out.consoleSources);
out.failedNetwork = unique(out.failedNetwork);
out.badResponses = unique(out.badResponses);
console.log('FINAL_CHECKS=' + JSON.stringify(out.checks));
console.log('FINAL_CLOSE_BUTTONS=' + JSON.stringify(out.closeButtons));
console.log('FINAL_CONSOLE_SOURCES=' + JSON.stringify(out.consoleSources));
console.log('FINAL_FAILED_NETWORK=' + JSON.stringify(out.failedNetwork));
console.log('FINAL_BAD_RESPONSES=' + JSON.stringify(out.badResponses));
console.log('FINAL_FATAL=' + JSON.stringify(out.fatal));