#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const options = {
  wait: false,
  intervalSeconds: 25,
  timeoutSeconds: 600,
};
const prArgs = [];
const RELEASE_GATE_PATTERNS = [
  /AI 交接完整性/i,
  /Release Readiness/i,
  /Quality and build/i,
  /Workflow syntax/i,
  /Staging Migration/i,
  /Vercel/i,
];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--wait") {
    options.wait = true;
  } else if (arg === "--interval") {
    options.intervalSeconds = Number(args[++index]);
  } else if (arg === "--timeout") {
    options.timeoutSeconds = Number(args[++index]);
  } else {
    prArgs.push(arg);
  }
}

if (
  !Number.isInteger(options.intervalSeconds) ||
  options.intervalSeconds < 5 ||
  !Number.isInteger(options.timeoutSeconds) ||
  options.timeoutSeconds < options.intervalSeconds
) {
  console.error("Usage: node scripts/release-pr-status.mjs [pr] [--wait] [--interval seconds] [--timeout seconds]");
  process.exit(1);
}

function gh(argsForGh, { allowPending = false } = {}) {
  const result = spawnSync("gh", argsForGh, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && !(allowPending && result.status === 8)) {
    const stderr = result.stderr.trim();
    throw new Error(stderr || `gh ${argsForGh.join(" ")} failed with exit ${result.status}`);
  }
  return result.stdout.trim();
}

function readChecks(required) {
  const json = gh(
    [
      "pr",
      "checks",
      ...prArgs,
      ...(required ? ["--required"] : []),
      "--json",
      "name,bucket,state,workflow,startedAt,completedAt,link",
    ],
    { allowPending: true },
  );
  return JSON.parse(json || "[]");
}

function compactCheck(check) {
  const label = check.workflow && check.workflow !== check.name
    ? `${check.workflow} / ${check.name}`
    : check.name;
  return `${check.bucket}: ${label}`;
}

function partition(checks) {
  return {
    passed: checks.filter((check) => check.bucket === "pass" || check.bucket === "skipping"),
    pending: checks.filter((check) => check.bucket === "pending"),
    failed: checks.filter((check) => ["fail", "cancel"].includes(check.bucket)),
  };
}

function optionalChecks(allChecks, requiredChecks) {
  const requiredKeys = new Set(requiredChecks.map((check) => `${check.workflow}\u0000${check.name}`));
  return allChecks.filter((check) => !requiredKeys.has(`${check.workflow}\u0000${check.name}`));
}

function isReleaseGate(check) {
  const label = `${check.workflow || ""} ${check.name || ""}`;
  return RELEASE_GATE_PATTERNS.some((pattern) => pattern.test(label));
}

function mergeReleaseGates(requiredChecks, allChecks) {
  const gates = new Map();
  for (const check of [...requiredChecks, ...allChecks.filter(isReleaseGate)]) {
    gates.set(`${check.workflow}\u0000${check.name}`, check);
  }
  return [...gates.values()];
}

function printStatus(gateChecks, requiredChecks, allChecks) {
  const gates = partition(gateChecks);
  const optional = partition(optionalChecks(allChecks, gateChecks));

  console.log("BookFlow PR release status");
  console.log(`Release gates: ${gates.passed.length}/${gateChecks.length} passed`);
  console.log(`GitHub required checks included: ${requiredChecks.length}`);
  for (const check of gateChecks) console.log(`  ${compactCheck(check)}`);

  if (gates.failed.length) {
    console.log("\nBlocking failures:");
    for (const check of gates.failed) console.log(`  ${compactCheck(check)}`);
  }

  if (optional.pending.length) {
    const optionalNames = optional.pending.map(compactCheck).join("; ");
    console.log(`\nOptional checks still pending; not blocking merge: ${optionalNames}`);
  }
}

function getStatus() {
  const requiredChecks = readChecks(true);
  const allChecks = readChecks(false);
  const gateChecks = mergeReleaseGates(requiredChecks, allChecks);
  return { requiredChecks, allChecks, gateChecks, gates: partition(gateChecks) };
}

const started = Date.now();

while (true) {
  const status = getStatus();
  printStatus(status.gateChecks, status.requiredChecks, status.allChecks);

  if (!status.gateChecks.length) {
    console.error("\nNo release gates were reported by GitHub. Verify branch protection before merging.");
    process.exit(1);
  }

  if (status.gates.failed.length) process.exit(1);
  if (!status.gates.pending.length) {
    console.log("\nRelease gates passed. Merge can proceed without waiting for optional review bots.");
    process.exit(0);
  }

  if (!options.wait) {
    console.log("\nRelease gates are still pending.");
    process.exit(8);
  }

  const elapsedSeconds = Math.floor((Date.now() - started) / 1000);
  if (elapsedSeconds >= options.timeoutSeconds) {
    console.error(`\nTimed out after ${elapsedSeconds}s while waiting for release gates.`);
    process.exit(8);
  }

  console.log(`\nWaiting ${options.intervalSeconds}s before the next compact status check...`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, options.intervalSeconds * 1000);
}
