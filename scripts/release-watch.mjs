#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";
import { join } from "node:path";

const root = process.cwd();
const node = process.execPath;
const args = process.argv.slice(2);

function usage() {
  console.log("Usage: node scripts/release-watch.mjs --pr <number-or-url> [--timeout seconds]\n       node scripts/release-watch.mjs --production <full-commit-sha>");
}

const mode = args[0];
if (!mode || !["--pr", "--production"].includes(mode)) {
  usage();
  process.exit(1);
}

if (mode === "--production") {
  const expectedCommit = args[1] || process.env.EXPECTED_COMMIT;
  if (!/^[0-9a-f]{40}$/i.test(expectedCommit || "")) {
    console.error("EXPECTED_COMMIT must be a full 40-character commit SHA.");
    process.exit(1);
  }
  const result = spawnSync(node, [join(root, "scripts", "release-smoke.mjs")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, EXPECTED_COMMIT: expectedCommit },
  });
  process.exit(result.status ?? 1);
}

const pr = args[1];
if (!pr) {
  usage();
  process.exit(1);
}
const watcherArgs = [join(root, "scripts", "release-pr-status.mjs"), pr, "--wait"];
for (let index = 2; index < args.length; index += 1) watcherArgs.push(args[index]);
const result = spawnSync(node, watcherArgs, { cwd: root, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
