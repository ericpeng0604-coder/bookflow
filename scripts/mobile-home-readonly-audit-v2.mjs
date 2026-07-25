import { chromium } from 'playwright';

const TARGET = 'https://bookflow-green.vercel.app/';
const result = {
  checks: [],
  secondhand: {},
  reportDialog: {},
  consoleErrors: [],
  failedRequests: [],
  badResponses: [],
  fatal: null,
};

const compact = (value, max = 240) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const add = (name, status, detail = '') =>
  result.checks.push({ name, status, detail: compact(detail) });

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  page.on('console', async (message) => {
    if (message.type() !== 'error') return;
    let args = [];
    try {
      args = await Promise.all(
        message.args().map(async (arg) => {
          try {
            return compact(await arg.jsonValue(), 160);
          } catch {
            return compact(arg.toString(), 160);
          }
        }),
      );
    } catch {}
    result.consoleErrors.push({
      text: compact(message.text(), 300),
      location: message.location(),
      args,
    });
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText || '';
    if (/ERR_ABORTED/.test(error)) return;
    result.failedRequests.push({
      method: request.method(),
      error,
      url: compact(request.url(), 300),
      resourceType: request.resourceType(),
    });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    result.badResponses.push({
      status: response.status(),
      method: response.request().method(),
      url: compact(response.url(), 300),
      resourceType: response.request().resourceType(),
    });
  });

  const fresh = async () => {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(900);
  };
  const openMenu = async () => {
    const menu = page.getByRole('button', { name: /開啟選單|關閉選單/ }).first();
    await menu.click();
    await page.waitForTimeout(250);
    if ((await menu.getAttribute('aria-expanded')) !== 'true') {
      throw new Error('選單未展開');
    }
  };
  const snapshotButtons = async () =>
    page.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: (button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
      })),
    );
  const snapshotLinks = async () =>
    page.locator('a:visible').evaluateAll((links) =>
      links.map((link) => ({
        text: (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        ariaLabel: link.getAttribute('aria-label'),
        href: link.getAttribute('href'),
      })),
    );

  // Correct login path: hamburger menu -> Login/Register.
  try {
    await fresh();
    await openMenu();
    const login = page.getByRole('button', { name: /登入\s*[／/]\s*註冊/ }).filter({ visible: true }).first();
    if (!(await login.count())) throw new Error('找不到登入 / 註冊');
    await login.click();
    await page.waitForTimeout(1500);
    const dialog = page.getByRole('dialog').first();
    add('三條線內登入入口', (await dialog.count()) ? 'PASS' : 'FAIL', `dialog=${await dialog.count()}`);
  } catch (error) {
    add('三條線內登入入口', 'FAIL', error?.message || error);
  }

  // Inspect secondhand state and test practical return paths.
  try {
    await fresh();
    await openMenu();
    const toSecondhand = page.getByRole('button', { name: /逛二手物品/ }).filter({ visible: true }).first();
    if (!(await toSecondhand.count())) throw new Error('找不到逛二手物品');
    await toSecondhand.click();
    await page.waitForTimeout(700);
    result.secondhand.urlAfterSwitch = page.url();
    result.secondhand.headings = await page.locator('h1:visible,h2:visible,h3:visible').allTextContents();
    await openMenu();
    result.secondhand.menuButtons = await snapshotButtons();
    result.secondhand.menuLinks = await snapshotLinks();
    result.secondhand.hasBrowseBooksButton =
      (await page.getByRole('button', { name: /逛二手書籍|二手書籍/ }).filter({ visible: true }).count()) > 0;
    result.secondhand.hasBrowseBooksLink =
      (await page.getByRole('link', { name: /逛二手書籍|二手書籍/ }).filter({ visible: true }).count()) > 0;

    const logo = page.getByRole('button', { name: '虎科書流首頁', exact: true }).filter({ visible: true }).first();
    if (await logo.count()) {
      await logo.click();
      await page.waitForTimeout(600);
      result.secondhand.urlAfterLogo = page.url();
    }

    const logoReturnedToBook = /market=book/.test(result.secondhand.urlAfterLogo || '') ||
      (!/[?&]market=secondhand/.test(result.secondhand.urlAfterLogo || '') &&
        /二手書|課本/.test(await page.locator('body').innerText()));
    add(
      '二手物品返回二手書',
      result.secondhand.hasBrowseBooksButton || result.secondhand.hasBrowseBooksLink || logoReturnedToBook
        ? 'PASS'
        : 'FAIL',
      `switch=${result.secondhand.urlAfterSwitch}, logo=${result.secondhand.urlAfterLogo || 'N/A'}`,
    );
  } catch (error) {
    add('二手物品返回二手書', 'FAIL', error?.message || error);
  }

  // Inspect report-dialog controls, then close through an actual dialog control or Escape.
  try {
    await fresh();
    await page.getByRole('button', { name: '問題回報', exact: true }).click();
    await page.waitForTimeout(350);
    const dialog = page.getByRole('dialog').first();
    result.reportDialog.dialogCount = await dialog.count();
    result.reportDialog.visibleButtons = await snapshotButtons();

    let closedBy = '';
    if (await dialog.count()) {
      const dialogClose = dialog.getByRole('button', { name: /關閉|取消/ }).first();
      if (await dialogClose.count()) {
        await dialogClose.click();
        closedBy = 'dialog button';
      }
    }
    if (!closedBy) {
      await page.keyboard.press('Escape');
      closedBy = 'Escape';
    }
    await page.waitForTimeout(250);
    const stillVisible = (await page.getByRole('dialog').filter({ visible: true }).count()) > 0;
    add('問題回報關閉', stillVisible ? 'FAIL' : 'PASS', `closedBy=${closedBy}, stillVisible=${stillVisible}`);
  } catch (error) {
    add('問題回報關閉', 'FAIL', error?.message || error);
  }

  // Wait briefly so delayed console/network events are captured.
  await page.waitForTimeout(1200);
} catch (error) {
  result.fatal = compact(error?.stack || error, 500);
} finally {
  if (browser) await browser.close();
}

const unique = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

result.consoleErrors = unique(result.consoleErrors);
result.failedRequests = unique(result.failedRequests);
result.badResponses = unique(result.badResponses);

console.log('DIAG_CHECKS=' + JSON.stringify(result.checks));
console.log('DIAG_SECONDHAND=' + JSON.stringify(result.secondhand));
console.log('DIAG_REPORT=' + JSON.stringify(result.reportDialog));
console.log('DIAG_CONSOLE=' + JSON.stringify(result.consoleErrors));
console.log('DIAG_FAILED_REQUESTS=' + JSON.stringify(result.failedRequests));
console.log('DIAG_BAD_RESPONSES=' + JSON.stringify(result.badResponses));
console.log('DIAG_FATAL=' + JSON.stringify(result.fatal));