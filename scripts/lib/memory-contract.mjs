import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { UNREADABLE_TEXT_PATTERN } from "./handoff-contract.mjs";

const HANDOFF_FIELDS = {
  taskId: "Task ID",
  taskTitle: "Task",
  branch: "Branch",
  baseCommit: "Base commit",
  historyFile: "History",
};

function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
function gitSucceeds(root, args) {
  try {
    execFileSync("git", args, {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldPattern(label) {
  return new RegExp(
    "^- " + escapeRegExp(label) + ":\\s*(?:`([^`]+)`|(.+?))\\.?\\s*$",
    "m",
  );
}

function fieldValue(markdown, label) {
  const match = markdown.match(fieldPattern(label));
  return (match?.[1] || match?.[2] || "").trim().replace(/\.$/, "");
}

function metadataLine(label, value) {
  return `- ${label}: \`${value}\`.`;
}

export function handoffMetadata(markdown) {
  return Object.fromEntries(
    Object.entries(HANDOFF_FIELDS).map(([key, label]) => [key, fieldValue(markdown, label)]),
  );
}

export function syncHandoffMetadata(markdown, values) {
  let next = markdown.replaceAll("\r\n", "\n");
  const normalized = {
    ...values,
    historyFile: values.historyFile || "pending",
  };
  const missing = [];

  for (const [key, label] of Object.entries(HANDOFF_FIELDS)) {
    const pattern = fieldPattern(label);
    const line = metadataLine(label, normalized[key]);
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
    } else {
      missing.push(line);
    }
  }

  if (missing.length > 0) {
    const heading = "## 目前狀態與背景\n";
    if (!next.includes(heading)) {
      throw new Error("AI_HANDOFF.md is missing the 目前狀態與背景 section.");
    }
    next = next.replace(heading, `${heading}\n${missing.join("\n")}\n`);
  }

  return `${next.trimEnd()}\n`;
}

function packageScriptTargets(root, packageJson) {
  const targets = [];
  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    const matches = String(command).matchAll(/\bscripts\/[A-Za-z0-9_./-]+/g);
    for (const match of matches) {
      targets.push({ name, path: normalizePath(match[0]) });
    }
  }
  return targets.filter(({ path }) => !existsSync(join(root, path)));
}

function duplicateLessonIds(manual) {
  const counts = new Map();
  for (const match of manual.matchAll(/^### (LESSON-[A-Z0-9-]+):/gm)) {
    counts.set(match[1], (counts.get(match[1]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function validateMemoryContract(root, { checkGit = true } = {}) {
  const errors = [];
  const packagePath = join(root, "package.json");
  const manualPath = join(root, "AI_WORK_MANUAL.md");
  const statePath = join(root, ".ai", "state.json");
  const handoffPath = join(root, "AI_HANDOFF.md");

  for (const path of [packagePath, manualPath, statePath, handoffPath]) {
    if (!existsSync(path)) {
      errors.push(`Missing required memory contract file: ${normalizePath(relative(root, path))}`);
    }
  }
  if (errors.length > 0) return { errors, stats: {} };

  let packageJson;
  let state;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  } catch {
    errors.push("package.json is not valid JSON.");
  }
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    errors.push(".ai/state.json is not valid JSON.");
  }
  if (!packageJson || !state) return { errors, stats: {} };

  const manual = readFileSync(manualPath, "utf8");
  const handoff = readFileSync(handoffPath, "utf8");
  const metadata = handoffMetadata(handoff);
  const missingTargets = packageScriptTargets(root, packageJson);
  const duplicateIds = duplicateLessonIds(manual);

  if (UNREADABLE_TEXT_PATTERN.test(manual)) {
    errors.push("AI_WORK_MANUAL.md contains mojibake or private-use replacement characters.");
  }
  if (UNREADABLE_TEXT_PATTERN.test(handoff)) {
    errors.push("AI_HANDOFF.md contains mojibake or private-use replacement characters.");
  }

  for (const { name, path } of missingTargets) {
    errors.push(`package.json script ${name} points to missing ${path}.`);
  }
  for (const [id, count] of duplicateIds) {
    errors.push(`AI_WORK_MANUAL.md contains duplicate ${id} headings (${count}).`);
  }

  for (const [key, label] of Object.entries(HANDOFF_FIELDS)) {
    if (!metadata[key]) errors.push(`AI_HANDOFF.md is missing metadata field: ${label}.`);
  }

  const expected = {
    taskId: state.taskId,
    taskTitle: state.taskTitle,
    baseCommit: state.baseCommit,
    historyFile: state.historyFile || "pending",
  };
  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key] && metadata[key] !== value) {
      errors.push(`AI_HANDOFF.md ${HANDOFF_FIELDS[key]} does not match .ai/state.json.`);
    }
  }

  if (state.handoffFile !== "AI_HANDOFF.md") {
    errors.push(".ai/state.json handoffFile must be AI_HANDOFF.md.");
  }
  if (state.historyFile && !existsSync(join(root, state.historyFile))) {
    errors.push(`.ai/state.json historyFile is missing: ${state.historyFile}.`);
  }

  const baseCommits = unique(
    [...handoff.matchAll(/Base commit:\s*`([0-9a-f]{40})`/gi)].map((match) => match[1].toLowerCase()),
  );
  if (baseCommits.length > 1) {
    errors.push(`AI_HANDOFF.md contains conflicting base commits: ${baseCommits.join(", ")}.`);
  }
  if (baseCommits.length === 1 && baseCommits[0] !== String(state.baseCommit).toLowerCase()) {
    errors.push("AI_HANDOFF.md base commit does not match .ai/state.json.");
  }

  const concreteHistoryFiles = unique(
    [...handoff.matchAll(/\.ai\/history\/[A-Za-z0-9._/-]+\.md/g)].map((match) => match[0]),
  );
  if (state.historyFile) {
    for (const path of concreteHistoryFiles) {
      if (path !== state.historyFile) {
        errors.push(`AI_HANDOFF.md references stale history file ${path}.`);
      }
    }
  } else if (concreteHistoryFiles.length > 0) {
    errors.push("AI_HANDOFF.md references a concrete history file while state.historyFile is null.");
  }

  if (checkGit) {
    const currentBranch = git(root, ["branch", "--show-current"]);
    if (currentBranch && metadata.branch && metadata.branch !== currentBranch) {
      errors.push(`AI_HANDOFF.md Branch is ${metadata.branch}, but the checkout is ${currentBranch}.`);
    }
    if (!gitSucceeds(root, ["cat-file", "-e", `${state.baseCommit}^{commit}`])) {
      errors.push(`.ai/state.json baseCommit does not exist: ${state.baseCommit}.`);
    }
    if (!gitSucceeds(root, ["merge-base", "--is-ancestor", state.baseCommit, "HEAD"])) {
      errors.push(`.ai/state.json baseCommit is not an ancestor of HEAD: ${state.baseCommit}.`);
    }

    const implementationCommits = unique(
      [...handoff.matchAll(
        /(?:Feature commit|Current implementation commit before final commit):\s*`([^`]+)`/gi,
      )].map((match) => match[1]),
    );
    if (implementationCommits.length > 1) {
      errors.push(`AI_HANDOFF.md contains conflicting implementation commits: ${implementationCommits.join(", ")}.`);
    }
    for (const value of implementationCommits) {
      if (/^(?:not committed yet|pending)$/i.test(value)) continue;
      const resolved = git(root, ["rev-parse", `${value}^{commit}`]);
      if (!resolved) {
        errors.push(`AI_HANDOFF.md implementation commit does not exist: ${value}.`);
      } else if (!gitSucceeds(root, ["merge-base", "--is-ancestor", resolved, "HEAD"])) {
        errors.push(`AI_HANDOFF.md implementation commit is not an ancestor of HEAD: ${value}.`);
      }
    }
  }

  return {
    errors: unique(errors),
    stats: {
      lessonCount: [...manual.matchAll(/^### LESSON-[0-9]+:/gm)].length,
      packageScriptCount: Object.keys(packageJson.scripts || {}).length,
      checkedScriptTargetCount: Object.values(packageJson.scripts || {}).reduce(
        (count, command) => count + [...String(command).matchAll(/\bscripts\/[A-Za-z0-9_./-]+/g)].length,
        0,
      ),
    },
  };
}
