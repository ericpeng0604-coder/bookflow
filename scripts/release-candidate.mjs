#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import {
  buildRemoteGates,
  collectChangedFiles,
  computeTreeFingerprint,
  hasDatabaseChanges,
  isFreshReport,
  migrationFiles,
  protectedFiles,
  redactSensitive,
  scanSensitiveFiles,
  scanUnreadableText,
} from "./lib/release-candidate.mjs";
import { analyzeReleaseScope, formatReleaseScopeStop } from "./lib/release-scope.mjs";
import { inspectReleaseEnvironment } from "./lib/release-environment.mjs";

const root = process.cwd();
const baseRef = process.env.RELEASE_BASE_REF || "origin/main";
const artifactRoot = join(root, ".ai", "artifacts", "release-runs");
const node = process.execPath;

function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.replace(/\r?\n+$/, "");
}

function runNode(args) {
  const result = spawnSync(node, args, { cwd: root, stdio: "inherit", env: process.env });
  return result.status ?? 1;
}

function now() {
  return new Date().toISOString();
}

function runId() {
  return now().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function currentSnapshot() {
  const files = collectChangedFiles({ git, baseRef });
  return {
    ...files,
    baseRef,
    headSha: git(["rev-parse", "HEAD"]),
    treeFingerprint: computeTreeFingerprint(root, files.changedFiles),
  };
}

function environmentGate() {
  const environment = inspectReleaseEnvironment(root);
  const failures = [];
  if (!environment.packageManagerLocks.includes("package-lock.json")) {
    failures.push("package-lock.json is required because CI uses npm ci");
  }
  if (environment.packageManagerLocks.length !== 1) {
    failures.push(`expected exactly one lockfile, found ${environment.packageManagerLocks.join(", ") || "none"}`);
  }
  if (environment.packageManager && !environment.packageManager.startsWith("npm")) {
    failures.push("package.json packageManager must match the npm lockfile");
  }
  if (!existsSync(join(root, "node_modules"))) {
    failures.push("node_modules is missing; install dependencies before release:local");
  }
  for (const required of [
    "node_modules/typescript/bin/tsc",
    "node_modules/eslint/bin/eslint.js",
    "node_modules/next/dist/bin/next",
  ]) {
    if (!existsSync(join(root, required))) failures.push(`missing local verification binary: ${required}`);
  }
  return { environment, failures };
}

function gateDefinitions({ quick = false } = {}) {
  const tests = readdirSync(join(root, "tests"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.test\.mjs$/i.test(entry.name))
    .map((entry) => join(root, "tests", entry.name));
  const gates = [
    { id: "memory", label: "Project memory contract", args: [join(root, "scripts", "check-memory.mjs")] },
    { id: "tests", label: "Node regression tests", args: ["--experimental-strip-types", "--test", ...tests] },
    { id: "project", label: "Project structure checks", args: [join(root, "scripts", "run-project-checks.mjs")] },
    { id: "typecheck", label: "TypeScript typecheck", args: [join(root, "node_modules", "typescript", "bin", "tsc"), "--noEmit"] },
    { id: "lint", label: "ESLint", args: [join(root, "node_modules", "eslint", "bin", "eslint.js"), "."] },
    { id: "build", label: "Production build", args: [join(root, "node_modules", "next", "dist", "bin", "next"), "build"] },
  ];
  return quick ? gates.filter((gate) => gate.id !== "build") : gates;
}

function writeSummary(path, report) {
  const lines = [
    "# BookFlow local release report",
    "",
    `- Status: **${report.status}**`,
    `- Generated: ${report.generatedAt}`,
    `- HEAD: \`${report.headSha}\``,
    `- Base ref: \`${report.baseRef}\``,
    `- Tree fingerprint: \`${report.treeFingerprint}\``,
    `- Working tree: ${report.workingTree.clean ? "clean" : "dirty"}`,
    "",
    "## Gates",
    "",
    "| Gate | Result | Exit | Duration |",
    "| --- | --- | ---: | ---: |",
    ...report.gates.map((gate) => `| ${gate.label} | ${gate.status} | ${gate.exitCode ?? "-"} | ${gate.durationMs} ms |`),
    "",
    "## Changed files",
    "",
    ...(report.changedFiles.length ? report.changedFiles.map((file) => `- \`${file}\``) : ["- none"]),
    "",
    "## Release notes",
    "",
    "This report proves only the local gates. PR checks, staging, Vercel, production migration, and production smoke remain separate release gates.",
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function createReport(snapshot, environment, gates, status, run, mode) {
  const databaseChanges = hasDatabaseChanges(snapshot.changedFiles);
  return {
    schemaVersion: 1,
    kind: "release-local-report",
    runId: run,
    mode,
    generatedAt: now(),
    root,
    baseRef,
    headSha: snapshot.headSha,
    treeFingerprint: snapshot.treeFingerprint,
    status,
    workingTree: {
      clean: snapshot.clean,
      statusEntries: snapshot.statusEntries,
      untrackedFiles: snapshot.untrackedFiles,
    },
    changedFiles: snapshot.changedFiles,
    migrations: migrationFiles(snapshot.changedFiles),
    environment,
    gates,
    remoteGates: buildRemoteGates({ databaseChanges }),
    run,
  };
}

function saveReport(report) {
  const directory = join(artifactRoot, report.runId);
  mkdirSync(directory, { recursive: true });
  writeJson(join(directory, "report.json"), report);
  writeSummary(join(directory, "summary.md"), report);
  console.log(`Evidence: ${directory}`);
}

function fail(message) {
  console.error(`STOP: ${message}`);
  process.exitCode = 1;
}

function local() {
  const run = runId();
  const quick = process.argv.includes("--quick");
  const mode = quick ? "quick" : "full";
  const snapshot = currentSnapshot();
  const { environment, failures } = environmentGate();
  const gates = [];
  if (failures.length) {
    gates.push({ id: "environment", label: "Release environment", status: "failed", exitCode: 1, durationMs: 0, failures });
    const report = createReport(snapshot, environment, gates, "failed", run, mode);
    saveReport(report);
    for (const failure of failures) console.error(`  - ${failure}`);
    return 1;
  }

  for (const gate of gateDefinitions({ quick })) {
    const started = Date.now();
    console.log(`\n==> ${gate.label}`);
    const exitCode = runNode(gate.args);
    const result = {
      id: gate.id,
      label: gate.label,
      command: redactSensitive([node, ...gate.args].join(" ")),
      status: exitCode === 0 ? "passed" : "failed",
      exitCode,
      durationMs: Date.now() - started,
    };
    gates.push(result);
    if (exitCode !== 0) {
      const report = createReport(snapshot, environment, gates, "failed", run, mode);
      saveReport(report);
      console.error(`\nSTOP: ${gate.label} failed. Fix it and rerun release:local.`);
      return exitCode;
    }
  }

  const report = createReport(snapshot, environment, gates, "passed", run, mode);
  saveReport(report);
  console.log(quick
    ? "\nQuick local gates passed. Run release:local without --quick before release:prepare."
    : "\nFull local release gates passed. Run release:prepare after committing the intended files.");
  return 0;
}

function latestPassedReport() {
  if (!existsSync(artifactRoot)) return null;
  const candidates = readdirSync(artifactRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(artifactRoot, entry.name, "report.json"))
    .filter((path) => existsSync(path))
    .map((path) => {
      try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
    })
    .filter((report) => report?.status === "passed")
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
  return candidates[0] || null;
}

function prepare() {
  const snapshot = currentSnapshot();
  if (!snapshot.clean) {
    fail("working tree is not clean. Commit the intended changes first; release:prepare never commits or pushes for you.");
    return 1;
  }
  if (!snapshot.changedFiles.length) {
    fail(`no changes found against ${baseRef}`);
    return 1;
  }
  if (snapshot.untrackedFiles.length) {
    fail(`untracked files are present: ${snapshot.untrackedFiles.join(", ")}`);
    return 1;
  }
  const protectedChanged = protectedFiles(snapshot.changedFiles);
  if (protectedChanged.length) {
    fail(`protected recovery files changed: ${protectedChanged.join(", ")}`);
    return 1;
  }
  const sensitive = scanSensitiveFiles(root, snapshot.changedFiles);
  if (sensitive.length) {
    fail(`possible secrets found in changed files: ${sensitive.map(({ file, reason }) => `${file} (${reason})`).join(", ")}`);
    return 1;
  }
  const unreadable = scanUnreadableText(root, snapshot.changedFiles);
  if (unreadable.length) {
    fail(`unreadable text found in changed files: ${unreadable.map(({ file, reason }) => `${file} (${reason})`).join(", ")}`);
    return 1;
  }
  const scope = analyzeReleaseScope(baseRef);
  if (scope.riskyMixedScope) {
    console.error(formatReleaseScopeStop(scope));
    return 1;
  }
  const report = latestPassedReport();
  if (!isFreshReport(report, snapshot)) {
    fail("no current passed release:local report matches this exact committed tree. Rerun release:local after the final modification.");
    return 1;
  }

  const run = runId();
  const directory = join(artifactRoot, run);
  mkdirSync(directory, { recursive: true });
  const databaseChanges = hasDatabaseChanges(snapshot.changedFiles);
  const manifest = {
    schemaVersion: 1,
    kind: "release-candidate-manifest",
    runId: run,
    generatedAt: now(),
    baseRef,
    headSha: snapshot.headSha,
    treeFingerprint: snapshot.treeFingerprint,
    changedFiles: snapshot.changedFiles,
    migrations: migrationFiles(snapshot.changedFiles),
    localReportRunId: report.runId,
    localGates: "passed",
    remoteGates: buildRemoteGates({ databaseChanges }),
    deployable: false,
    nextStep: databaseChanges
      ? "Push this exact commit, pass PR and staging gates, then verify Vercel and production smoke."
      : "Push this exact commit, pass PR and Vercel gates, then verify production smoke.",
  };
  writeJson(join(directory, "release-manifest.json"), manifest);
  writeFileSync(join(directory, "summary.md"), [
    "# BookFlow release candidate",
    "",
    `- Commit: \`${manifest.headSha}\``,
    `- Tree fingerprint: \`${manifest.treeFingerprint}\``,
    `- Local gates: **passed**`,
    `- Remote gates: **pending**`,
    "- Deployable: **no, pending PR/staging/Vercel/production proof**",
    "",
    "Do not edit the committed tree after this manifest is generated. Re-run release:local and release:prepare if the commit changes.",
  ].join("\n") + "\n", "utf8");
  console.log(`Release candidate created: ${directory}`);
  console.log(`Commit: ${manifest.headSha}`);
  console.log(`Changed files: ${manifest.changedFiles.length}`);
  console.log("Local gates passed; remote deployment gates are still pending.");
  return 0;
}

function usage() {
  console.log("Usage: node scripts/release-candidate.mjs <local|prepare>");
}

const command = process.argv[2];
let status = 0;
if (command === "local") status = local();
else if (command === "prepare") status = prepare();
else { usage(); status = 1; }
process.exitCode = status;

export { currentSnapshot, environmentGate, gateDefinitions };
