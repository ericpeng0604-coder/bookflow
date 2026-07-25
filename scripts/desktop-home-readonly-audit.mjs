import { chromium } from 'playwright';

const target = 'https://bookflow-green.vercel.app/';
const widths = [1024, 1100, 1200, 1280, 1366, 1440, 1600, 1920];
const out = { breakpoints: [], interaction1440: null, fatal: null };
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(700);
    const data = await page.evaluate(() => {
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const controls = [...document.querySelectorAll('header a, header button')].filter(visible);
      const labels = controls.map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim());
      const hamburger = controls.find((el) => /開啟選單|關閉選單/.test(el.getAttribute('aria-label') || ''));
      const nav = ['二手書籍', '二手物品', '零元贈送', '我要刊登', '我的交易'].filter((label) => labels.includes(label));
      const hrect = hamburger?.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        navVisible: nav,
        hamburgerVisible: Boolean(hamburger),
        hamburgerRight: hrect ? Math.round(hrect.right * 10) / 10 : null,
        hamburgerClass: hamburger?.className || null,
        controlCount: controls.length,
      };
    });
    out.breakpoints.push({ width, overflow: data.scrollWidth - width, ...data });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(700);
  const hamburger = page.getByRole('button', { name: /開啟選單/ }).filter({ visible: true }).first();
  if (await hamburger.count()) {
    const before = await hamburger.getAttribute('aria-expanded');
    await hamburger.click();
    await page.waitForTimeout(250);
    const after = await hamburger.getAttribute('aria-expanded');
    const duplicateLabels = await page.locator('button:visible').evaluateAll((nodes) =>
      nodes.map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter((text) =>
        ['二手書籍', '二手物品', '零元贈送', '我要刊登', '我的交易', '登入 / 註冊'].includes(text),
      ),
    );
    out.interaction1440 = { before, after, duplicateLabels };
  }
} catch (error) {
  out.fatal = String(error?.stack || error).replace(/\s+/g, ' ').slice(0, 500);
} finally {
  if (browser) await browser.close();
}
console.log('DESKTOP_BREAKPOINTS=' + JSON.stringify(out));
