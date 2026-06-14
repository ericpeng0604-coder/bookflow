#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { projectRoot, resolveNodeExecutable } from "./lib/check-runner.mjs";

const node = resolveNodeExecutable();
const stripTypesArgs = ["--experimental-strip-types"];

const checkScripts = [
  { name: "check:filters", path: "scripts/check-filters.mjs", stripTypes: false },
  { name: "check:lifecycle", path: "scripts/check-listing-lifecycle.mjs", stripTypes: false },
  { name: "check:trade", path: "scripts/check-trade-workflow.mjs", stripTypes: false },
  { name: "check:chat-state", path: "scripts/check-chat-switching.mjs", stripTypes: false },
  { name: "check:notifications", path: "scripts/check-notification-refresh.mjs", stripTypes: false },
  { name: "check:push", path: "scripts/check-browser-push.mjs", stripTypes: false },
  { name: "check:capacity", path: "scripts/check-capacity-optimization.mjs", stripTypes: false },
  { name: "check:refresh-guard", path: "scripts/check-refresh-guard.mjs", stripTypes: true },
  { name: "check:favorites", path: "scripts/check-favorites.mjs", stripTypes: true },
  { name: "check:notification-delivery", path: "scripts/check-notification-delivery.mjs", stripTypes: true },
  { name: "check:workflows", path: "scripts/check-workflows.mjs", stripTypes: false },
];

function runStep(label, args) {
  console.log(`\n=== ${label} ===`);
  execFileSync(node, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
}

for (const script of checkScripts) {
  const scriptPath = join(projectRoot, script.path);
  if (!existsSync(scriptPath)) {
    throw new Error(`Missing check script: ${script.path}`);
  }
  const args = script.stripTypes ? [...stripTypesArgs, scriptPath] : [scriptPath];
  runStep(script.name, args);
}

const tscPath = join(projectRoot, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(tscPath)) {
  throw new Error("Missing TypeScript compiler. Run npm install first.");
}
runStep("typecheck", [tscPath, "--noEmit"]);

const nextPath = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextPath)) {
  throw new Error("Missing Next.js build binary. Run npm install first.");
}
runStep("build", [nextPath, "build"]);

console.log("\nVerification passed: all check scripts, typecheck, and production build.");
