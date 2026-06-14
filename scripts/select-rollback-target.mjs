#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import {
  readFirstParentCandidates,
  readPreviousTargets,
  selectRollbackTarget,
} from "./rollback-target.mjs";

const [ref = "origin/main"] = process.argv.slice(2);
const target = selectRollbackTarget(
  readFirstParentCandidates(ref),
  readPreviousTargets(ref),
);

if (!target) {
  console.error("No unreverted first-parent release is available.");
  process.exit(1);
}

const short = target.sha.slice(0, 7);
const output = [
  `target_sha=${target.sha}`,
  `target_short=${short}`,
  `target_subject=${target.subject}`,
].join("\n");

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`, "utf8");
}
console.log(output);
