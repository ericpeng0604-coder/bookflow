#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const valueOptions = new Set(["--interval", "--timeout"]);

function usage(exitCode = 0) {
  console.log("BookFlow PR check watcher (low-output)");
  console.log("");
  console.log("Usage:");
  console.log("  node scripts/release-watch-pr.mjs <pr-number-or-url> [--interval 15] [--timeout 900] [--once]");
  console.log("");
  console.log("Avoid `gh pr checks --watch`; it repeatedly prints the full table.");
  process.exit(exitCode);
}

function readOption(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usage(1);
  return value;
}

if (args.includes("--help") || args.includes("-h")) usage(0);

const positional = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (valueOptions.has(arg)) {
    index += 1;
    continue;
  }
  if (!arg.startsWith("--")) positional.push(arg);
}

const prRef = positional[0];
const intervalSeconds = Number(readOption("--interval", process.env.PR_WATCH_INTERVAL_SECONDS || "15"));
const timeoutSeconds = Number(readOption("--timeout", process.env.PR_WATCH_TIMEOUT_SECONDS || "900"));
const once = args.includes("--once");

if (!prRef || !Number.isFinite(intervalSeconds) || intervalSeconds < 5 ||
  !Number.isFinite(timeoutSeconds) || timeoutSeconds < 30) {
  usage(1);
}

const terminalFailure = new Set([
  "FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE",
]);
const pendingStatuses = new Set([
  "PENDING", "QUEUED", "IN_PROGRESS", "REQUESTED", "WAITING",
]);

function ghJson() {
  return JSON.parse(execFileSync("gh", [
    "pr", "view", prRef, "--json",
    "number,title,isDraft,mergeStateStatus,mergeable,statusCheckRollup,url",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
}

function normalizeCheck(item) {
  if (item.__typename === "StatusContext") {
    const state = String(item.state || "UNKNOWN").toUpperCase();
    return {
      name: item.context || "status",
      workflow: "",
      status: state === "SUCCESS" || state === "FAILURE" || state === "ERROR"
        ? "COMPLETED"
        : state,
      conclusion: state === "ERROR" ? "FAILURE" : state,
      url: item.targetUrl || "",
    };
  }
  return {
    name: item.name || "check",
    workflow: item.workflowName || "",
    status: String(item.status || "UNKNOWN").toUpperCase(),
    conclusion: String(item.conclusion || "").toUpperCase(),
    url: item.detailsUrl || "",
  };
}

function checkState(check) {
  if (check.status !== "COMPLETED" && pendingStatuses.has(check.status)) return "pending";
  if (terminalFailure.has(check.conclusion)) return "failed";
  if (check.conclusion === "FAILURE" || check.conclusion === "ERROR") return "failed";
  if (["SUCCESS", "NEUTRAL", "SKIPPED"].includes(check.conclusion)) return "passed";
  if (check.status === "COMPLETED" && !check.conclusion) return "passed";
  return "pending";
}

function summarize(pr) {
  const groups = { passed: [], pending: [], failed: [] };
  for (const check of (pr.statusCheckRollup || []).map(normalizeCheck)) {
    groups[checkState(check)].push(check);
  }
  return groups;
}

function signature(pr, groups) {
  return [
    pr.isDraft ? "draft" : "ready",
    pr.mergeStateStatus || "unknown",
    `pass=${groups.passed.length}`,
    `pending=${groups.pending.length}`,
    `fail=${groups.failed.length}`,
    groups.pending.map((item) => item.name).sort().join(","),
    groups.failed.map((item) => `${item.name}:${item.conclusion || item.status}`).sort().join(","),
  ].join("|");
}

function printSummary(pr, groups, final = false) {
  console.log(
    `${final ? "Final" : "Status"}: PR #${pr.number} ${pr.isDraft ? "draft" : "ready"}; ` +
    `merge=${pr.mergeStateStatus || "unknown"}; pass=${groups.passed.length}; ` +
    `pending=${groups.pending.length}; fail=${groups.failed.length}`,
  );
  if (groups.pending.length) {
    console.log(`Pending: ${groups.pending.map((item) => item.name).sort().join(", ")}`);
  }
  if (groups.failed.length) {
    console.log("Failed:");
    for (const item of groups.failed) {
      console.log(
        `  ${item.name}${item.workflow ? ` (${item.workflow})` : ""}: ` +
        `${item.conclusion || item.status}${item.url ? ` ${item.url}` : ""}`,
      );
    }
  }
}

const started = Date.now();
let previousSignature = "";
while (true) {
  const pr = ghJson();
  const groups = summarize(pr);
  const currentSignature = signature(pr, groups);
  const done = groups.pending.length === 0;
  const failed = groups.failed.length > 0;
  if (currentSignature !== previousSignature || done || failed || once) {
    printSummary(pr, groups, done || failed || once);
    previousSignature = currentSignature;
  }
  if (failed) process.exit(1);
  if (done || once) process.exit(0);
  if ((Date.now() - started) / 1000 > timeoutSeconds) {
    console.error(`STOP: timed out after ${timeoutSeconds}s waiting for PR checks.`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
}
