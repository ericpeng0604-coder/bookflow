#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { selectRollbackTarget } from "./rollback-target.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const readiness = read(".github/workflows/release-readiness.yml");
const staging = read(".github/workflows/staging-migration.yml");
const productionMigration = read(".github/workflows/production-migration.yml");
const productionMonitor = read(".github/workflows/production-deployment-monitor.yml");
const rollback = read(".github/workflows/rollback-production.yml");
const guard = read(".github/workflows/protect-rollback-workflow.yml");
const codeowners = read(".github/CODEOWNERS");

assert.match(readiness, /name:\s*Release Readiness/);
assert.match(readiness, /npm ci/);
assert.match(readiness, /npm run check:all/);
assert.match(readiness, /ai-collaboration\.mjs check-ci/);
assert.match(readiness, /rhysd\/actionlint/);
assert.match(staging, /name:\s*Staging Migration/);
assert.match(staging, /environment:\s*staging/);
assert.match(staging, /STAGING_DATABASE_URL/);
assert.match(staging, /npm run staging:check/);
assert.match(productionMigration, /environment:\s*production-database/);
assert.match(productionMigration, /PRODUCTION_DATABASE_URL/);
assert.match(productionMigration, /APPLY-PRODUCTION-MIGRATIONS/);
assert.match(productionMonitor, /node scripts\/release-smoke\.mjs/);
assert.doesNotMatch(
  productionMonitor,
  /npm ci/,
  "production smoke must stay dependency-free unless release-smoke imports packages",
);
assert.match(productionMonitor, /deployment_status/);
assert.match(rollback, /select-rollback-target\.mjs origin\/main/);
assert.match(rollback, /npm run check:all/);
assert.match(rollback, /git restore --source=HEAD --staged --worktree/);
assert.match(guard, /git log --format=%B "\$BEFORE_SHA\.\.\$PUSHED_SHA"/);

for (const file of [
  ".github/workflows/rollback-production.yml",
  ".github/workflows/protect-rollback-workflow.yml",
  ".github/CODEOWNERS",
]) {
  assert.ok(guard.includes(`"${file}"`), `guard must restore ${file}`);
  assert.ok(codeowners.includes(`/${file}`), `CODEOWNERS must protect ${file}`);
}

const releases = [
  { sha: "rollback-2", subject: "Rollback", ignore: true },
  { sha: "recovery-change", subject: "Recovery maintenance", ignore: true },
  { sha: "release-2", subject: "Release 2", ignore: false },
  { sha: "rollback-1", subject: "Rollback", ignore: true },
  { sha: "release-1", subject: "Release 1", ignore: false },
  { sha: "release-0", subject: "Release 0", ignore: false },
];
assert.equal(
  selectRollbackTarget(releases, new Set(["release-2"])).sha,
  "release-1",
  "a second rollback must select the previous first-parent release",
);
assert.equal(
  selectRollbackTarget(releases, new Set(["release-2", "release-1"])).sha,
  "release-0",
  "a third rollback must continue along first-parent history",
);

const tempRepo = mkdtempSync(join(tmpdir(), "bookflow-workflow-check-"));
const tempGit = (...args) =>
  execFileSync("git", args, { cwd: tempRepo, encoding: "utf8" }).trim();
try {
  tempGit("init", "-b", "main");
  tempGit("config", "user.name", "Workflow Test");
  tempGit("config", "user.email", "workflow@example.invalid");
  mkdirSync(join(tempRepo, ".github", "workflows"), { recursive: true });
  const protectedFiles = [
    ".github/workflows/rollback-production.yml",
    ".github/workflows/protect-rollback-workflow.yml",
    ".github/CODEOWNERS",
  ];
  for (const file of protectedFiles) {
    writeFileSync(join(tempRepo, file), `baseline:${file}\n`);
  }
  tempGit("add", ".");
  tempGit("commit", "-m", "Baseline");
  const baseline = tempGit("rev-parse", "HEAD");

  for (const file of protectedFiles) {
    writeFileSync(join(tempRepo, file), `unauthorized:${file}\n`);
  }
  tempGit("add", ".");
  tempGit("commit", "-m", "Unauthorized recovery edit");
  tempGit("checkout", baseline, "--", ...protectedFiles);

  for (const file of protectedFiles) {
    assert.equal(
      readFileSync(join(tempRepo, file), "utf8").replaceAll("\r\n", "\n"),
      `baseline:${file}\n`,
      `recovery guard must restore ${file}`,
    );
  }
} finally {
  rmSync(tempRepo, { recursive: true, force: true });
}

console.log("Workflow structure and rollback selection checks passed.");
