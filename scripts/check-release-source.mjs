#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (file) => readFileSync(join(process.cwd(), file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const source = read("scripts/release-source.mjs");
const dev = read("scripts/dev-latest.mjs");
const route = read("app/api/health/source/route.ts");

assert.equal(packageJson.scripts.dev, "node scripts/dev-latest.mjs");
assert.match(packageJson.scripts["check:local-source"], /release-source\.mjs check-local/);
assert.match(source, /bookflow-source-fingerprint-v1/);
assert.match(source, /\.env/);
assert.match(source, /NOT LATEST/);
assert.match(dev, /dev-environment\.mjs.*--fix/);
assert.match(dev, /BOOKFLOW_SOURCE_MODE/);
assert.match(route, /bookflow-source\.json/);
assert.match(route, /BOOKFLOW_SOURCE_FINGERPRINT/);
assert.match(route, /status.*unavailable/);
console.log("Release source contract passed.");
