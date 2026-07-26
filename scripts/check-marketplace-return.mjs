import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("components/marketplace-app.tsx", "utf8");
const switchListingType = app.match(/function switchListingType\(nextType: ListingType\) \{[\s\S]*?\n  \}/)?.[0];

assert.ok(switchListingType, "switchListingType must remain a local navigation seam");
assert.match(
  switchListingType,
  /setMarketplaceReloadKey\(\(previous\) => previous \+ 1\)/,
  "returning to the current market must still request a fresh marketplace load",
);

console.log("Marketplace return regression checks passed (1/1)");
