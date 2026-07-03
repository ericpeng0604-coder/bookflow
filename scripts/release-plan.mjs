#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  inspectReleaseEnvironment,
  printReleaseEnvironment,
} from "./lib/release-environment.mjs";

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
const report = inspectReleaseEnvironment();

console.log("BookFlow release plan (low-output)");
console.log(`Branch: ${branch}`);
console.log(`HEAD: ${head}`);
console.log(`Working tree: ${status.length ? `${status.length} changed entries` : "clean"}`);
console.log("");
printReleaseEnvironment(report);

if (!changedFiles.length) {
  console.log("\nNo local file changes detected.");
  console.log("For an already-merged release, verify production with:");
  console.log("  RELEASE_BASE_URL=https://bookflow-green.vercel.app EXPECTED_COMMIT=<merged-sha> node scripts/release-smoke.mjs");
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
console.log("  2. node scripts/run-project-checks.mjs");
console.log("  3. npm run typecheck, or run the local TypeScript binary from an npm-created node_modules");
console.log("  4. npm run lint, or run the local ESLint binary from an npm-created node_modules");
console.log("  5. npm run build, or run the local Next.js binary from an npm-created node_modules");
console.log("  6. Commit the release and handoff files, then run node scripts/release-preflight.mjs");

if (touchedWorkflows.length || touchedProtected.length) {
  console.log("  7. node scripts/check-workflows.mjs");
}

if (touchedMigrations.length) {
  console.log("\nDatabase release gates:");
  console.log("  - Staging Migration must pass before production approval.");
  console.log("  - Production Migration requires explicit approval.");
  console.log("  - Verify the migrated behavior, not only the web deploy.");
}

console.log("\nProduction proof after merge:");
console.log("  1. Use node scripts/release-pr-status.mjs <pr> --wait to stop when release gates pass.");
console.log("  2. Merge remotely in multi-worktree setups; do not depend on checking out local main.");
console.log("  3. Get the merged SHA with gh pr view <pr> --json mergeCommit or the GitHub API.");
console.log("  4. Poll https://bookflow-green.vercel.app/api/health/release until commit matches the merged SHA.");
console.log("  5. RELEASE_BASE_URL=https://bookflow-green.vercel.app EXPECTED_COMMIT=<merged-sha> node scripts/release-smoke.mjs");
console.log("  Avoid repeated Vercel or GitHub dashboard reloads unless a direct status check fails.");

console.log("\nSuggested next step:");
if (touchedProtected.length) {
  console.log("  Stop and get explicit recovery-system approval before continuing.");
} else if (status.length && !changedFiles.includes("AI_HANDOFF.md")) {
  console.log("  If these are release changes, run node scripts/ai-collaboration.mjs draft <title> and update the handoff trio before committing.");
} else if (report.packageManagerLocks.includes("package-lock.json") && !report.npmOnPath) {
  console.log("  Use the bundled Node runtime for scripts and preserve package-lock.json; do not add pnpm/packageManager as a release workaround.");
} else {
  console.log("  Finish local checks, commit, run node scripts/release-preflight.mjs, then use node scripts/release-pr-status.mjs <pr> --wait after opening the PR.");
}
