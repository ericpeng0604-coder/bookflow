import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidateMarketplaceCache,
  MAX_MARKETPLACE_CACHE_ENTRIES,
  readMarketplaceCache,
  writeMarketplaceCache,
} from "../lib/marketplace/marketplace-cache.ts";

const entry = (title, count = 1) => ({
  books: [{ id: title, title }],
  count,
  hasMore: false,
  nextCursor: null,
});

test("marketplace cache keeps entries separated by filter key", () => {
  const cache = new Map();
  writeMarketplaceCache(cache, "book", entry("book-title"));
  writeMarketplaceCache(cache, "giveaway", entry("giveaway-title"));

  assert.equal(readMarketplaceCache(cache, "book").books[0].title, "book-title");
  assert.equal(readMarketplaceCache(cache, "giveaway").books[0].title, "giveaway-title");
});

test("marketplace cache can be invalidated before a mutation refresh", () => {
  const cache = new Map();
  writeMarketplaceCache(cache, "book", entry("stale"));
  invalidateMarketplaceCache(cache, "book");
  assert.equal(readMarketplaceCache(cache, "book"), null);
});

test("marketplace cache bounds retained filter results", () => {
  const cache = new Map();
  for (let index = 0; index < MAX_MARKETPLACE_CACHE_ENTRIES + 1; index += 1) {
    writeMarketplaceCache(cache, `filter-${index}`, entry(`title-${index}`));
  }
  assert.equal(cache.size, MAX_MARKETPLACE_CACHE_ENTRIES);
  assert.equal(readMarketplaceCache(cache, "filter-0"), null);
});
