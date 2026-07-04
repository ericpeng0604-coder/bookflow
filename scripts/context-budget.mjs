#!/usr/bin/env node

import { statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import {
  git,
  inspectReleaseEnvironment,
  lines,
} from "./lib/release-environment.mjs";

function unique(values) {
  return [...new Set(values)].sort();
}

function matchesAny(file, prefixes) {
  return prefixes.some((prefix) => file === prefix || file.startsWith(prefix));
}

function fileSize(root, file) {
  try {
    return statSync(join(root, file)).size;
  } catch {
    return 0;
  }
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

const root = git(["rev-parse", "--show-toplevel"]);
const changedTracked = lines(git(["diff", "--name-only", "HEAD"]));
const untracked = lines(git(["ls-files", "--others", "--exclude-standard"]));
const changedFiles = unique([...changedTracked, ...untracked]);
const statusCount = lines(git(["status", "--porcelain=v1"])).length;
const report = inspectReleaseEnvironment(root);

const protectedRecoveryFiles = [
  ".github/workflows/rollback-production.yml",
  ".github/workflows/protect-rollback-workflow.yml",
  ".github/CODEOWNERS",
];

const knownHighContextFiles = [
  "components/marketplace-app.tsx",
  "app/globals.css",
  "AI_WORK_MANUAL.md",
  "AI_HANDOFF.md",
  "supabase/schema.sql",
];

const touchedProtected = changedFiles.filter((file) =>
  protectedRecoveryFiles.includes(file),
);
const touchedRuntime = changedFiles.filter((file) =>
  matchesAny(file, ["app/", "components/", "lib/", "public/", "next.config.ts"]),
);
const touchedScripts = changedFiles.filter((file) => file.startsWith("scripts/"));
const touchedSql = changedFiles.filter((file) => file.startsWith("supabase/"));
const touchedDocs = changedFiles.filter((file) =>
  matchesAny(file, ["docs/", "AI_WORK_MANUAL.md", "AI_HANDOFF.md", "README.md", "AGENTS.md"]),
);
const touchedPackage = changedFiles.filter((file) =>
  ["package.json", "package-lock.json", "tsconfig.json", "eslint.config.mjs"].includes(file),
);
const touchedHighContext = knownHighContextFiles.filter((file) =>
  changedFiles.includes(file),
);

console.log("BookFlow context budget (low-output)");
console.log(`Root: ${root}`);
console.log(`Working tree: ${statusCount ? `${statusCount} changed entries` : "clean"}`);
console.log(`Runtime: node on PATH ${report.nodeOnPath ? "yes" : "no"}, npm on PATH ${report.npmOnPath ? "yes" : "no"}, node_modules ${report.nodeModules}`);

if (!changedFiles.length) {
  console.log("\nNo local changes detected.");
  console.log("Start with targeted search, then expand only from a concrete hit.");
  process.exit(0);
}

console.log("\nChanged areas:");
console.log(`  Runtime/UI: ${touchedRuntime.length || "no"}`);
console.log(`  Scripts/tooling: ${touchedScripts.length || "no"}`);
console.log(`  SQL/Supabase: ${touchedSql.length || "no"}`);
console.log(`  Docs/handoff: ${touchedDocs.length || "no"}`);
console.log(`  Package/config: ${touchedPackage.length || "no"}`);
console.log(`  Protected recovery files: ${touchedProtected.length || "no"}`);

if (touchedProtected.length) {
  console.log("\nSTOP: protected recovery files changed.");
  console.log("Continue only with explicit rollback/recovery approval.");
}

if (statusCount) {
  console.log("\nDeploy stop rule:");
  console.log("  If the user wants deploy/merge/production confirmation and this checkout also holds unrelated edits, move to a clean worktree from latest origin/main before continuing.");
}

if (!report.nodeOnPath || !report.npmOnPath) {
  console.log("\nEnvironment stop rule:");
  console.log("  Confirm the runnable Node path before broad checks or substantial edits.");
  console.log("  Use the bundled Node runtime for repo scripts instead of switching the repo to another package manager.");
}

console.log("\nHigh-context files:");
if (touchedHighContext.length) {
  for (const file of touchedHighContext) {
    console.log(`  ${file} (${formatSize(fileSize(root, file))})`);
  }
  console.log("Read diffs or narrow matching regions first; avoid full-file dumps.");
} else {
  console.log("  none of the known high-context files are changed");
}

console.log("\nDefault low-context workflow:");
console.log("  1. Use targeted search before opening large files.");
console.log("  2. Read changed hunks before surrounding code.");
console.log("  3. Reuse previous command results inside the same task.");
console.log("  4. Prefer direct HTTP/API proof over repeated dashboard browsing.");
console.log("  5. Keep required checks; reduce repeated logs and screenshots.");

console.log("\nLikely evidence path:");
if (touchedScripts.length) {
  console.log("  - node --check <changed .mjs scripts>");
}
if (touchedRuntime.length || touchedPackage.length) {
  console.log("  - npm run typecheck");
  console.log("  - npm run lint");
  console.log("  - node scripts/run-project-checks.mjs");
  console.log("  - npm run build");
}
if (touchedSql.length) {
  console.log("  - staging migration and permission checks before production");
}
if (!touchedRuntime.length && !touchedPackage.length && !touchedSql.length) {
  console.log("  - syntax or focused checks for changed docs/tooling only");
}
