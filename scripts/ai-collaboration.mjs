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

const ROOT = findGitRoot();
const STATE_PATH = join(ROOT, ".ai", "state.json");
const HANDOFF_PATH = join(ROOT, "AI_HANDOFF.md");
const HISTORY_DIR = join(ROOT, ".ai", "history");
const AGENTS = new Set(["codex", "cursor"]);
const TERMINAL_STATUSES = new Set(["idle", "handoff"]);
const REQUIRED_SECTIONS = [
  "目前目標",
  "重要背景與決策",
  "已完成",
  "剩餘工作",
  "修改範圍",
  "驗證結果",
  "風險或阻礙",
  "下一個 AI 的操作",
  "最後基準 Commit",
];
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
  /(?:password|passwd|密碼)\s*[:=]\s*[^\s`]{6,}/i,
];

function findGitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    console.error("找不到 Git 專案根目錄。");
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
    fail("缺少 .ai/state.json。");
  }

  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    fail(".ai/state.json 不是有效的 JSON。");
  }
}

function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function readHandoff() {
  if (!existsSync(HANDOFF_PATH)) {
    fail("缺少 AI_HANDOFF.md。");
  }
  return readFileSync(HANDOFF_PATH, "utf8");
}

function fail(message) {
  console.error(`AI 交接檢查失敗：${message}`);
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
    fail("AI 名稱只能是 codex 或 cursor。");
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
    fail(`狀態缺少欄位：${missing.join(", ")}`);
  }
  if (state.schemaVersion !== 1 || state.project !== "bookflow") {
    fail("狀態版本或專案名稱不正確。");
  }
  if (state.owner !== "none" && !AGENTS.has(state.owner)) {
    fail("狀態中的 owner 不正確。");
  }
  if (!["idle", "in_progress", "handoff", "blocked"].includes(state.status)) {
    fail("狀態中的 status 不正確。");
  }
  if (state.status === "idle" && state.owner !== "none") {
    fail("idle 狀態的 owner 必須是 none。");
  }
  if (
    ["in_progress", "handoff", "blocked"].includes(state.status) &&
    !AGENTS.has(state.owner)
  ) {
    fail(`${state.status} 狀態必須指定 codex 或 cursor。`);
  }
  if (!/^[0-9a-f]{40}$/i.test(state.baseCommit)) {
    fail("baseCommit 必須是完整的 Git commit SHA。");
  }
  if (Number.isNaN(Date.parse(state.updatedAt))) {
    fail("updatedAt 不是有效時間。");
  }
}

function sectionContent(markdown, title) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) return "";

  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

function validateHandoff(markdown) {
  const missing = REQUIRED_SECTIONS.filter(
    (section) => !sectionContent(markdown, section),
  );
  if (missing.length > 0) {
    fail(`AI_HANDOFF.md 缺少內容：${missing.join("、")}`);
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(markdown)) {
      fail("交接內容疑似包含密碼、Token 或私鑰，請移除敏感資訊。");
    }
  }
}

function archiveHandoff(state, actor, statusLabel) {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const filename = `${timestampForFile()}-${taskSlug(state.taskId)}.md`;
  const path = join(HISTORY_DIR, filename);
  if (existsSync(path)) {
    fail(`歷史檔案已存在，拒絕覆蓋：${filename}`);
  }

  const metadata = [
    "# AI 交接歷史",
    "",
    `- 任務：${state.taskTitle}`,
    `- 執行者：${actor}`,
    `- 狀態：${statusLabel}`,
    `- 基準 Commit：\`${state.baseCommit}\``,
    `- 封存時間：${nowIso()}`,
    "",
    "---",
    "",
  ].join("\n");
  writeFileSync(path, `${metadata}${readHandoff()}`, "utf8");
  return relative(ROOT, path).replaceAll("\\", "/");
}

function printStatus(state = readState()) {
  validateState(state);
  console.log(`專案：${state.project}`);
  console.log(`狀態：${state.status}`);
  console.log(`目前 AI：${state.owner}`);
  console.log(`任務：${state.taskTitle}`);
  console.log(`更新時間：${state.updatedAt}`);
  console.log(`交接摘要：${state.handoffFile}`);
  if (state.historyFile) {
    console.log(`最近歷史：${state.historyFile}`);
  }
}

