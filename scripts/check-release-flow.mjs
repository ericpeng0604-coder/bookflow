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

console.log("Release flow checks passed.");
