#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const header = app.slice(app.indexOf('<header className="site-header">'), app.indexOf("</header>"));
const market = app.slice(app.indexOf('<section className="market"'), app.indexOf('view === "book"'));
const listingForm = app.slice(app.indexOf("function BookFormModal"), app.indexOf("function ContactSettingsModal"));

assert.ok(
  header.includes('switchListingType(isSecondhandMode ? "book" : "secondhand")'),
  "market switching must remain in the top-right menu",
);
assert.ok(!header.includes(">課本市場</button>"), "desktop navigation must not show a separate textbook market button");
assert.ok(!header.includes(">二手市場</button>"), "desktop navigation must not show a separate secondhand market button");
assert.ok(!header.includes('openListingForm("book")'), "header must not expose a separate textbook listing entry");
assert.ok(!header.includes('openListingForm("secondhand")'), "header must not expose a separate secondhand listing entry");
assert.ok(!market.includes("market-mode-switch"), "the catalog must not expose another market switch");
assert.ok(!listingForm.includes("cover-upload"), "the large duplicate upload card must be removed");
assert.equal(
  (listingForm.match(/type="file"/g) ?? []).length,
  1,
  "the listing form must contain exactly one file control",
);
assert.ok(listingForm.includes('className="listing-file-input full"'), "the file control must use the styled input");
assert.ok(css.includes(".listing-file-input::file-selector-button"), "the native file button must be styled");

console.log("Listing navigation and upload UI checks passed.");
