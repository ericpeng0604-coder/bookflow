#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  inspectReleaseEnvironment,
  printReleaseEnvironment,
} from "./lib/release-environment.mjs";

const args = new Set(process.argv.slice(2));
const fixProcesses = args.has("--fix-processes") || args.has("--fix");
const cleanCache = args.has("--clean-cache") || args.has("--fix");
const warnOnly = args.has("--warn-only");
const repoRoot = process.cwd();

function runPowerShell(script) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8" },
  ).trim();
}

function readDevProcesses() {
  if (process.platform !== "win32") return [];
  const ps = String.raw`
$repo = (Resolve-Path -LiteralPath '.').Path.ToLowerInvariant()
$currentNodePid = ${process.pid}
$processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object {
  $_.ProcessId -ne $currentNodePid -and $_.CommandLine -and (
    $_.CommandLine.ToLowerInvariant().Contains($repo) -or
    ($_.CommandLine.ToLowerInvariant().Contains('next') -and $_.CommandLine.ToLowerInvariant().Contains($repo))
  )
} | Select-Object ProcessId, CommandLine
$processes | ConvertTo-Json -Depth 3
`;
  const output = runPowerShell(ps);
  if (!output) return [];
  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stopProcesses(processes) {
  for (const processInfo of processes) {
    const pid = Number(processInfo.ProcessId);
    if (Number.isInteger(pid) && pid > 0) {
      runPowerShell(`Stop-Process -Id ${pid} -Force`);
    }
  }
}

function directorySizeMb(dir) {
  if (!existsSync(dir)) return 0;
  if (process.platform !== "win32") return 0;
  const escaped = dir.replaceAll("'", "''");
  const ps = `
$sum = (Get-ChildItem -LiteralPath '${escaped}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
if ($sum) { [math]::Round($sum / 1MB, 1) } else { 0 }
`;
  return Number(runPowerShell(ps));
}

console.log("BookFlow dev environment");
printReleaseEnvironment(inspectReleaseEnvironment(repoRoot));

const processes = readDevProcesses();
if (processes.length > 0 && fixProcesses) {
  stopProcesses(processes);
  console.log(`Stopped ${processes.length} Node/Next process(es) for this checkout.`);
} else if (processes.length > 0) {
  const message = `Found ${processes.length} Node/Next process(es) for this checkout. Run npm run dev:clean to stop them.`;
  if (warnOnly) console.warn(message);
  else console.log(message);
} else {
  console.log("No stale Node/Next processes found for this checkout.");
}

const nextDir = path.join(repoRoot, ".next");
if (cleanCache && existsSync(nextDir)) {
  const resolvedNext = path.resolve(nextDir);
  const resolvedRepo = path.resolve(repoRoot);
  if (!resolvedNext.startsWith(resolvedRepo + path.sep)) {
    throw new Error(`Refusing to delete outside repo: ${resolvedNext}`);
  }
  rmSync(resolvedNext, { recursive: true, force: true });
  console.log("Removed .next cache.");
} else if (existsSync(nextDir)) {
  const stats = statSync(nextDir);
  const size = stats.isDirectory() ? directorySizeMb(nextDir) : 0;
  console.log(`.next cache exists (${size} MB).`);
} else {
  console.log(".next cache is absent.");
}
