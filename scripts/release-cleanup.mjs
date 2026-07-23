#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || null : null;
};
const baseRef = valueOf("--base-ref") || process.env.RELEASE_BASE_REF || "origin/main";
const releaseSha = valueOf("--release-sha") || process.env.EXPECTED_COMMIT || null;
const apply = args.includes("--apply");

function git(gitArgs, cwd = process.cwd()) {
  return execFileSync("git", gitArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).replace(/\n+$/, "");
}

function isAncestor(commit, ref) {
  try { git(["merge-base", "--is-ancestor", commit, ref]); return true; }
  catch { return false; }
}

function fail(message) {
  console.error("STOP: " + message);
  process.exit(1);
}

function parseWorktrees(output) {
  const entries = [];
  let current = null;
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("worktree ")) {
      if (current) entries.push(current);
      current = { path: line.slice(9), branch: null };
    } else if (current && line.startsWith("branch ")) {
      current.branch = line.slice(7).replace("refs/heads/", "");
    }
  }
  if (current) entries.push(current);
  return entries;
}

if (!releaseSha || !/^[0-9a-f]{40}$/i.test(releaseSha)) {
  fail("provide --release-sha=<full-sha> or EXPECTED_COMMIT before cleanup.");
}
const repoRoot = resolve(git(["rev-parse", "--show-toplevel"]));
const currentBranch = git(["branch", "--show-current"]) || "(detached)";
if (git(["status", "--porcelain=v1"])) {
  fail("current worktree is dirty. Run cleanup from a clean release worktree; unrelated dirty edits are protected.");
}
if (!isAncestor(releaseSha, baseRef)) {
  fail("release SHA " + releaseSha + " is not merged into " + baseRef + "; cleanup is not authorized.");
}

const candidates = [];
for (const worktree of parseWorktrees(git(["worktree", "list", "--porcelain"]))) {
  const path = resolve(worktree.path);
  const branch = worktree.branch;
  if (!branch || path === repoRoot || branch === currentBranch || ["main", "master"].includes(branch)) continue;
  if (!(branch.startsWith("agent/") || branch.startsWith("codex/"))) continue;
  if (!existsSync(path)) continue;
  let status = "";
  try { status = git(["status", "--porcelain=v1"], path); } catch { continue; }
  if (status || !isAncestor(branch, baseRef)) continue;
  candidates.push({ branch, path });
}

console.log("BookFlow post-release cleanup");
console.log("Release SHA: " + releaseSha);
console.log("Base ref: " + baseRef);
console.log("Current worktree: " + repoRoot);
console.log("Mode: " + (apply ? "apply" : "plan-only"));
console.log("Candidates: " + candidates.length);
for (const candidate of candidates) console.log("  " + candidate.branch + " -> " + candidate.path);
if (!candidates.length) { console.log("No safe merged clean worktrees to remove."); process.exit(0); }
if (!apply) { console.log("Plan only. Re-run with --apply after reviewing the exact candidates."); process.exit(0); }
for (const candidate of candidates) {
  execFileSync("git", ["worktree", "remove", candidate.path], { cwd: repoRoot, stdio: "inherit" });
  execFileSync("git", ["branch", "-d", candidate.branch], { cwd: repoRoot, stdio: "inherit" });
}
console.log("Cleanup applied. Release evidence and unrelated dirty checkouts were not modified.");
