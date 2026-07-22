#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const page = read("app/release/page.tsx");
const client = read("app/release/release-dashboard.tsx");
const runRoute = read("app/api/release/run/route.ts");
const statusRoute = read("app/api/release/status/route.ts");
const serverState = read("lib/release-dashboard-server.ts");
const sourceRoute = read("app/api/health/source/route.ts");
const devScript = read("scripts/dev-latest.mjs");

assert.match(page, /BOOKFLOW_RELEASE_DASHBOARD_ENABLED/);
assert.match(client, /api\/release\/run/);
assert.match(client, /api\/release\/status/);
assert.match(client, /release-production\.yml/);
assert.match(runRoute, /RELEASE_DASHBOARD_COMMANDS/);
assert.match(runRoute, /dashboardEnabled/);
assert.match(runRoute, /process\.execPath/);
assert.match(runRoute, /windowsHide: true/);
assert.match(statusRoute, /cache-control/);
assert.match(serverState, /dashboardEnabled/);
assert.match(sourceRoute, /BOOKFLOW_SOURCE_FINGERPRINT/);
assert.match(devScript, /BOOKFLOW_RELEASE_DASHBOARD_ENABLED: "true"/);
assert.match(devScript, /\/release/);
assert.doesNotMatch(runRoute, /request\.json\(\)|shell:\s*true/);

console.log("Release dashboard checks passed.");
