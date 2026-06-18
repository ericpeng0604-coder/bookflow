#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  { file: "check-filters.mjs" },
  { file: "check-free-ocr-book-covers.mjs", stripTypes: true },
  { file: "check-mobile-book-ocr.mjs" },
  { file: "check-listing-navigation-ui.mjs" },
  { file: "check-listing-lifecycle.mjs" },
  { file: "check-trade-workflow.mjs" },
  { file: "check-chat-switching.mjs" },
  { file: "check-notification-refresh.mjs" },
  { file: "check-browser-push.mjs" },
  { file: "check-capacity-optimization.mjs" },
  { file: "check-refresh-guard.mjs", stripTypes: true },
  { file: "check-favorites.mjs", stripTypes: true },
  { file: "check-notification-delivery.mjs", stripTypes: true },
  { file: "check-trade-chat.mjs" },
  { file: "check-chat-visibility-and-feedback.mjs" },
  { file: "check-home-accessibility.mjs" },
  { file: "check-push-subscription-api.mjs" },
  { file: "check-google-auth.mjs" },
  { file: "check-workflows.mjs" },
];

for (const check of checks) {
  console.log(`\n==> ${check.file}`);
  const args = check.stripTypes
    ? ["--experimental-strip-types", join(root, "scripts", check.file)]
    : [join(root, "scripts", check.file)];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nProject checks passed (${checks.length}/${checks.length}).`);
