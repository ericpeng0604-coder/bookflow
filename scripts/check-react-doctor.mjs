#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = mkdtempSync(join(tmpdir(), "bookflow-react-doctor-"));
const reportPath = join(tempRoot, "react-doctor-report.json");
const ignoredPrefixes = ["outputs", "work"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`.trim(),
    );
  }
  return result.stdout;
}

function isIgnoredArtifact(filePath) {
  const normalized = filePath.split(/[\\/]+/);
  return ignoredPrefixes.includes(normalized[0]);
}

function copyTrackedFiles() {
  const output = run("git", ["ls-files", "-z"], { encoding: "buffer" });
  const files = output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((filePath) => !isIgnoredArtifact(filePath));

  for (const filePath of files) {
    const source = join(root, filePath);
    if (!existsSync(source)) continue;
    const target = join(tempRoot, filePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }

  return files.length;
}

function runReactDoctor() {
  const pnpmArgs = [
    "dlx",
    "react-doctor@latest",
    "--json",
    "--json-out",
    reportPath,
    "-y",
    tempRoot,
  ];
  const pnpmExecPath = process.env.npm_execpath;
  const useNodeForPnpm =
    pnpmExecPath && /\.(?:cjs|mjs|js)$/i.test(pnpmExecPath);
  const command = useNodeForPnpm
    ? process.execPath
    : pnpmExecPath || (process.platform === "win32" ? "pnpm.cmd" : "pnpm");
  const args = useNodeForPnpm && pnpmExecPath
    ? [pnpmExecPath, ...pnpmArgs]
    : pnpmArgs;
  const result = spawnSync(
    command,
    args,
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      `react-doctor failed\n${result.error?.message || ""}\n${result.stdout || ""}${result.stderr || ""}`.trim(),
    );
  }
}

function toProjectPath(filePath) {
  const absolute = resolve(tempRoot, filePath);
  return relative(tempRoot, absolute).split(sep).join("/");
}

function summarizeReport(copiedFileCount) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const project = report.projects?.[0];
  const diagnostics = project?.diagnostics ?? [];
  const artifactDiagnostics = diagnostics.filter((diagnostic) =>
    isIgnoredArtifact(toProjectPath(diagnostic.filePath || "")),
  );
  if (artifactDiagnostics.length > 0) {
    throw new Error(`React Doctor reported ignored artifact diagnostics: ${artifactDiagnostics.length}`);
  }

  const summary = report.summary ?? {};
  const score = summary.score ?? project?.score?.score ?? "unknown";
  const label = summary.scoreLabel ?? project?.score?.label ?? "unknown";
  const errorCount = summary.errorCount ?? diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = summary.warningCount ?? diagnostics.filter((d) => d.severity === "warning").length;

  console.log(`React Doctor clean scan copied ${copiedFileCount} tracked files.`);
  console.log(`React Doctor score: ${score} (${label})`);
  console.log(`React Doctor diagnostics: ${errorCount} errors, ${warningCount} warnings.`);

  if (errorCount > 0) {
    const firstErrors = diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .slice(0, 5)
      .map((diagnostic) => {
        const location = [diagnostic.filePath, diagnostic.line].filter(Boolean).join(":");
        return `- ${location} ${diagnostic.rule}: ${diagnostic.message}`;
      })
      .join("\n");
    throw new Error(`React Doctor clean scan still has errors:\n${firstErrors}`);
  }
}

try {
  const copiedFileCount = copyTrackedFiles();
  runReactDoctor();
  summarizeReport(copiedFileCount);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
