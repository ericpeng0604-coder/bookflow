import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "components", "marketplace-app.tsx"), "utf8");
const cache = fs.readFileSync(path.join(root, "lib", "marketplace", "marketplace-cache.ts"), "utf8");
const required = [
  "marketplaceCacheRef",
  "readMarketplaceCache",
  "writeMarketplaceCache",
  "invalidateMarketplaceCache",
  "marketplaceFiltersKey(marketplaceFilters)",
  "setMarketplaceLoading(true)",
  "loadMarketplaceBooks(), loadMarketplaceCount()",
];
for (const token of required) {
  if (!app.includes(token) && !cache.includes(token)) throw new Error(`missing marketplace cache guard: ${token}`);
}
if (!app.includes("const cached = readMarketplaceCache")) throw new Error("market switch must read its own cache entry");
if (!app.includes("invalidateMarketplaceCache(marketplaceCacheRef.current")) throw new Error("mutation refresh must invalidate the current cache entry");
if (!cache.includes("MAX_MARKETPLACE_CACHE_ENTRIES")) throw new Error("marketplace cache needs a bounded size");
console.log("market cache regression checks passed");
