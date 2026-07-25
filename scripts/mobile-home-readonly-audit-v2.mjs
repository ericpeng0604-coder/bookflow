import { chromium } from 'playwright';

const TARGET = 'https://bookflow-green.vercel.app/';
const report = {
  target: TARGET,
  viewport: { width: 390, height: 844 },
  checks: [],
  observations: {},
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  fatal: null,
};

const compact = (value, max = 260) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const add = (name, status, detail = '') => {
  report.checks.push({ name, status, detail: compact(detail) });
};

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: report.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(compact(message.text()));
  });
  page.on('pageerror', (error) => report.pageErrors.push(compact(error)));
  page.on('requestfailed', (request) => {
    report.failedRequests.push({
      method: request.method(),
      url: compact(request.url(), 220),
      error: compact(request.failure()?.errorText || ''),
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      report.badResponses.push({
        status: response.status(),
        method: response.request().method(),
        url: compact(response.url(), 220),
      });
    }
  });

  const fresh = async () => {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(900);
  };

  const check = async (name, action) => {
    try {
      const detail = await action();
      add(name, 'PASS', detail || '');
    } catch (error) {
      add(name, 'FAIL', error?.message || error);
    }
  };

  const visibleButtonSnapshot = async () =>
    page.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => ({
        text: (button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
        ariaLabel: button.getAttribute('aria-label'),
        title: button.getAttribute('title'),
        expanded: button.getAttribute('aria-expanded'),
      })),
    );

  const openMenu = async () => {
    const menu = page.getByRole('button', { name: /開啟選單|關閉選單/ }).first();
    await menu.click();
    await page.waitForTimeout(250);
    if ((await menu.getAttribute('aria-expanded')) !== 'true') {
      throw new Error(`aria-expanded=${await menu.getAttribute('aria-expanded')}`);
    }
    return menu;
  };

  await fresh();
  add('首頁載入', page.url().startsWith(TARGET) ? 'PASS' : 'FAIL', page.url());

  await check('無水平溢位', async () => {
    const sizes = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    if (sizes.scrollWidth > sizes.innerWidth + 2) throw new Error(JSON.stringify(sizes));
    return JSON.stringify(sizes);
  });

  await check('三條線選單開啟與按鈕關閉', async () => {
    const menu = await openMenu();
    report.observations.menuButtons = await visibleButtonSnapshot();
    await menu.click();
    await page.waitForTimeout(200);
    if ((await menu.getAttribute('aria-expanded')) === 'true') throw new Error('再次點擊後仍為展開');
    return `可見按鈕 ${report.observations.menuButtons.length} 個`;
  });

  await check('三條線選單 Escape 關閉', async () => {
    await fresh();
    const menu = await openMenu();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const expanded = await menu.getAttribute('aria-expanded');
    if (expanded === 'true') throw new Error('Escape 後選單仍展開');
    return `aria-expanded=${expanded}`;
  });

  await check('三條線內登入／註冊入口', async () => {
    await fresh();
    await openMenu();
    const login = page.getByRole('button', { name: /登入\s*[／/]\s*註冊/ }).filter({ visible: true }).first();
    if (!(await login.count())) throw new Error('三條線選單內找不到登入 / 註冊');
    await login.click();
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    const dialogCount = await page.getByRole('dialog').count();
    if (!/登入|註冊|Google|信箱|Email/i.test(body)) throw new Error('點擊後未出現登入相關內容');
    return `dialog=${dialogCount}, url=${page.url()}`;
  });

  await check('切換至二手物品', async () => {
    await fresh();
    await openMenu();
    const switchButton = page.getByRole('button', { name: /逛二手物品/ }).filter({ visible: true }).first();
    if (!(await switchButton.count())) throw new Error('選單內找不到「逛二手物品」');
    await switchButton.click();
    await page.waitForTimeout(700);
    const afterUrl = page.url();
    const body = await page.locator('body').innerText();
    await openMenu();
    const returnButton = page.getByRole('button', { name: /逛二手書籍/ }).filter({ visible: true }).first();
    const switched = /market=item|二手物品/.test(afterUrl + body) || (await returnButton.count()) > 0;
    if (!switched) throw new Error(`切換狀態無法確認，url=${afterUrl}`);
    report.observations.itemMarketUrl = afterUrl;
    return `url=${afterUrl}, 可返回二手書=${(await returnButton.count()) > 0}`;
  });

  await check('從二手物品返回二手書籍', async () => {
    await fresh();
    await openMenu();
    const toItems = page.getByRole('button', { name: /逛二手物品/ }).filter({ visible: true }).first();
    if (!(await toItems.count())) throw new Error('找不到二手物品切換入口');
    await toItems.click();
    await page.waitForTimeout(600);
    await openMenu();
    const toBooks = page.getByRole('button', { name: /逛二手書籍/ }).filter({ visible: true }).first();
    if (!(await toBooks.count())) throw new Error('切到二手物品後找不到「逛二手書籍」');
    await toBooks.click();
    await page.waitForTimeout(600);
    const url = page.url();
    const body = await page.locator('body').innerText();
    if (!/market=book|二手書|課本/.test(url + body)) throw new Error(`返回二手書狀態無法確認，url=${url}`);
    return `url=${url}`;
  });

  await check('切換零元贈送', async () => {
    await fresh();
    await openMenu();
    const giveaway = page.getByRole('button', { name: '零元贈送', exact: true }).filter({ visible: true }).first();
    if (!(await giveaway.count())) throw new Error('找不到零元贈送按鈕');
    await giveaway.click();
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    if (!body.includes('零元贈送')) throw new Error('切換後頁面未顯示零元贈送');
    return `url=${page.url()}`;
  });

  await check('購物車空狀態／面板', async () => {
    await fresh();
    let cart = page.getByRole('button', { name: /購物車/ }).filter({ visible: true }).first();
    if (!(await cart.count())) {
      cart = page.locator('button:visible').filter({ hasText: '🛒' }).first();
    }
    if (!(await cart.count())) throw new Error('找不到購物車按鈕');
    await cart.click();
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    const matched = body.match(/購物車|尚未加入|目前沒有|空空|結帳|商品清單/g) || [];
    if (!matched.length) throw new Error('點擊後未找到購物車或空狀態文案');
    return `命中文案=${[...new Set(matched)].join(',')}, url=${page.url()}`;
  });

  for (const [label, path] of [
    ['隱私權', '/privacy'],
    ['使用條款', '/terms'],
    ['交易安全', '/safety'],
  ]) {
    await check(`Footer 導覽：${label}`, async () => {
      await fresh();
      const link = page.locator(`a[href="${path}"]`).filter({ visible: true }).last();
      if (!(await link.count())) throw new Error(`找不到 href=${path}`);
      await link.scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForURL((url) => url.pathname.startsWith(path), { timeout: 7000 }),
        link.click(),
      ]);
      const heading = compact(await page.locator('h1').first().innerText());
      return `url=${page.url()}, h1=${heading}`;
    });
  }

  await check('政策頁返回首頁', async () => {
    await page.goto(`${TARGET}privacy`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const back = page.locator('a[href="/"]').filter({ visible: true }).first();
    if (!(await back.count())) throw new Error('隱私權頁找不到返回首頁連結');
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/', { timeout: 7000 }),
      back.click(),
    ]);
    return page.url();
  });

  await check('Hero 搜尋同步至列表', async () => {
    await fresh();
    const hero = page.getByPlaceholder(/搜尋二手書名、課程或老師/).first();
    await hero.fill('微積分');
    await page.getByRole('button', { name: /開始找二手書|依目前輸入開始找二手書籍/ }).first().click();
    await page.waitForTimeout(500);
    const values = await page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value));
    if (!values.some((value) => value === '微積分')) throw new Error(`輸入值未同步：${JSON.stringify(values)}`);
    return `inputValues=${JSON.stringify(values.filter(Boolean))}`;
  });

  await check('列表搜尋輸入與清除', async () => {
    await fresh();
    const listSearch = page.getByPlaceholder('搜尋課本...').first();
    await listSearch.fill('英文');
    if ((await listSearch.inputValue()) !== '英文') throw new Error('列表搜尋輸入失敗');
    await listSearch.fill('');
    if ((await listSearch.inputValue()) !== '') throw new Error('列表搜尋清除失敗');
    return '輸入與清除正常';
  });

  await check('科系與價格篩選', async () => {
    await fresh();
    const department = page.getByLabel('科系').first();
    const price = page.getByLabel('最高價格').first();
    await department.selectOption({ label: '資訊工程系' });
    await price.selectOption('300');
    const result = { department: await department.inputValue(), price: await price.inputValue() };
    if (result.department !== '資訊工程系' || result.price !== '300') {
      throw new Error(JSON.stringify(result));
    }
    return JSON.stringify(result);
  });

  await check('圖片搜尋開啟檔案選擇器', async () => {
    await fresh();
    const trigger = page.getByRole('button', { name: /用照片找二手書|照片搜二手書/ }).first();
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 7000 });
    await trigger.click();
    await chooserPromise;
    return 'filechooser 已開啟，未選擇或上傳檔案';
  });

  await check('問題回報開啟與關閉', async () => {
    await fresh();
    await page.getByRole('button', { name: '問題回報', exact: true }).click();
    await page.waitForTimeout(350);
    const body = await page.locator('body').innerText();
    if (!/問題回報|意見|回報/.test(body)) throw new Error('問題回報介面未開啟');
    const close = page.getByRole('button', { name: /關閉|取消/ }).filter({ visible: true }).first();
    if (await close.count()) {
      await close.click();
      await page.waitForTimeout(200);
      return '已開啟並以按鈕關閉';
    }
    await page.keyboard.press('Escape');
    return '已開啟，使用 Escape 關閉';
  });

  await check('第一個商品卡片可開啟', async () => {
    await fresh();
    const candidates = page.locator('button:visible').filter({ hasText: /販售中|已驗證賣家/ });
    if (!(await candidates.count())) throw new Error('首頁沒有可測試的商品卡片');
    const before = page.url();
    await candidates.first().click();
    await page.waitForTimeout(600);
    const body = await page.locator('body').innerText();
    const changed = page.url() !== before || /商品詳情|書況|賣家|購買|提出購買/.test(body);
    if (!changed) throw new Error('點擊商品卡片後沒有可辨識的詳情狀態');
    return `before=${before}, after=${page.url()}`;
  });
} catch (error) {
  report.fatal = compact(error?.stack || error, 500);
} finally {
  if (browser) await browser.close();
}

const nonAbortedRequests = report.failedRequests.filter(
  (request) => !/ERR_ABORTED/.test(request.error),
);
report.summary = {
  pass: report.checks.filter((check) => check.status === 'PASS').length,
  fail: report.checks.filter((check) => check.status === 'FAIL').length,
  consoleErrors: report.consoleErrors.length,
  pageErrors: report.pageErrors.length,
  failedRequests: report.failedRequests.length,
  nonAbortedFailedRequests: nonAbortedRequests.length,
  badResponses: report.badResponses.length,
};

console.log(
  'AUDIT_RESULT=' +
    JSON.stringify({
      summary: report.summary,
      checks: report.checks,
      observations: report.observations,
      consoleErrors: report.consoleErrors.slice(0, 10),
      pageErrors: report.pageErrors.slice(0, 10),
      nonAbortedFailedRequests: nonAbortedRequests.slice(0, 10),
      badResponses: report.badResponses.slice(0, 10),
      fatal: report.fatal,
    }),
);