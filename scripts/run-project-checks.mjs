#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  "check-filters.mjs",
  "check-listing-lifecycle.mjs",
  "check-trade-workflow.mjs",
  "check-chat-switching.mjs",
  "check-notification-refresh.mjs",
  "check-browser-push.mjs",
  "check-capacity-optimization.mjs",
  "check-refresh-guard.mjs",
  "check-favorites.mjs",
  "check-notification-delivery.mjs",
  "check-workflows.mjs",
];

for (const check of checks) {
  console.log(`\n==> ${check}`);
  const result = spawnSync(process.execPath, [join(root, "scripts", check)], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nProject checks passed (${checks.length}/${checks.length}).`);
