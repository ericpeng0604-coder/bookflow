import { chromium } from 'playwright';

const TARGET = 'https://bookflow-green.vercel.app/';
const widths = [1024, 1280, 1366, 1440, 1920];
const result = { breakpoints: [], interaction: null, appConsoleErrors: [], pageErrors: [], fatal: null };
const compact = (value, max = 240) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const ignoredHosts = new Set(['challenges.cloudflare.com', 'brunhild.challenges.cloudflare.com']);
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    if (!ignoredHosts.has(hostOf(location.url || ''))) {
      result.appConsoleErrors.push({ text: compact(message.text()), location });
    }
  });
  page.on('pageerror', (error) => result.pageErrors.push(compact(error)));

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(900);

    const header = page.locator('header').first();
    const controls = await header.locator('a:visible, button:visible').evaluateAll((nodes) =>
      nodes.map((node, index) => {
        const rect = node.getBoundingClientRect();
        return {
          index,
          text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          ariaLabel: node.getAttribute('aria-label'),
          className: node.className,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        };
      }),
    );
    const hamburger = controls.filter((control) => /開啟選單|關閉選單/.test(control.ariaLabel || ''));
    const primaryNavLabels = ['二手書籍', '二手物品', '零元贈送', '我要刊登', '我的交易'];
    const primaryVisible = primaryNavLabels.filter((label) => controls.some((control) => control.text === label));

    const overlaps = [];
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i].rect;
        const b = controls[j].rect;
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (x * y > 4) overlaps.push([controls[i].ariaLabel || controls[i].text, controls[j].ariaLabel || controls[j].text]);
      }
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    result.breakpoints.push({
      width,
      scrollWidth,
      headerControlCount: controls.length,
      primaryVisible,
      hamburgerVisible: hamburger.length,
      hamburger: hamburger[0] || null,
      overlaps,
      controls,
    });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(900);
  const hamburger = page.getByRole('button', { name: /開啟選單|關閉選單/ }).filter({ visible: true }).first();
  if (await hamburger.count()) {
    const before = await hamburger.getAttribute('aria-expanded');
    await hamburger.click();
    await page.waitForTimeout(250);
    const after = await hamburger.getAttribute('aria-expanded');
    const visibleMenuButtons = await page.locator('button:visible').evaluateAll((nodes) =>
      nodes.map((node) => ({
        text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        ariaLabel: node.getAttribute('aria-label'),
        className: node.className,
      })),
    );
    result.interaction = { before, after, visibleMenuButtons };
  } else {
    result.interaction = { hamburgerVisible: false };
  }
} catch (error) {
  result.fatal = compact(error?.stack || error, 500);
} finally {
  if (browser) await browser.close();
}

console.log('DESKTOP_HEADER_DIAG=' + JSON.stringify(result));
