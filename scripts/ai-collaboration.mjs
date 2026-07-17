#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import {
  missingHandoffSections,
  renderHandoffDraft,
  UNREADABLE_TEXT_PATTERN,
} from "./lib/handoff-contract.mjs";
import {
  syncHandoffMetadata,
  validateMemoryContract,
} from "./lib/memory-contract.mjs";

const ROOT = findGitRoot();
const STATE_PATH = join(ROOT, ".ai", "state.json");
const HANDOFF_PATH = join(ROOT, "AI_HANDOFF.md");
const HISTORY_DIR = join(ROOT, ".ai", "history");
const AGENTS = new Set(["codex", "cursor"]);
const TERMINAL_STATUSES = new Set(["idle", "handoff"]);
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
  /(?:password|passwd|密碼|token)\s*[:=]\s*[^\s`]{6,}/i,
];

function findGitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error("Not inside a Git repository.");
    process.exit(1);
  }
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  }).trim();
}

function readState() {
  if (!existsSync(STATE_PATH)) {
    fail("Missing .ai/state.json.");
  }

  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    fail(".ai/state.json is not valid JSON.");
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function readHandoff() {
  if (!existsSync(HANDOFF_PATH)) {
    fail("Missing AI_HANDOFF.md.");
  }
  return readFileSync(HANDOFF_PATH, "utf8");
}

function fail(message) {
  console.error(`AI handoff check failed: ${message}`);
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function taskSlug(value) {
  const ascii = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return ascii || "task";
}

function timestampForFile() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 13);
}

function validateAgent(agent) {
  if (!AGENTS.has(agent)) {
    fail("Agent must be codex or cursor.");
  }
}

function validateState(state) {
  const required = [
    "schemaVersion",
    "project",
    "owner",
    "status",
    "taskId",
    "taskTitle",
    "baseCommit",
    "updatedAt",
    "handoffFile",
    "historyFile",
  ];
  const missing = required.filter((key) => !(key in state));
  if (missing.length > 0) {
    fail(`.ai/state.json is missing: ${missing.join(", ")}`);
  }
  if (state.schemaVersion !== 1 || state.project !== "bookflow") {
    fail(".ai/state.json must use schemaVersion 1 and project bookflow.");
  }
  if (state.owner !== "none" && !AGENTS.has(state.owner)) {
    fail(".ai/state.json owner must be none, codex, or cursor.");
  }
  if (!["idle", "in_progress", "handoff", "blocked"].includes(state.status)) {
    fail(".ai/state.json status must be idle, in_progress, handoff, or blocked.");
  }
  if (state.status === "idle" && state.owner !== "none") {
    fail("idle state must use owner none.");
  }
  if (
    ["in_progress", "handoff", "blocked"].includes(state.status) &&
    !AGENTS.has(state.owner)
  ) {
    fail(`${state.status} state must be owned by codex or cursor.`);
  }
  if (!/^[0-9a-f]{40}$/i.test(state.baseCommit)) {
    fail("baseCommit must be a full Git commit SHA.");
  }
  if (Number.isNaN(Date.parse(state.updatedAt))) {
    fail("updatedAt must be a valid ISO date.");
  }
}

function validateHandoff(markdown) {
  validateReadableText(markdown, "AI_HANDOFF.md");

  const missing = missingHandoffSections(markdown);
  if (missing.length > 0) {
    fail(
      `AI_HANDOFF.md is missing required sections: ${missing.join("、")}. Run ` +
        "`node scripts/ai-collaboration.mjs draft <title>` or copy `.ai/templates/handoff.md`, then fill every section with confirmed facts.",
    );
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(markdown)) {
      fail("AI_HANDOFF.md appears to contain a secret, token, password, or credential.");
    }
  }
}

function validateReadableText(content, label) {
  if (UNREADABLE_TEXT_PATTERN.test(content)) {
    fail(`${label} contains mojibake or private-use replacement characters. Rewrite it as UTF-8 before continuing.`);
  }
}

function archiveHandoff(state, actor, statusLabel) {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const filename = `${timestampForFile()}-${taskSlug(state.taskId)}.md`;
  const path = join(HISTORY_DIR, filename);
  if (existsSync(path)) {
    fail(`History file already exists: ${filename}`);
  }
  const historyFile = relative(ROOT, path).replaceAll("\\", "/");
  const synchronizedHandoff = syncHandoffMetadata(readHandoff(), {
    taskId: state.taskId,
    taskTitle: state.taskTitle,
    branch: git(["branch", "--show-current"]) || "(detached)",
    baseCommit: state.baseCommit,
    historyFile,
  });
  const metadata = [
    "# AI Handoff Archive",
    "",
    `- Task: ${state.taskTitle}`,
    `- Actor: ${actor}`,
    `- Status: ${statusLabel}`,
    `- Base commit: \`${state.baseCommit}\``,
    `- Archived at: ${nowIso()}`,
    "",
    "---",
    "",
  ].join("\n");
  try {
    writeFileSync(path, `${metadata}${synchronizedHandoff}`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail(`History file already exists: ${filename}`);
    }
    throw error;
  }
  writeFileSync(HANDOFF_PATH, synchronizedHandoff, "utf8");
  return historyFile;
}

