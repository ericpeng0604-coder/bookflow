#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  missingHandoffSections,
  REQUIRED_HANDOFF_SECTIONS,
  UNREADABLE_TEXT_PATTERN,
} from "./lib/handoff-contract.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

function runNode(args) {
  return execFileSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

for (const file of [
  "scripts/ai-collaboration.mjs",
  "scripts/lib/handoff-contract.mjs",
  "scripts/run-node.ps1",
  ".ai/templates/handoff.md",
]) {
  assert.doesNotMatch(read(file), UNREADABLE_TEXT_PATTERN, `${file} must be readable UTF-8`);
}

const template = read(".ai/templates/handoff.md");
assert.deepEqual(
  missingHandoffSections(template),
  [],
  "handoff template must include every required section",
);

const draft = runNode(["scripts/ai-collaboration.mjs", "draft", "release flow test"]);
assert.deepEqual(
  missingHandoffSections(draft),
  [],
  "handoff draft command must generate every required section",
);

for (const section of REQUIRED_HANDOFF_SECTIONS) {
  assert.match(
    read("scripts/ai-collaboration.mjs"),
    /missingHandoffSections/,
    "ai-collaboration must validate via the shared handoff contract",
  );
  assert.ok(template.includes(`## ${section}`), `template must include ${section}`);
}

const preflight = read("scripts/release-preflight.mjs");
assert.match(preflight, /check-ci/);
assert.match(preflight, /release scope is mixed/);
assert.match(preflight, /AI_HANDOFF\.md, \.ai\/state\.json, and a new \.ai\/history entry/);
assert.match(preflight, /origin\/main/);
assert.match(preflight, /--allow-dirty/);
assert.match(preflight, /working tree must be clean/);
const releaseScope = read("scripts/lib/release-scope.mjs");
assert.match(releaseScope, /isReleaseInfrastructure/);
assert.match(releaseScope, /replace\(\/\\r\?\\n\+\$\//);

const prStatus = read("scripts/release-pr-status.mjs");
assert.match(prStatus, /--required/);
assert.match(prStatus, /RELEASE_GATE_PATTERNS/);
assert.match(prStatus, /Quality and build/);
assert.match(prStatus, /Optional checks still pending; not blocking merge/);
assert.match(prStatus, /Release gates passed/);

const plan = read("scripts/release-plan.mjs");
assert.match(plan, /Changed areas:/);
assert.match(plan, /Minimum local evidence before PR:/);
assert.match(plan, /check:workflows/);
assert.match(plan, /release:watch-pr/);
assert.match(plan, /\/api\/health\/release/);
assert.match(plan, /release:smoke/);
const packageScripts = JSON.parse(read("package.json")).scripts;
assert.match(packageScripts["release:local"], /release-candidate\.mjs local/);
assert.match(packageScripts["release:local:quick"], /release-candidate\.mjs local --quick/);
assert.match(packageScripts["release:prepare"], /release-candidate\.mjs prepare/);
assert.match(packageScripts["release:watch"], /release-watch\.mjs/);
assert.match(read("scripts/release-candidate.mjs"), /treeFingerprint/);
assert.match(read("scripts/release-candidate.mjs"), /remoteGates/);
assert.match(read("scripts/release-watch.mjs"), /release-smoke\.mjs/);
assert.match(packageScripts["release:watch-pr"], /release-pr-status\.mjs --wait/);
assert.match(packageScripts["release:watch-pr:codex"], /release-pr-status\.mjs --wait/);
assert.ok(read("scripts/release-pr-status.mjs"), "release PR status helper must exist");
const cleanup = read("scripts/release-cleanup.mjs");
assert.match(packageScripts["release:cleanup"], /release-cleanup\.mjs/);
assert.match(cleanup, /--apply/);
assert.match(cleanup, /worktree.*remove/);
assert.doesNotMatch(cleanup, /git clean/);
assert.doesNotMatch(cleanup, /reset --hard/);
assert.match(plan, /npm run/);
assert.doesNotMatch(plan, /pnpm run/);
const stagingCheck = read("scripts/check-staging.mjs");
assert.match(stagingCheck, /expectedStatuses/);
assert.match(stagingCheck, /response\.status/);
assert.match(stagingCheck, /invalid JSON/);
const productionMigration = read(".github/workflows/production-migration.yml");
assert.match(productionMigration, /staging_run_id/);
assert.match(productionMigration, /Staging Migration/);
assert.match(productionMigration, /full lowercase commit SHA/);
const uptime = read(".github/workflows/production-uptime-smoke.yml");
assert.match(uptime, /EXPECTED_COMMIT/);
assert.match(uptime, /FETCH_HEAD/);
const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.packageManager ?? null, null, "package.json must use the npm lockfile without a pnpm package-manager declaration");
assert.match(read("scripts/run-node.ps1"), /node\.exe/);

const doctorOutput = runNode(["scripts/release-doctor.mjs"]);
assert.match(doctorOutput, /Release environment:/);
assert.match(doctorOutput, /lockfiles:/);

const budgetScript = read("scripts/context-budget.mjs");
assert.match(budgetScript, /BookFlow context budget/);
assert.match(budgetScript, /Deploy stop rule:/);
assert.match(budgetScript, /Environment stop rule:/);

const budgetOutput = runNode(["scripts/context-budget.mjs"]);
assert.match(budgetOutput, /BookFlow context budget/);

const workflow = read("docs/RELEASE_WORKFLOW.md");
assert.match(workflow, /ai:budget/);
assert.match(workflow, /check:release-scope/);
assert.match(workflow, /release:watch-pr/);
assert.match(workflow, /clean worktree/);
assert.match(workflow, /gh pr checks --watch/);
assert.match(workflow, /api\/health\/release/);
assert.match(workflow, /Monitoring and backup expectations/);
assert.match(workflow, /Manual production release/);
assert.match(workflow, /check:local-source/);
assert.match(read("package.json"), /release-source\.mjs/);
assert.match(read("package.json"), /check-release-dashboard\.mjs/);
assert.match(read(".github/workflows/release-production.yml"), /release_sha/);
assert.match(read("scripts/release-plan.mjs"), /Release Production/);
assert.match(read("app/release/release-dashboard.tsx"), /開始本機檢查/);

console.log("Release flow checks passed.");
