#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function unique(values) {
  return [...new Set(values)].sort();
}

function matchesAny(file, prefixes) {
  return prefixes.some((prefix) => file === prefix || file.startsWith(prefix));
}

const status = lines(git(["status", "--porcelain=v1"]));
const branch = git(["branch", "--show-current"]) || "(detached)";
const head = git(["rev-parse", "HEAD"]);
const changedTracked = lines(git(["diff", "--name-only", "HEAD"]));
const untracked = lines(git(["ls-files", "--others", "--exclude-standard"]));
const changedFiles = unique([...changedTracked, ...untracked]);

const protectedRecoveryFiles = [
  ".github/workflows/rollback-production.yml",
  ".github/workflows/protect-rollback-workflow.yml",
  ".github/CODEOWNERS",
];

const touchedProtected = changedFiles.filter((file) =>
  protectedRecoveryFiles.includes(file),
);
const touchedMigrations = changedFiles.filter((file) =>
  file.startsWith("supabase/migrations/"),
);
const touchedWorkflows = changedFiles.filter((file) =>
  file.startsWith(".github/workflows/"),
);
const touchedRuntime = changedFiles.filter((file) =>
  matchesAny(file, ["app/", "components/", "lib/", "public/", "next.config.ts"]),
);
const touchedPackage = changedFiles.filter((file) =>
  ["package.json", "package-lock.json", "tsconfig.json", "eslint.config.mjs"].includes(file),
);

console.log("BookFlow release plan (low-output)");
console.log(`Branch: ${branch}`);
console.log(`HEAD: ${head}`);
console.log(`Working tree: ${status.length ? `${status.length} changed entries` : "clean"}`);

if (!changedFiles.length) {
  console.log("\nNo local file changes detected.");
  console.log("For an already-merged release, verify production with:");
  console.log("  RELEASE_BASE_URL=https://bookflow-green.vercel.app EXPECTED_COMMIT=<merged-sha> npm run release:smoke");
  process.exit(0);
}

console.log("\nChanged areas:");
console.log(`  Runtime/UI: ${touchedRuntime.length ? touchedRuntime.length : "no"}`);
console.log(`  Database migrations: ${touchedMigrations.length ? touchedMigrations.length : "no"}`);
console.log(`  GitHub workflows: ${touchedWorkflows.length ? touchedWorkflows.length : "no"}`);
console.log(`  Tooling/config: ${touchedPackage.length ? touchedPackage.length : "no"}`);
console.log(`  Protected recovery files: ${touchedProtected.length ? touchedProtected.length : "no"}`);

if (touchedProtected.length) {
  console.log("\nSTOP: protected recovery files changed:");
  for (const file of touchedProtected) console.log(`  ${file}`);
  console.log("Only continue if the user explicitly requested rollback/recovery changes.");
  console.log("Run workflow structure checks and use the required approval trailer in that isolated commit.");
}

console.log("\nMinimum local evidence before PR:");
console.log("  1. Review the final diff and preserve unrelated edits.");
console.log("  2. npm run check:project");
console.log("  3. npm run typecheck");
console.log("  4. npm run lint");
console.log("  5. npm run build");

if (touchedWorkflows.length || touchedProtected.length) {
  console.log("  6. npm run check:workflows");
}

if (touchedMigrations.length) {
  console.log("\nDatabase release gates:");
  console.log("  - Staging Migration must pass before production approval.");
  console.log("  - Production Migration requires explicit approval.");
  console.log("  - Verify the migrated behavior, not only the web deploy.");
}

console.log("\nProduction proof after merge:");
console.log("  RELEASE_BASE_URL=https://bookflow-green.vercel.app EXPECTED_COMMIT=<merged-sha> npm run release:smoke");
console.log("  Use /api/health/release for the deployed commit before opening large dashboards.");
