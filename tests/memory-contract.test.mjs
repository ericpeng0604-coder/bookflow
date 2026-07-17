import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateMemoryContract } from "../scripts/lib/memory-contract.mjs";

const baseCommit = "1".repeat(40);
const historyFile = ".ai/history/20260717-memory-contract.md";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "bookflow-memory-contract-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, ".ai", "history"), { recursive: true });
  writeFileSync(join(root, "scripts", "check.mjs"), "", "utf8");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { check: "node scripts/check.mjs" },
  }), "utf8");
  writeFileSync(join(root, "AI_WORK_MANUAL.md"), [
    "### LESSON-001: First",
    "### LESSON-002: Second",
  ].join("\n"), "utf8");
  writeFileSync(join(root, ".ai", "state.json"), JSON.stringify({
    taskId: "20260717-memory-contract",
    taskTitle: "harden memory contract",
    baseCommit,
    handoffFile: "AI_HANDOFF.md",
    historyFile,
  }), "utf8");
  writeFileSync(join(root, historyFile), "# Evidence\n", "utf8");
  writeFileSync(join(root, "AI_HANDOFF.md"), [
    "# BookFlow AI Handoff",
    "",
    "## 目前狀態與背景",
    "",
    "- Task ID: `20260717-memory-contract`.",
    "- Task: `harden memory contract`.",
    "- Branch: `codex/test`.",
    `- Base commit: \`${baseCommit}\`.`,
    `- History: \`${historyFile}\`.`,
  ].join("\n"), "utf8");
  return root;
}

test("accepts aligned project memory and executable package script targets", (t) => {
  const root = fixture(t);
  const result = validateMemoryContract(root, { checkGit: false });
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.lessonCount, 2);
  assert.equal(result.stats.checkedScriptTargetCount, 1);
});
test("rejects duplicate lesson IDs and dangling package script targets", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, "AI_WORK_MANUAL.md"), [
    "### LESSON-001: First",
    "### LESSON-001: Duplicate",
  ].join("\n"), "utf8");
  writeFileSync(join(root, "package.json"), JSON.stringify({
    scripts: { check: "node scripts/missing.mjs" },
  }), "utf8");

  const result = validateMemoryContract(root, { checkGit: false });
  assert.ok(result.errors.some((error) => error.includes("missing scripts/missing.mjs")));
  assert.ok(result.errors.some((error) => error.includes("duplicate LESSON-001")));
});

test("rejects unreadable project memory text", (t) => {
  const root = fixture(t);
  const replacementCharacter = String.fromCharCode(0xfffd);
  writeFileSync(
    join(root, "AI_WORK_MANUAL.md"),
    `### LESSON-001: Broken ${replacementCharacter} text\n`,
    "utf8",
  );
  const result = validateMemoryContract(root, { checkGit: false });
  assert.ok(result.errors.some((error) => error.includes("mojibake")));
});

test("rejects stale handoff metadata and history references", (t) => {
  const root = fixture(t);
  const handoffPath = join(root, "AI_HANDOFF.md");
  const handoff = [
    "# BookFlow AI Handoff",
    "",
    "## 目前狀態與背景",
    "",
    "- Task ID: `old-task`.",
    "- Task: `old task`.",
    "- Branch: `codex/test`.",
    `- Base commit: \`${"2".repeat(40)}\`.`,
    "- History: `.ai/history/old.md`.",
  ].join("\n");
  writeFileSync(handoffPath, handoff, "utf8");

  const result = validateMemoryContract(root, { checkGit: false });
  assert.ok(result.errors.some((error) => error.includes("Task ID does not match")));
  assert.ok(result.errors.some((error) => error.includes("Task does not match")));
  assert.ok(result.errors.some((error) => error.includes("Base commit does not match")));
  assert.ok(result.errors.some((error) => error.includes("History does not match")));
  assert.ok(result.errors.some((error) => error.includes("stale history file")));
});
