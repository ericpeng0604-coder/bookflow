#!/usr/bin/env node

import process from "node:process";

import { analyzeReleaseScope, formatReleaseScopeStop } from "./lib/release-scope.mjs";

const baseRef = process.env.RELEASE_BASE_REF || "origin/main";
const scope = analyzeReleaseScope(baseRef);

console.log("BookFlow release scope check");
console.log(`Base ref: ${baseRef}`);
console.log(`Working tree files: ${scope.statusFiles.length}`);
console.log(`Working tree areas: ${scope.workingTreeAreas.join(", ") || "none"}`);
console.log(`PR areas: ${scope.prAreas.join(", ") || "none"}`);

if (scope.riskyMixedScope) {
  console.error("");
  console.error(formatReleaseScopeStop(scope));
  process.exit(1);
}

if (scope.hasObservability) {
  console.log("");
  console.log("Observability sequencing guard:");
  console.log("  - Merge code before treating env rollout as live instrumentation.");
  console.log("  - Confirm /api/health/release matches the merged commit before Sentry smoke.");
}

console.log("");
console.log("Release scope check passed.");
