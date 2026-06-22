#!/usr/bin/env node

import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("../app/home-a11y.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

const homeBlock = app.slice(app.indexOf('view === "home"'), app.indexOf('view === "book"'));

const checks = [
  ["skip link on home page", page.includes('className="skip-link"') && page.includes('href="#market"')],
  ["home page a11y stylesheet", page.includes("./home-a11y.css")],
  ["home wrapper landmark", homeBlock.includes('className="home-page"')],
  ["hero search label", homeBlock.includes('htmlFor="hero-search-input"')],
  ["hero section labelled", homeBlock.includes('aria-labelledby="home-hero-title"')],
  ["market section labelled", homeBlock.includes('aria-labelledby="home-market-title"') && homeBlock.includes('id="market"')],
  ["filter query label", homeBlock.includes('htmlFor="home-filter-query"')],
  ["filter department label", homeBlock.includes('htmlFor="home-filter-department"')],
  ["filter price label", homeBlock.includes('htmlFor="home-filter-price"')],
  ["unfinished advanced filter removed", !homeBlock.includes("進階篩選（即將推出）")],
  ["book cards keyboard buttons", homeBlock.includes('className="book-card-main"') && !homeBlock.includes('onClick={() => openBook(book.id)}>\n                  <div className="card-image"')],
  ["favorite button stays separate", homeBlock.includes('aria-pressed={favoriteIds.has(book.id)}')],
  ["book list semantics", homeBlock.includes('role="list"') && homeBlock.includes('role="listitem"')],
  ["empty state live region", homeBlock.includes('role="status"') && homeBlock.includes("aria-live")],
  ["load more busy state", homeBlock.includes("aria-busy={marketplaceLoading}")],
  ["decorative hero art hidden", homeBlock.includes('className="hero-art" aria-hidden="true"')],
  ["focus styles for home cards", homeCss.includes(".home-page .book-card-main:focus-visible")],
  ["contrast tweak for muted home text", homeCss.includes(".home-page .result-line")],
  ["visually hidden utility", homeCss.includes(".home-page .visually-hidden")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Home accessibility checks passed (${checks.length}/${checks.length}).`);
