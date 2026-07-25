import { chromium } from 'playwright';

const TARGET = 'https://bookflow-green.vercel.app/';
const report = {
  target: TARGET,
  viewport: { width: 1440, height: 900 },
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
const add = (name, status, detail = '') =>
  report.checks.push({ name, status, detail: compact(detail) });
const visible = (locator) => locator.filter({ visible: true });

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: report.viewport,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    report.consoleErrors.push({
      text: compact(message.text()),
      location: message.location(),
    });
  });
  page.on('pageerror', (error) => report.pageErrors.push(compact(error)));
  page.on('requestfailed', (request) => {
    report.failedRequests.push({
      method: request.method(),
      url: compact(request.url(), 320),
      error: request.failure()?.errorText ?? '',
      resourceType: request.resourceType(),
    });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    report.badResponses.push({
      method: response.request().method(),
      url: compact(response.url(), 320),
      status: response.status(),
      resourceType: response.request().resourceType(),
    });
  });

  const reset = async () => {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000);
  };
  const check = async (name, fn) => {
    try {
      const detail = await fn();
      add(name, 'PASS', detail ?? '');
    } catch (error) {
      add(name, 'FAIL', error?.message || error);
    }
  };
  const closeDialog = async () => {
    const close = visible(page.locator('button.modal-close')).first();
    if (await close.count()) {
      await close.click();
      await page.waitForTimeout(200);
    }
  };
  const clickDesktopControl = async (pattern) => {
    const control = visible(
      page.getByRole('button', { name: pattern }).or(page.getByRole('link', { name: pattern })),
    ).first();
    if (!(await control.count())) throw new Error(`找不到桌面控制項：${pattern}`);
    await control.click();
    return control;
  };

  await reset();
  add('首頁載入', page.url().startsWith(TARGET) ? 'PASS' : 'FAIL', page.url());

  await check('無水平溢位', async () => {
    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    if (size.scrollWidth > size.innerWidth + 2) throw new Error(JSON.stringify(size));
    return JSON.stringify(size);
  });

  await check('桌面 Header 導覽可見', async () => {
    const header = page.locator('header').first();
    if (!(await header.count()) || !(await header.isVisible())) throw new Error('找不到可見 header');
    const controls = await header
      .locator('a:visible, button:visible')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          ariaLabel: node.getAttribute('aria-label'),
          title: node.getAttribute('title'),
        })),
      );
    report.observations.headerControls = controls;
    if (controls.length < 5) throw new Error(`可見控制項過少：${controls.length}`);
    return `可見控制項 ${controls.length} 個`;
  });

  await check('桌面不顯示三條線選單', async () => {
    const count = await visible(page.getByRole('button', { name: /開啟選單|關閉選單/ })).count();
    if (count !== 0) throw new Error(`可見三條線按鈕數=${count}`);
    return 'hamburger hidden';
  });

  await check('Header 控制項未超出 viewport', async () => {
    const overflow = await page.locator('header a:visible, header button:visible').evaluateAll(
      (nodes) =>
        nodes
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              label: node.getAttribute('aria-label') || node.textContent?.trim() || node.getAttribute('title'),
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            };
          })
          .filter((rect) => rect.left < -1 || rect.right > innerWidth + 1 || rect.top < -1),
    );
    if (overflow.length) throw new Error(JSON.stringify(overflow));
    return 'all header controls inside viewport';
  });

  await check('桌面登入／註冊入口', async () => {
    await reset();
    await clickDesktopControl(/登入\s*[／/]\s*註冊/);
    await page.waitForTimeout(350);
    const dialogs = await visible(page.getByRole('dialog')).count();
    if (!dialogs) throw new Error('登入 Dialog 未出現');
    const text = await visible(page.getByRole('dialog')).first().innerText();
    if (!/Google|登入|註冊/.test(text)) throw new Error('Dialog 缺少登入文案');
    await closeDialog();
    return `dialog=${dialogs}`;
  });

  await check('訊息未登入攔截', async () => {
    await reset();
    await clickDesktopControl(/訊息/);
    await page.waitForTimeout(300);
    if (!(await visible(page.getByRole('dialog')).count())) throw new Error('點訊息後未顯示登入 Dialog');
    await closeDialog();
  });

  for (const label of ['我要刊登', '我的交易']) {
    await check(`${label}未登入攔截`, async () => {
      await reset();
      await clickDesktopControl(new RegExp(label));
      await page.waitForTimeout(300);
      if (!(await visible(page.getByRole('dialog')).count())) throw new Error('未顯示登入 Dialog');
      await closeDialog();
    });
  }

  await check('切換至二手物品並返回二手書籍', async () => {
    await reset();
    await clickDesktopControl(/二手物品|逛二手物品/);
    await page.waitForTimeout(450);
    if (!/market=secondhand/.test(page.url())) throw new Error(`未切換二手物品：${page.url()}`);
    const secondhandUrl = page.url();
    await clickDesktopControl(/二手書籍|回二手書籍市場/);
    await page.waitForTimeout(450);
    if (!/market=book/.test(page.url())) throw new Error(`未返回二手書籍：${page.url()}`);
    return `secondhand=${secondhandUrl}, books=${page.url()}`;
  });

  await check('切換零元贈送', async () => {
    await reset();
    await clickDesktopControl(/零元贈送/);
    await page.waitForTimeout(450);
    if (!/market=giveaway/.test(page.url())) throw new Error(page.url());
    return page.url();
  });

  await check('購物車空狀態／面板', async () => {
    await reset();
    await clickDesktopControl(/購物車/);
    await page.waitForTimeout(300);
    const body = await page.locator('body').innerText();
    if (!/購物車|購物袋|尚無商品|空的/.test(body)) throw new Error('未找到購物車狀態');
    return '購物車介面已出現';
  });

  await check('Hero 搜尋同步至列表', async () => {
    await reset();
    const hero = page.getByPlaceholder(/搜尋二手書名、課程或老師/);
    await hero.fill('微積分');
    await visible(page.getByRole('button', { name: /依目前輸入開始找二手書籍|開始找二手書/ })).first().click();
    await page.waitForTimeout(350);
    const values = await page.locator('input').evaluateAll((inputs) => inputs.map((input) => input.value));
    if (values.filter((value) => value.includes('微積分')).length < 2) throw new Error(JSON.stringify(values));
    return JSON.stringify(values.filter((value) => value.includes('微積分')));
  });

  await check('列表搜尋輸入與清除', async () => {
    await reset();
    const input = page.getByPlaceholder('搜尋課本...');
    await input.fill('英文');
    if ((await input.inputValue()) !== '英文') throw new Error('輸入失敗');
    const clear = visible(page.getByRole('button', { name: /清除搜尋|清除/ })).first();
    if (await clear.count()) await clear.click();
    else await input.fill('');
    if ((await input.inputValue()) !== '') throw new Error('清除失敗');
  });

  await check('科系與價格篩選', async () => {
    await reset();
    const department = page.getByLabel('科系');
    const price = page.getByLabel('最高價格');
    await department.selectOption({ label: '資訊工程系' });
    await price.selectOption('300');
    const values = { department: await department.inputValue(), price: await price.inputValue() };
    if (values.department !== '資訊工程系' || values.price !== '300') throw new Error(JSON.stringify(values));
    return JSON.stringify(values);
  });

  await check('圖片搜尋開啟檔案選擇器', async () => {
    await reset();
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
    await visible(page.getByRole('button', { name: /用照片找二手書|照片搜二手書/ })).first().click();
    await chooser;
    return 'filechooser opened, no file selected';
  });

  for (const [label, path, heading] of [
    ['隱私權', '/privacy', '隱私權政策'],
    ['使用條款', '/terms', '使用條款'],
    ['交易安全', '/safety', '交易與社群安全'],
  ]) {
    await check(`Footer 導覽：${label}`, async () => {
      await reset();
      const link = visible(page.getByRole('link', { name: label, exact: true })).first();
      if (!(await link.count())) throw new Error('找不到 Footer link');
      await Promise.all([
        page.waitForURL((url) => url.pathname.startsWith(path), { timeout: 7000 }),
        link.click(),
      ]);
      const h1 = await page.getByRole('heading', { level: 1 }).first().innerText();
      if (!h1.includes(heading)) throw new Error(`h1=${h1}`);
      return `url=${page.url()}, h1=${h1}`;
    });
  }

  await check('政策頁返回首頁', async () => {
    await page.goto(`${TARGET}privacy`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('link', { name: /返回虎科書流/ })).click();
    await page.waitForURL(TARGET, { timeout: 7000 });
    return page.url();
  });

  await check('問題回報開啟與關閉', async () => {
    await reset();
    await visible(page.getByRole('button', { name: '問題回報', exact: true })).click();
    await page.waitForTimeout(250);
    if (!(await visible(page.getByRole('dialog')).count())) throw new Error('Dialog 未開啟');
    const closeButtons = visible(page.locator('button[aria-label="關閉視窗"]'));
    const count = await closeButtons.count();
    if (!count) throw new Error('找不到關閉按鈕');
    const modalClose = visible(page.locator('button.modal-close')).first();
    if (await modalClose.count()) await modalClose.click();
    else await closeButtons.last().click();
    await page.waitForTimeout(250);
    if (await visible(page.getByRole('dialog')).count()) throw new Error('Dialog 未關閉');
    return `closeButtons=${count}`;
  });

  await check('第一個商品卡片可開啟', async () => {
    await reset();
    const card = visible(page.getByRole('button', { name: /查看《/ })).first();
    if (!(await card.count())) throw new Error('找不到商品卡片');
    await card.click();
    await page.waitForTimeout(350);
    if (!/[?&](book|item)=/.test(page.url())) throw new Error(page.url());
    return page.url();
  });
} catch (error) {
  report.fatal = compact(error?.stack || error, 500);
} finally {
  if (browser) await browser.close();
}

