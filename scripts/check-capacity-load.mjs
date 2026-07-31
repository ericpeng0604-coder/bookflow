#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("scripts/capacity-load.mjs", "utf8");
const required = [
  "public-list",
  "public-search",
  "public-detail",
  "authenticated-profile",
  "authenticated-notifications",
  "authenticated-conversations",
  "purchase-request",
  "purchase-race",
  "realtime",
  "CAPACITY_ALLOWED_HOSTS",
  "CAPACITY_CONFIRM",
  "CAPACITY_CONFIRM_MUTATIONS",
  "httpErrorRate",
  "p50Ms",
  "p95Ms",
  "p99Ms",
  "databaseEvidence",
];
for (const token of required) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `capacity runner missing ${token}`);
assert.match(source, /never printed|never printed/i, "runner must avoid printing credentials");
assert.match(source, /targetLabel.*local.*isolated.*staging/s, "runner must restrict target labels");
console.log(`Capacity load runner contract passed (${required.length} checks).`);
