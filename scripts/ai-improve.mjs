#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

const categories = [
  {
    name: "escaped product bug",
    terms: ["bug", "regression", "ui", "wrong", "broken", "defect"],
    action: "Fix the behavior and add or update the narrowest regression check that would have caught it.",
    evidence: "Run the focused check plus typecheck/build when the changed path affects shared UI or runtime behavior.",
  },
  {
    name: "workflow or token waste",
    terms: ["token", "slow", "waste", "repeat", "manual", "friction"],
    action: "Turn the lesson into a low-output helper, stop rule, script, or AI_WORK_MANUAL entry.",
    evidence: "Show the new helper or rule working with a small command output, not a broad log dump.",
  },
  {
    name: "release or deployment mistake",
    terms: ["deploy", "release", "production", "merge", "smoke", "migration"],
    action: "Harden release-plan, preflight, smoke, handoff, or workflow checks so the same mistake stops earlier.",
    evidence: "Run release preflight or the smallest release-specific check that covers the failure mode.",
  },
  {
    name: "secret or sensitive detail exposure",
    terms: ["secret", "password", "token", "credential", "account", "private", "personal"],
    action: "Redact the output path, add a safe abstraction rule, and avoid quoting exact sensitive values.",
    evidence: "Run the audit or lookup command and confirm sensitive candidates are redacted.",
  },
  {
    name: "encoding or text corruption",
    terms: ["encoding", "mojibake", "garbled", "unicode", "chinese", "text"],
    action: "Repair the corrupted file and add or use an encoding-safe check before trusting the result.",
    evidence: "Run syntax/readability checks and any repo checker that rejects mojibake markers.",
  },
];

function parseArgs(argv) {
  const problem = argv.join(" ").trim();
  return { problem };
}

function git(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return "";
  }
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function scoreCategory(category, problem) {
  const lower = problem.toLowerCase();
  return category.terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function changedFiles() {
  return lines(git(["status", "--short"])).map((line) => line.slice(3));
}

function printUsage() {
  console.log("BookFlow self-improvement helper");
  console.log("");
  console.log("Usage:");
  console.log("  pnpm run ai:improve -- \"short problem description\"");
  console.log("  pnpm run ai:improve:codex -- \"token-heavy memory audit\"");
}

function main() {
  const { problem } = parseArgs(process.argv.slice(2));
  if (!problem) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const files = changedFiles();
  const ranked = categories
    .map((category) => ({ ...category, score: scoreCategory(category, problem) }))
    .filter((category) => category.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const best = ranked[0] || {
    name: "general repeated issue",
    action: "Fix the immediate issue, identify the root cause, then choose the smallest durable guard that prevents recurrence.",
    evidence: "Run the smallest check that proves the guard works and report any unverified gap.",
  };

  console.log("BookFlow self-improvement brief");
  console.log(`Problem: ${problem}`);
  console.log(`Likely category: ${best.name}`);
  console.log("");
  console.log("Required loop:");
  console.log("  1. Fix or unblock the immediate issue.");
  console.log("  2. Identify the concrete root cause and early detection signal.");
  console.log("  3. Add the smallest durable prevention: script, check, lesson, doc rule, redaction, or test.");
  console.log("  4. Verify the prevention with focused evidence.");
  console.log("  5. Report what changed and what remains unverified.");
  console.log("");
  console.log("Recommended durable action:");
  console.log(`  ${best.action}`);
  console.log("");
  console.log("Recommended evidence:");
  console.log(`  ${best.evidence}`);
  console.log("");
  console.log("Useful low-token entry points:");
  console.log("  pnpm run ai:lookup:codex -- --audit --limit 10");
  console.log("  pnpm run ai:budget:codex");
  console.log("  pnpm run release:plan:codex");
  console.log("");
  console.log(`Working tree entries: ${files.length || "clean"}`);
  if (files.length) {
    for (const file of files.slice(0, 12)) console.log(`  ${file}`);
    if (files.length > 12) console.log(`  ... ${files.length - 12} more`);
  }
  console.log("");
  console.log("Do not wait for the user to ask for this loop when a real mistake, repeated blocker, or escaped defect is found.");
}

main();
