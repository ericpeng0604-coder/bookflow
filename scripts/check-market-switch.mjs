#!/usr/bin/env node

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(app, /function marketplaceFiltersKey\(filters: MarketplaceFilters\)/, "market filters need a stable request key");
assert.match(app, /const marketplaceQueryKeyRef = useRef\(\"\"\)/, "marketplace requests need current-key tracking");
assert.match(
  app,
  /function resetMarketplaceResults\(\)[\s\S]*marketplaceQueryKeyRef\.current = \"\"[\s\S]*setMarketplaceBooks\(\[\]\)[\s\S]*setMarketplaceCount\(0\)[\s\S]*setMarketplaceHasMore\(false\)/,
  "market switching must invalidate and clear the previous result set",
);
assert.match(
  app,
  /function switchListingType\(nextType: ListingType\) \{\s*resetMarketplaceResults\(\)/,
  "market switching must clear before changing the listing type",
);
assert.match(
  app,
  /if \(signal\.aborted \|\| marketplaceQueryKeyRef\.current !== requestKey\) return;/,
  "stale marketplace responses must not update the current market",
);
assert.match(app, /runGuarded\("marketplace-count"/, "marketplace counts must share refresh cancellation");
assert.match(app, /signal,\s*\}\);/, "count requests must be abortable");
assert.match(
  app,
  /if \(isAbortError\(error\) \|\| signal\.aborted \|\| marketplaceQueryKeyRef\.current !== requestKey\) return;/,
  "stale count failures must not restore an old count",
);
assert.match(
  app,
  /const append = options\?\.append \?\? false;[\s\S]*if \(imageSearchActive && !append\) return;/,
  "append loading must remain separate from fresh market loading",
);
assert.match(css, /\.book-grid\.is-refreshing \{ opacity: 1; \}/, "market refresh must not fade the product cards");
assert.doesNotMatch(css, /\.book-grid\.is-refreshing \{ opacity: \.72;/, "market refresh must not flash a faded product grid");

console.log("Market switch stale-result checks passed.");
