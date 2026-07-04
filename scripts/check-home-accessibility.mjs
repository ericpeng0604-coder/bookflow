#!/usr/bin/env node

import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const homeCss = readFileSync(new URL("../app/home-a11y.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/marketplace/navigation-state.ts", import.meta.url), "utf8");

const homeBlock = app.slice(app.indexOf('{view === "home" && ('), app.indexOf('{view === "book" && selectedBook'));

const checks = [
  ["skip link on home page", page.includes('className="skip-link"') && page.includes('href="#market"')],
  ["home page a11y stylesheet", page.includes("./home-a11y.css")],
  ["home wrapper landmark", homeBlock.includes('className="home-page"')],
  ["hero search label", homeBlock.includes('htmlFor="hero-search-input"')],
  ["mobile hero search arrow", homeBlock.includes('className="hero-search-arrow"') && homeBlock.includes('aria-label="依目前輸入開始找書"') && globalCss.includes(".hero-search-arrow")],
  ["course search guide entry", homeBlock.includes("openCourseSearchGuide") && homeBlock.includes("依課程快速找到課本") && homeBlock.includes('className="course-search-guide"')],
  ["concise hero message", homeBlock.includes('className="hero-message"') && homeBlock.includes("Good Books,")],
  ["hero section labelled", homeBlock.includes('aria-labelledby="home-hero-title"')],
  ["market section labelled", homeBlock.includes('aria-labelledby="home-market-title"') && homeBlock.includes('id="market"')],
  ["filter query label", homeBlock.includes('htmlFor="home-filter-query"')],
  ["filter department label", homeBlock.includes('htmlFor="home-filter-department"')],
  ["filter price label", homeBlock.includes('htmlFor="home-filter-price"')],
  ["filter chevrons do not steal taps", globalCss.includes(".home-page .filters label svg") && globalCss.includes("pointer-events: none") && homeBlock.includes('className="select-filter"') && globalCss.includes(".home-page .filters .select-filter svg")],
  ["unfinished advanced filter removed", !homeBlock.includes("進階篩選（即將推出）")],
  ["book cards keyboard buttons", homeBlock.includes('className="book-card-main"') && !homeBlock.includes('onClick={() => openBook(book.id)}>\n                  <div className="card-image"')],
  ["home card labels reserve alignment space", homeBlock.includes('className={`course-tag ${cardContextLabel(book) ? "" : "is-empty"}`}') && globalCss.includes(".home-page .course-tag.is-empty")],
  ["favorite button stays separate", homeBlock.includes('aria-pressed={favoriteIds.has(book.id)}')],
  ["book list semantics", homeBlock.includes("<ul") && homeBlock.includes("<li")],
  ["empty state live region", homeBlock.includes('className="empty"') && homeBlock.includes("aria-live")],
  ["load more busy state", homeBlock.includes("aria-busy={marketplaceLoading}")],
  ["current view survives browser refresh", navigation.includes('params.set("view", "dashboard")') && navigation.includes('params.set("tab", dashboardTab)') && navigation.includes('params.set("conversation", expandedConversationId)')],
  ["route restore avoids stale URL overwrite", navigation.includes("skipNextUrlWriteRef.current = true") && navigation.includes("skipNextUrlWriteRef.current = false")],
  ["current site hero visual", homeBlock.includes('className="hero-art hero-reference-art"')],
  ["focus styles for home cards", homeCss.includes(".home-page .book-card-main:focus-visible")],
  ["contrast tweak for muted home text", homeCss.includes(".home-page .result-line")],
  ["visually hidden utility", homeCss.includes(".visually-hidden") && homeCss.includes("clip: rect(0 0 0 0)")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Home accessibility checks passed (${checks.length}/${checks.length}).`);
