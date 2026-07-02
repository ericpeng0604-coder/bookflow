#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

const baseRef = process.env.RELEASE_BASE_REF || "origin/main";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  }).trim();
}

function runNode(args) {
  return execFileSync(process.execPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function fail(message) {
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
}

function isSubstantive(file) {
  return !(
    file === "AI_HANDOFF.md"
    || file === ".ai/state.json"
    || file.startsWith(".ai/history/")
  );
}

function assertRefExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", ref]);
  } catch {
    fail(`${ref} is unavailable. Run git fetch origin main first.`);
    return false;
  }
  return true;
}

console.log("BookFlow release preflight");
console.log(`Base ref: ${baseRef}`);

if (!assertRefExists(baseRef)) process.exit(process.exitCode ?? 1);

const branch = git(["branch", "--show-current"]) || "(detached)";
const head = git(["rev-parse", "HEAD"]);
const status = lines(git(["status", "--porcelain=v1"]));
const changedInPr = lines(git(["diff", "--name-only", `${baseRef}...HEAD`]));
const cherry = lines(git(["cherry", "-v", baseRef, "HEAD"]));
const alreadyApplied = cherry.filter((line) => line.startsWith("- "));
const unapplied = cherry.filter((line) => line.startsWith("+ "));
const substantive = changedInPr.filter(isSubstantive);

console.log(`Branch: ${branch}`);
console.log(`HEAD: ${head}`);
console.log(`Working tree: ${status.length ? `${status.length} uncommitted/untracked entries` : "clean"}`);
console.log(`PR files vs ${baseRef}: ${changedInPr.length}`);
console.log(`Unapplied commits: ${unapplied.length}`);
console.log(`Already-applied commits: ${alreadyApplied.length}`);

if (alreadyApplied.length && unapplied.length) {
  fail(
    "this branch mixes commits already applied to main with new commits. Create a clean branch from origin/main and cherry-pick only the unapplied commit(s).",
  );
  console.log("\nAlready-applied commits:");
  for (const entry of alreadyApplied) console.log(`  ${entry}`);
  console.log("\nUnapplied commits:");
  for (const entry of unapplied) console.log(`  ${entry}`);
}

if (status.length) {
  console.log("\nUncommitted or untracked entries are present:");
  for (const entry of status) console.log(`  ${entry.trim()}`);
  console.log("Keep unrelated files unstaged before committing or opening a PR.");
}

if (!changedInPr.length) {
  console.log("\nNo PR changes detected. Use release smoke for an already-merged deployment.");
  process.exit(process.exitCode ?? 0);
}

if (
  changedInPr.includes(".github/workflows/rollback-production.yml")
  || changedInPr.includes(".github/workflows/protect-rollback-workflow.yml")
  || changedInPr.includes(".github/CODEOWNERS")
) {
  fail("protected recovery files are changed. Continue only for an explicitly authorized recovery change.");
}

if (substantive.length) {
  const hasHandoff = changedInPr.includes("AI_HANDOFF.md");
  const hasState = changedInPr.includes(".ai/state.json");
  const hasHistory = changedInPr.some((file) => file.startsWith(".ai/history/"));
  if (!hasHandoff || !hasState || !hasHistory) {
    fail("substantive PR changes must include AI_HANDOFF.md, .ai/state.json, and a new .ai/history entry before opening or merging the PR.");
  } else {
    try {
      const output = runNode(["scripts/ai-collaboration.mjs", "check-ci", baseRef, "HEAD"]);
      if (output) console.log(output);
    } catch (error) {
      const stderr = error.stderr?.toString().trim();
      const stdout = error.stdout?.toString().trim();
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      fail("AI handoff check-ci failed locally.");
    }
  }
}

if (!process.exitCode) {
  console.log("\nRelease preflight passed.");
}
