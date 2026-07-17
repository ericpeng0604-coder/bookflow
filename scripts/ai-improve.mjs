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
    terms: ["token", "slow", "waste", "repeat", "manual", "friction", "memory", "consistency"],
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
function changedFiles() {
  return git(["status", "--short"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function score(category, problem) {
  const lower = problem.toLowerCase();
  return category.terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
}

const problem = process.argv.slice(2).join(" ").trim();
if (!problem) {
  console.log("Usage: node scripts/ai-improve.mjs \"short problem description\"");
  process.exitCode = 1;
} else {
  const files = changedFiles();
  const best = categories
    .map((category) => ({ ...category, score: score(category, problem) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))[0];
  const selected = best.score > 0 ? best : {
    name: "general repeated issue",
    action: "Fix the immediate issue, identify the root cause, then add the smallest durable prevention.",
    evidence: "Run the smallest check that proves the prevention works.",
  };

  console.log("BookFlow self-improvement brief");
  console.log(`Problem: ${problem}`);
  console.log(`Likely category: ${selected.name}`);
  console.log("");
  console.log("Required loop:");
  console.log("  1. Fix or unblock the immediate issue.");
  console.log("  2. Identify the root cause and early detection signal.");
  console.log("  3. Add the smallest durable prevention.");
  console.log("  4. Verify it with focused evidence.");
  console.log("  5. Report any remaining unverified gap.");
  console.log("");
  console.log(`Recommended action: ${selected.action}`);
  console.log(`Recommended evidence: ${selected.evidence}`);
  console.log("");
  console.log("Useful entry points:");
  console.log("  node scripts/check-memory.mjs");
  console.log("  node scripts/ai-lookup.mjs --audit --limit 10");
  console.log("  node scripts/release-plan.mjs");
  console.log("");
  console.log(`Working tree entries: ${files.length || "clean"}`);
  for (const file of files.slice(0, 12)) console.log(`  ${file}`);
  if (files.length > 12) console.log(`  ... ${files.length - 12} more`);
}
