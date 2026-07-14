#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import process from "node:process";

const DEFAULT_LIMIT = 12;
const MAX_FILE_BYTES = 750 * 1024;
const EXCERPT_LENGTH = 180;

const riskTerms = [
  "secret",
  "token",
  "password",
  "credential",
  "api key",
  "private",
  "personal",
  "account",
  "email",
  "phone",
  "address",
  "stale",
  "misleading",
  "blame",
];

const auditTerms = [
  "secret",
  "password",
  "credential",
  "api key",
  "service role",
  "bearer",
  "cookie",
  "initial password",
  "local env",
  "omniroute.local.env",
  "pooler",
  "postgres.",
  "project ref",
  "correct account",
  "wrong account",
  "PLUS",
  "192.168.",
  "MacAddress",
  "student card",
  "student-card",
  "credit card",
  "personal data",
];

function parseArgs(argv) {
  const options = {
    scope: "memory",
    deep: false,
    limit: DEFAULT_LIMIT,
    terms: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--deep") {
      options.deep = true;
    } else if (arg === "--audit") {
      options.audit = true;
      options.deep = true;
      options.scope = "memory";
      options.terms.push(...auditTerms);
    } else if (arg === "--risk") {
      options.terms.push(...riskTerms);
    } else if (arg === "--scope") {
      options.scope = argv[index + 1] || options.scope;
      index += 1;
    } else if (arg.startsWith("--scope=")) {
      options.scope = arg.slice("--scope=".length);
    } else if (arg === "--limit") {
      options.limit = Number.parseInt(argv[index + 1] || "", 10) || DEFAULT_LIMIT;
      index += 1;
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.slice("--limit=".length), 10) || DEFAULT_LIMIT;
    } else {
      options.terms.push(arg);
    }
  }

  options.limit = Math.max(1, Math.min(options.limit, 50));
  options.scope = ["memory", "project", "all"].includes(options.scope)
    ? options.scope
    : "memory";
  return options;
}

function printHelp() {
  console.log("Low-token lookup for Codex");
  console.log("");
  console.log("Usage:");
  console.log("  pnpm run ai:lookup -- <keywords>");
  console.log("  pnpm run ai:lookup -- --risk");
  console.log("  pnpm run ai:lookup -- --audit --limit 10");
  console.log("  pnpm run ai:lookup -- --scope project <keywords>");
  console.log("  pnpm run ai:lookup -- --scope all --deep <keywords>");
  console.log("");
  console.log("Defaults:");
  console.log("  - searches memory index files first");
  console.log("  - skips rollout summaries unless --deep is passed");
  console.log("  - prints short candidates only, not full files");
}

function gitRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.cwd();
  }
}

function gitFiles(root) {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((file) => join(root, file));
  } catch {
    return [];
  }
}

function readableFile(file) {
  try {
    const size = statSync(file).size;
    if (size > MAX_FILE_BYTES) return false;
    return /\.(cjs|css|json|jsx|md|mjs|sql|ts|tsx|txt|yml|yaml)$/i.test(file);
  } catch {
    return false;
  }
}

function walk(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walk(fullPath));
      if (entry.isFile()) files.push(fullPath);
    }
    return files;
  } catch {
    return [];
  }
}

function memoryFiles(deep) {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const memoryRoot = join(home, ".codex", "memories");
  const candidates = [
    join(memoryRoot, "memory_summary.md"),
    join(memoryRoot, "MEMORY.md"),
  ].filter(existsSync);

  const extraDirs = [
    join(memoryRoot, "extensions", "ad_hoc", "notes"),
    join(memoryRoot, "skills"),
  ];
  if (deep) {
    candidates.push(join(memoryRoot, "raw_memories.md"));
    extraDirs.push(join(memoryRoot, "rollout_summaries"));
  }

  for (const dir of extraDirs) {
    candidates.push(...walk(dir));
  }

  return candidates.filter(readableFile);
}

function normalize(value) {
  return value.toLowerCase();
}

function redact(value) {
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "sk-...[redacted]")
    .replace(/\b(ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,})\b/g, "[github-token-redacted]")
    .replace(/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, "[jwt-redacted]")
    .replace(/\bpostgres\.[A-Za-z0-9_-]+\b/g, "postgres.[redacted]")
    .replace(/\b[a-z0-9-]+\.pooler\.supabase\.com\b/gi, "[supabase-pooler-redacted]")
    .replace(/\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[0-1]))\.\d{1,3}\.\d{1,3}\b/g, "[private-ip-redacted]")
    .replace(/\b[\w.-]+\.local\.env\b/g, "[local-env-file-redacted]")
    .replace(/`[^`]*(?:\s\/\sPLUS|ChatGPT Plus)[^`]*`/gi, "`[account-redacted]`")
    .replace(/(password|token|secret|api[_-]?key|service[_-]?role)(\s*[:=]\s*)(\S+)/gi, "$1$2[redacted]");
}

function excerpt(line) {
  const compact = redact(line.trim().replace(/\s+/g, " "));
  if (compact.length <= EXCERPT_LENGTH) return compact;
  return `${compact.slice(0, EXCERPT_LENGTH - 3)}...`;
}

function displayPath(file, root) {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const memoryRoot = join(home, ".codex", "memories");
  if (file.startsWith(memoryRoot)) {
    return join("~", ".codex", "memories", relative(memoryRoot, file));
  }
  return relative(root, file) || basename(file);
}

function sourceFiles(options, root) {
  const files = [];
  if (options.scope === "memory" || options.scope === "all") {
    files.push(...memoryFiles(options.deep));
  }
  if (options.scope === "project" || options.scope === "all") {
    files.push(...gitFiles(root));
  }
  return [...new Set(files.map((file) => resolve(file)))];
}

function searchFiles(files, terms, root) {
  const loweredTerms = terms.map(normalize).filter(Boolean);
  const results = [];

  for (const file of files) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const haystack = normalize(lines[index]);
      const score = loweredTerms.reduce(
        (total, term) => total + (haystack.includes(term) ? 1 : 0),
        0,
      );
      if (!score) continue;
      results.push({
        file,
        line: index + 1,
        score,
        text: excerpt(lines[index]),
        display: displayPath(file, root),
      });
    }
  }

  return results.sort(
    (a, b) => b.score - a.score || a.display.localeCompare(b.display) || a.line - b.line,
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (!options.terms.length) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const root = gitRoot();
  const files = sourceFiles(options, root);
  const results = searchFiles(files, options.terms, root).slice(0, options.limit);

  console.log("Low-token lookup candidates");
  console.log(`Scope: ${options.scope}${options.deep ? " + deep rollout summaries" : ""}`);
  if (options.audit) console.log("Mode: audit preset for sensitive memory candidates");
  console.log(`Terms: ${options.terms.join(", ")}`);
  console.log(`Files considered: ${files.length}`);
  console.log("");

  if (!results.length) {
    console.log("No candidates found. Try fewer terms or add --deep only if rollout history is needed.");
    return;
  }

  for (const result of results) {
    console.log(`${result.display}:${result.line} | ${result.text}`);
  }

  console.log("");
  console.log("Next step: open only the listed line windows that match the task. Use --deep only after this first pass is insufficient.");
}

main();