function validateProjectMemoryContract() {
  const result = validateMemoryContract(ROOT);
  if (result.errors.length > 0) {
    fail(`project memory contract failed:\n- ${result.errors.join("\n- ")}`);
  }
}

function printStatus(state = readState()) {
  validateState(state);
  console.log(`Project: ${state.project}`);
  console.log(`Status: ${state.status}`);
  console.log(`Owner: ${state.owner}`);
  console.log(`Task: ${state.taskTitle}`);
  console.log(`Updated: ${state.updatedAt}`);
  console.log(`Handoff: ${state.handoffFile}`);
  if (state.historyFile) {
    console.log(`History: ${state.historyFile}`);
  }
}

function claim(agent, title) {
  validateAgent(agent);
  if (!title?.trim()) {
    fail("Provide a task title.");
  }

  const state = readState();
  validateState(state);
  if (
    ["in_progress", "blocked"].includes(state.status) &&
    state.owner !== agent
  ) {
    fail(`${state.owner} already owns this task: ${state.taskTitle}`);
  }
  if (state.status === "handoff" && state.owner !== agent) {
    fail(`Task is handed off to ${state.owner}.`);
  }

  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  state.owner = agent;
  state.status = "in_progress";
  state.taskId = `${date}-${taskSlug(title)}`;
  state.taskTitle = title.trim();
  state.baseCommit = git(["rev-parse", "HEAD"]);
  state.updatedAt = nowIso();
  state.historyFile = null;
  writeState(state);
  console.log(`${agent} claimed: ${state.taskTitle}`);
  console.log("Update AI_HANDOFF.md or run `node scripts/ai-collaboration.mjs draft <title>` before completing the task.");
}

function assertOwner(state, agent) {
  validateAgent(agent);
  if (state.owner !== agent || !["in_progress", "blocked"].includes(state.status)) {
    fail(`Current task is not owned by ${agent}.`);
  }
}

function handoff(from, to) {
  validateAgent(from);
  validateAgent(to);
  if (from === to) {
    fail("Cannot hand off to the same agent.");
  }

  const state = readState();
  validateState(state);
  assertOwner(state, from);
  validateHandoff(readHandoff());
  state.historyFile = archiveHandoff(state, from, `handoff to ${to}`);
  state.owner = to;
  state.status = "handoff";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`Handed off from ${from} to ${to}.`);
  console.log(`History saved: ${state.historyFile}`);
}

function complete(agent) {
  const state = readState();
  validateState(state);
  assertOwner(state, agent);
  validateHandoff(readHandoff());
  state.historyFile = archiveHandoff(state, agent, "complete");
  state.owner = "none";
  state.status = "idle";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`${agent} marked the task complete.`);
  console.log(`History saved: ${state.historyFile}`);
}

function block(agent, reason) {
  if (!reason?.trim()) {
    fail("Provide a blocking reason.");
  }
  const state = readState();
  validateState(state);
  assertOwner(state, agent);
  state.status = "blocked";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`${agent} marked the task blocked: ${reason.trim()}`);
  console.log("Document the blocker in AI_HANDOFF.md.");
}