function claim(agent, title) {
  validateAgent(agent);
  if (!title?.trim()) {
    fail("請提供任務名稱。");
  }

  const state = readState();
  validateState(state);
  if (
    ["in_progress", "blocked"].includes(state.status) &&
    state.owner !== agent
  ) {
    fail(`目前由 ${state.owner} 負責「${state.taskTitle}」，不可重複接手。`);
  }
  if (state.status === "handoff" && state.owner !== agent) {
    fail(`此工作指定交接給 ${state.owner}。`);
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
  console.log(`${agent} 已接手：${state.taskTitle}`);
  console.log("請更新 AI_HANDOFF.md，工作完成後執行交接或完成指令。");
}

function assertOwner(state, agent) {
  validateAgent(agent);
  if (state.owner !== agent || !["in_progress", "blocked"].includes(state.status)) {
    fail(`目前狀態不是由 ${agent} 執行中的工作。`);
  }
}

function handoff(from, to) {
  validateAgent(from);
  validateAgent(to);
  if (from === to) {
    fail("交接來源與目標不可相同。");
  }

  const state = readState();
  validateState(state);
  assertOwner(state, from);
  validateHandoff(readHandoff());
  state.historyFile = archiveHandoff(state, from, `交接給 ${to}`);
  state.owner = to;
  state.status = "handoff";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`已由 ${from} 交接給 ${to}。`);
  console.log(`歷史紀錄：${state.historyFile}`);
}

function complete(agent) {
  const state = readState();
  validateState(state);
  assertOwner(state, agent);
  validateHandoff(readHandoff());
  state.historyFile = archiveHandoff(state, agent, "完成");
  state.owner = "none";
  state.status = "idle";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`${agent} 已完成任務並解除占用。`);
  console.log(`歷史紀錄：${state.historyFile}`);
}

function block(agent, reason) {
  if (!reason?.trim()) {
    fail("請提供阻礙原因。");
  }
  const state = readState();
  validateState(state);
  assertOwner(state, agent);
  state.status = "blocked";
  state.updatedAt = nowIso();
  writeState(state);
  console.log(`${agent} 已將任務標記為 blocked：${reason.trim()}`);
  console.log("請把阻礙與需要的協助寫入 AI_HANDOFF.md。");
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
    fail("程式變更必須新增一筆 .ai/history/*.md 交接歷史。");
  }
  if (entries.some((entry) => /^(?:M|D|R|C)\s/.test(entry))) {
    fail(".ai/history 只能新增紀錄，不可修改、刪除或重新命名舊紀錄。");
  }
}

function checkSecretsInHistory(files) {
  for (const file of files.filter((name) => name.startsWith(".ai/history/"))) {
    const fullPath = resolve(ROOT, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        fail(`${file} 疑似包含敏感資訊。`);
      }
    }
  }
}

function checkLocal() {
  const state = readState();
  validateState(state);
  validateHandoff(readHandoff());
  if (state.historyFile && !existsSync(join(ROOT, state.historyFile))) {
    fail(`找不到最近歷史檔案：${state.historyFile}`);
  }
  console.log("AI 交接資料檢查通過。");
}

function checkCi(base, head) {
  if (!base || !head) {
    fail("CI 檢查需要 base 與 head commit。");
  }
  const files = changedFiles(base, head);
  const substantive = files.filter(isSubstantive);
  if (substantive.length === 0) {
    console.log("只有文件或交接資料變更，不要求新增交接歷史。");
    checkLocal();
    return;
  }
  if (!files.includes("AI_HANDOFF.md") || !files.includes(".ai/state.json")) {
    fail("程式變更必須同步更新 AI_HANDOFF.md 與 .ai/state.json。");
  }
  checkHistoryChanges(base, head);
  checkSecretsInHistory(files);
  const state = readState();
  validateState(state);
  validateHandoff(readHandoff());
  if (!TERMINAL_STATUSES.has(state.status)) {
    fail("準備合併的 PR 狀態必須是 idle 或 handoff，不可仍在執行或阻塞。");
  }
  if (!state.historyFile || !files.includes(state.historyFile)) {
    fail("state.json 的 historyFile 必須指向本次新增的歷史紀錄。");
  }
  console.log(`AI 交接完整性檢查通過，共檢查 ${substantive.length} 個程式檔案。`);
}

function hookStart() {
  console.log("BookFlow AI 交接狀態：");
  printStatus();
  console.log("\n目前交接摘要：\n");
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
      "提醒：目前有程式變更，但尚未更新 AI_HANDOFF.md 與 .ai/state.json。",
    );
  }
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
  case "hook-start":
    hookStart();
    break;
  case "hook-stop":
    hookStop();
    break;
  default:
    fail(
      `未知指令 ${basename(command)}。可用指令：status、claim、handoff、complete、block、check、check-ci。`,
    );
}
