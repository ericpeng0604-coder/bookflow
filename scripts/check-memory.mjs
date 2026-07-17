#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { validateMemoryContract } from "./lib/memory-contract.mjs";

function findGitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dirname(fileURLToPath(import.meta.url)),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    console.error("Memory contract check failed: not inside a Git repository.");
    process.exit(1);
  }
}

const result = validateMemoryContract(findGitRoot());
if (result.errors.length > 0) {
  console.error("Memory contract check failed:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Memory contract passed: ${result.stats.lessonCount} unique lessons, ` +
  `${result.stats.checkedScriptTargetCount} script targets, handoff/state aligned.`,
);