function changedFiles(base, head) {
  return git(["diff", "--name-only", `${base}...${head}`])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function isSubstantive(file) {
  if (
    file === "AI_HANDOFF.md" ||
    file.startsWith(".ai/") ||
    file.startsWith("docs/") ||
    file === "README.md" ||
    /\.(?:md|txt|png|jpe?g|gif|webp|svg)$/i.test(file)
  ) {
    return false;
  }
  return true;
}

function checkHistoryChanges(base, head) {
  const entries = git(["diff", "--name-status", `${base}...${head}`, "--", ".ai/history"])
    .split(/\r?\n/)
    .filter(Boolean);
  if (!entries.some((entry) => /^A\s+\.ai\/history\/.+\.md$/.test(entry))) {
    fail("Substantive PR changes must add one .ai/history/*.md handoff archive.");
  }
  if (entries.some((entry) => /^(?:M|D|R|C)\s/.test(entry))) {
    fail(".ai/history is append-only. Add a new history file instead of editing old entries.");
  }
}

function checkSecretsInHistory(files) {
  for (const file of files.filter((name) => name.startsWith(".ai/history/"))) {
    const fullPath = resolve(ROOT, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    validateReadableText(content, file);
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        fail(`${file} appears to contain a secret, token, password, or credential.`);
      }
    }
  }
}

function checkLocal() {
  const state = readState();
  validateState(state);
  validateHandoff(readHandoff());
  if (state.historyFile && !existsSync(join(ROOT, state.historyFile))) {
    fail(`historyFile is set but missing: ${state.historyFile}`);
  }
  validateProjectMemoryContract();
  console.log("AI handoff local check passed.");
}

function checkCi(base, head) {
  if (!base || !head) {
    fail("check-ci requires base and head commits.");
  }
  const files = changedFiles(base, head);
  const substantive = files.filter(isSubstantive);
  if (substantive.length === 0) {
    console.log("No substantive code changes; running local handoff validation only.");
    checkLocal();
    return;
  }
  if (!files.includes("AI_HANDOFF.md") || !files.includes(".ai/state.json")) {
    fail("Substantive changes must update AI_HANDOFF.md and .ai/state.json.");
  }
  checkHistoryChanges(base, head);
  checkSecretsInHistory(files);
  const state = readState();
  validateState(state);
  validateHandoff(readHandoff());
  validateProjectMemoryContract();
  if (!TERMINAL_STATUSES.has(state.status)) {
    fail("PR handoff status must be idle or handoff before opening or merging a release PR.");
  }
  if (!state.historyFile || !files.includes(state.historyFile)) {
    fail("state.json historyFile must point at the new .ai/history entry included in this PR.");
  }
  console.log(`AI handoff CI check passed for ${substantive.length} substantive file(s).`);
}

function hookStart() {
  console.log("BookFlow AI handoff status");
  printStatus();
  console.log("\nCurrent handoff:\n");
  console.log(readHandoff());
}

function hookStop() {
  checkLocal();
  const changed = git(["status", "--short"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).replaceAll("\\", "/"));
  const substantive = changed.filter(isSubstantive);
  if (
    substantive.length > 0 &&
    !changed.includes("AI_HANDOFF.md") &&
    !changed.includes(".ai/state.json")
  ) {
    console.warn(
      "Reminder: substantive changes are present without AI_HANDOFF.md and .ai/state.json updates.",
    );
  }
}

function draft(title) {
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const baseCommit = git(["rev-parse", "HEAD"]);
  const state = existsSync(STATE_PATH) ? readState() : null;
  const taskTitle = title?.trim() || state?.taskTitle || "<任務標題>";
  const historyFile = state?.historyFile || `.ai/history/${timestampForFile()}-${taskSlug(taskTitle)}.md`;
  process.stdout.write(
    renderHandoffDraft({
      taskId: state?.taskId || taskSlug(taskTitle),
      title: taskTitle,
      branch,
      baseCommit,
      currentCommit: "not committed yet",
      historyFile,
    }),
  );
}

const [command = "status", ...args] = process.argv.slice(2);

switch (command) {
  case "status":
    printStatus();
    break;
  case "claim":
    claim(args[0], args.slice(1).join(" "));
    break;
  case "handoff":
    handoff(args[0], args[1]);
    break;
  case "complete":
    complete(args[0]);
    break;
  case "block":
    block(args[0], args.slice(1).join(" "));
    break;
  case "check":
    checkLocal();
    break;
  case "check-ci":
    checkCi(args[0], args[1]);
    break;
  case "draft":
    draft(args.join(" "));
    break;
  case "hook-start":
    hookStart();
    break;
  case "hook-stop":
    hookStop();
    break;
  default:
    fail(
      `Unknown command ${basename(command)}. Available commands: status, claim, handoff, complete, block, check, check-ci, draft.`,
    );
}
