import { chromium } from 'playwright';

const output = {
  pass: [],
  fail: [],
  visibleButtons: [],
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  badResponses: [],
  fatal: null,
};

const shorten = (error) => String(error?.message ?? error).replace(/\s+/g, ' ').slice(0, 140);
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
  page.setDefaultTimeout(5000);

  page.on('console', (message) => {
    if (message.type() === 'error') output.consoleErrors.push(message.text().slice(0, 180));
  });
  page.on('pageerror', (error) => output.pageErrors.push(String(error).slice(0, 180)));
  page.on('requestfailed', (request) => {
    output.failedRequests.push(`${request.failure()?.errorText ?? ''} ${request.url().slice(0, 160)}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) output.badResponses.push(`${response.status()} ${response.url().slice(0, 160)}`);
  });

  const reset = async () => {
    await page.goto('https://bookflow-green.vercel.app/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(700);
  };

  const check = async (name, callback) => {
    try {
      await callback();
      output.pass.push(name);
    } catch (error) {
      output.fail.push(`${name}｜${shorten(error)}`);
    }
  };

  await reset();
  output.pass.push('首頁載入');

  await check('無水平溢位', async () => {
    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
    }));
    if (size.scrollWidth > size.innerWidth + 2) throw new Error(JSON.stringify(size));
  });

  await check('手機選單開啟', async () => {
    const button = page.getByRole('button', { name: /開啟選單|關閉選單/ }).first();
    await button.click();
    await page.waitForTimeout(150);
    if ((await button.getAttribute('aria-expanded')) !== 'true') throw new Error('aria-expanded != true');
    output.visibleButtons = (await page.locator('button:visible').allTextContents())
      .map((text) => text.trim())
      .filter(Boolean);
  });

  for (const label of ['二手書籍', '二手物品', '零元贈送']) {
    await check(`市場切換：${label}`, async () => {
      await reset();
      const menu = page.getByRole('button', { name: /開啟選單/ }).first();
      if (await menu.count()) await menu.click();
      const button = page.getByRole('button', { name: label, exact: true }).filter({ visible: true });
      if (!(await button.count())) throw new Error('找不到可見按鈕');
      await button.first().click();
      await page.waitForTimeout(250);
    });
  }

  for (const label of ['我要刊登', '我的交易', '登入／註冊', '訊息', '購物車']) {
    await check(`未登入入口：${label}`, async () => {
      await reset();
      let button = page.getByRole('button', { name: new RegExp(label) }).filter({ visible: true }).first();
      if (!(await button.count())) {
        const menu = page.getByRole('button', { name: /開啟選單/ }).first();
        if (await menu.count()) await menu.click();
        button = page.getByRole('button', { name: new RegExp(label) }).filter({ visible: true }).first();
      }
      if (!(await button.count())) throw new Error('找不到可見按鈕');
      await button.click();
      await page.waitForTimeout(250);
      if (!/登入|註冊|信箱|Google/.test(await page.locator('body').innerText())) {
        throw new Error('未出現登入介面');
      }
    });
  }

  await check('Hero 搜尋', async () => {
    await reset();
    const input = page.getByPlaceholder(/搜尋二手書名、課程或老師/);
    await input.fill('微積分');
    await page.getByRole('button', { name: /依目前輸入開始找二手書籍|開始找二手書/ }).first().click();
    await page.waitForTimeout(250);
  });

  await check('列表搜尋', async () => {
    await reset();
    await page.getByPlaceholder('搜尋課本...').fill('英文');
  });

  await check('科系篩選', async () => {
    await reset();
    await page.getByLabel('科系').selectOption({ label: '資訊工程系' });
  });

  await check('價格篩選', async () => {
    await reset();
    await page.getByLabel('最高價格').selectOption('300');
  });

  await check('圖片搜尋檔案選擇器', async () => {
    await reset();
    const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
    await page.getByRole('button', { name: /用照片找二手書|照片搜二手書/ }).first().click();
    await chooser;
  });

  for (const [name, path] of [['隱私權', '/privacy'], ['使用條款', '/terms'], ['交易安全', '/safety']]) {
    await check(`Footer：${name}`, async () => {
      await reset();
      await page.getByRole('link', { name, exact: true }).click();
      await page.waitForLoadState('domcontentloaded');
      if (!new URL(page.url()).pathname.startsWith(path)) throw new Error(page.url());
    });
  }

  await check('問題回報入口', async () => {
    await reset();
    await page.getByRole('button', { name: '問題回報', exact: true }).click();
    await page.waitForTimeout(250);
  });
} catch (error) {
  output.fatal = shorten(error);
} finally {
  if (browser) await browser.close();
}

console.log(`RESULT_SUMMARY=${JSON.stringify({
  pass: output.pass,
  fail: output.fail,
  visibleButtons: output.visibleButtons,
  counts: {
    consoleErrors: output.consoleErrors.length,
    pageErrors: output.pageErrors.length,
    failedRequests: output.failedRequests.length,
    badResponses: output.badResponses.length,
  },
  consoleErrors: output.consoleErrors.slice(0, 5),
  pageErrors: output.pageErrors.slice(0, 5),
  failedRequests: output.failedRequests.slice(0, 5),
  badResponses: output.badResponses.slice(0, 5),
  fatal: output.fatal,
})}`);
