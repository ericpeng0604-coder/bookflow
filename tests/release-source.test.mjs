import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createSourceManifest, fingerprintParts, shouldFingerprintPath } from "../scripts/release-source.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("source fingerprint excludes generated and secret paths", () => {
  assert.equal(shouldFingerprintPath("src/app.ts"), true);
  assert.equal(shouldFingerprintPath(".next/server.js"), false);
  assert.equal(shouldFingerprintPath(".env.local"), false);
  assert.equal(shouldFingerprintPath("node_modules/pkg/index.js"), false);
});

test("source fingerprint changes for dirty tracked and untracked source", () => {
  const cwd = mkdtempSync(join(tmpdir(), "bookflow-source-test-"));
  git(cwd, "init", "-b", "main");
  git(cwd, "config", "user.name", "BookFlow Test");
  git(cwd, "config", "user.email", "test@example.invalid");
  writeFileSync(join(cwd, "page.ts"), "export const page = 1;\n");
  git(cwd, "add", "page.ts");
  git(cwd, "commit", "-m", "initial");
  const clean = createSourceManifest(cwd);
  writeFileSync(join(cwd, "page.ts"), "export const page = 2;\n");
  mkdirSync(join(cwd, "app"));
  writeFileSync(join(cwd, "app", "new.ts"), "export const newer = true;\n");
  const dirty = createSourceManifest(cwd);
  assert.equal(clean.dirty, false);
  assert.equal(dirty.dirty, true);
  assert.notEqual(clean.fingerprint, dirty.fingerprint);
});

test("fingerprint is deterministic for the same ordered parts", () => {
  const first = fingerprintParts([{ name: "a", value: "1" }, { name: "b", value: "2" }]);
  const second = fingerprintParts([{ name: "a", value: "1" }, { name: "b", value: "2" }]);
  assert.equal(first, second);
  assert.notEqual(first, fingerprintParts([{ name: "b", value: "2" }, { name: "a", value: "1" }]));
});
