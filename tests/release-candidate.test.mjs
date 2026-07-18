import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildRemoteGates,
  computeTreeFingerprint,
  isFreshReport,
  parsePorcelainFiles,
  protectedFiles,
  scanSensitiveFiles,
  scanUnreadableText,
} from "../scripts/lib/release-candidate.mjs";

test("parses changed files and ignores generated evidence", () => {
  assert.deepEqual(
    parsePorcelainFiles(" M app/page.tsx\n?? scripts/new.mjs\n?? .ai/artifacts/release-runs/x/report.json\n"),
    ["app/page.tsx", "scripts/new.mjs"],
  );
});

test("preserves the first porcelain status path when Git output starts with a space", () => {
  assert.deepEqual(parsePorcelainFiles(" M tests/first.test.mjs\n M tests/second.test.mjs\n"), [
    "tests/first.test.mjs",
    "tests/second.test.mjs",
  ]);
});

test("fingerprint changes when a tracked file changes", () => {
  const root = mkdtempSync(join(tmpdir(), "bookflow-release-"));
  const file = join(root, "page.tsx");
  writeFileSync(file, "export default 1;\n", "utf8");
  const first = computeTreeFingerprint(root, ["page.tsx"]);
  writeFileSync(file, "export default 2;\n", "utf8");
  const second = computeTreeFingerprint(root, ["page.tsx"]);
  assert.notEqual(first, second);
});

test("fresh reports require the same tree and changed-file set", () => {
  const snapshot = { treeFingerprint: "abc", changedFiles: ["a.ts", "b.ts"] };
  const report = { schemaVersion: 1, mode: "full", status: "passed", treeFingerprint: "abc", changedFiles: ["b.ts", "a.ts"] };
  assert.equal(isFreshReport(report, snapshot), true);
  assert.equal(isFreshReport({ ...report, treeFingerprint: "stale" }, snapshot), false);
  assert.equal(isFreshReport({ ...report, mode: "quick" }, snapshot), false);
});

test("detects protected files, secrets, and unreadable text", () => {
  const root = mkdtempSync(join(tmpdir(), "bookflow-release-"));
  writeFileSync(join(root, "config.ts"), ["const API", "_KEY = 'secret-value-123456';\n"].join(""), "utf8");
  writeFileSync(join(root, "notes.md"), "broken\uFFFDtext\n", "utf8");
  assert.deepEqual(protectedFiles([".github/CODEOWNERS", "app/page.tsx"]), [".github/CODEOWNERS"]);
  assert.equal(scanSensitiveFiles(root, ["config.ts"])[0].reason, "API secret assignment");
  assert.equal(scanUnreadableText(root, ["notes.md"])[0].reason, "replacement or private-use character");
});

test("database candidates require staging while non-database candidates do not", () => {
  assert.equal(buildRemoteGates({ databaseChanges: true }).staging, "required");
  assert.equal(buildRemoteGates({ databaseChanges: false }).staging, "not_applicable");
});