const ignoredHosts = ['challenges.cloudflare.com', 'brunhild.challenges.cloudflare.com'];
const hostOf = (url) => {
  try { return new URL(url).host; } catch { return ''; }
};
const appConsoleErrors = report.consoleErrors.filter(
  (error) => !ignoredHosts.includes(hostOf(error.location?.url || '')),
);
const nonAbortedFailedRequests = report.failedRequests.filter(
  (request) => !/ERR_ABORTED/.test(request.error),
);
const appFailedRequests = nonAbortedFailedRequests.filter(
  (request) => !ignoredHosts.includes(hostOf(request.url)),
);
const appBadResponses = report.badResponses.filter(
  (response) => !ignoredHosts.includes(hostOf(response.url)),
);

const result = {
  summary: {
    pass: report.checks.filter((check) => check.status === 'PASS').length,
    fail: report.checks.filter((check) => check.status === 'FAIL').length,
    appConsoleErrors: appConsoleErrors.length,
    pageErrors: report.pageErrors.length,
    appFailedRequests: appFailedRequests.length,
    appBadResponses: appBadResponses.length,
    cloudflareConsoleErrors: report.consoleErrors.length - appConsoleErrors.length,
    cloudflareOrAbortedNetworkNoise:
      report.failedRequests.length - appFailedRequests.length + report.badResponses.length - appBadResponses.length,
  },
  checks: report.checks,
  observations: report.observations,
  appConsoleErrors: appConsoleErrors.slice(0, 10),
  pageErrors: report.pageErrors.slice(0, 10),
  appFailedRequests: appFailedRequests.slice(0, 10),
  appBadResponses: appBadResponses.slice(0, 10),
  cloudflareSamples: {
    console: report.consoleErrors.filter((error) => ignoredHosts.includes(hostOf(error.location?.url || ''))).slice(0, 3),
    failed: nonAbortedFailedRequests.filter((request) => ignoredHosts.includes(hostOf(request.url))).slice(0, 3),
    bad: report.badResponses.filter((response) => ignoredHosts.includes(hostOf(response.url))).slice(0, 3),
  },
  fatal: report.fatal,
};

console.log('DESKTOP_AUDIT=' + JSON.stringify(result));
