#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readUtf8(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

const filtersSource = readUtf8("lib/marketplace/filters.ts");
const queriesSource = readUtf8("lib/marketplace/queries.ts");
const demoDataSource = readUtf8("lib/demo-data.ts");

for (const [label, source] of [
  ["filters.ts", filtersSource],
  ["queries.ts", queriesSource],
]) {
  assert.ok(!source.includes("不限價格"), `${label} must not compare against price label literals`);
  assert.ok(!source.includes("全部科系"), `${label} must not compare against department label literals`);
}

assert.match(filtersSource, /departments\[0\]/, "filters.ts should use departments[0] sentinel");
assert.match(filtersSource, /NO_MAX_PRICE/, "filters.ts should define NO_MAX_PRICE sentinel");
assert.match(filtersSource, /NO_MIN_PRICE/, "filters.ts should define NO_MIN_PRICE sentinel");
assert.match(filtersSource, /parseMinPriceFilter/, "filters.ts should parse minimum prices");

const departmentMatch = demoDataSource.match(/export const departments = \[\s*\n\s*"([^"]+)"/);
assert.ok(departmentMatch, "Could not read departments[0] from demo-data.ts");
const allDepartmentsLabel = departmentMatch[1];

function isAllDepartments(department) {
  return department === allDepartmentsLabel;
}

function parseMaxPriceFilter(maxPrice) {
  if (!maxPrice) return null;
  const value = Number(maxPrice);
  return Number.isFinite(value) ? value : null;
}

function buildMarketplaceFilters(department, maxPrice, query) {
  return {
    department: isAllDepartments(department) ? null : department,
    minPrice: null,
    maxPrice: parseMaxPriceFilter(maxPrice),
    query: query.trim() || null,
  };
}

assert.equal(isAllDepartments(allDepartmentsLabel), true);
assert.equal(isAllDepartments("資訊工程系"), false);
assert.deepEqual(buildMarketplaceFilters(allDepartmentsLabel, "", "  "), {
  department: null,
  minPrice: null,
  maxPrice: null,
  query: null,
});
assert.deepEqual(buildMarketplaceFilters("資訊工程系", "500", "微積分"), {
  department: "資訊工程系",
  minPrice: null,
  maxPrice: 500,
  query: "微積分",
});

console.log("Filter encoding and sentinel checks passed.");
