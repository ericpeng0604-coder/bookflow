import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const fixProcesses = args.has("--fix-processes") || args.has("--fix");
const cleanCache = args.has("--clean-cache") || args.has("--fix");
const warnOnly = args.has("--warn-only");
const repoRoot = process.cwd();
const repoNeedle = repoRoot.toLowerCase();

function runPowerShell(script) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { encoding: "utf8" },
  ).trim();
}

function readDevProcesses() {
  const ps = String.raw`
$repo = (Resolve-Path -LiteralPath '.').Path
$currentNodePid = ${process.pid}
$processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object {
  $_.ProcessId -ne $currentNodePid -and $_.CommandLine -and (
    $_.CommandLine.ToLower().Contains($repo.ToLower()) -or
    $_.CommandLine -match 'node_modules[\\/]+next' -or
    $_.CommandLine -match 'next[\\/]dist[\\/](bin|server)'
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
    try {
      runPowerShell(`Stop-Process -Id ${Number(processInfo.ProcessId)} -Force -ErrorAction SilentlyContinue`);
    } catch {
      // The process can exit between discovery and cleanup.
    }
  }
}

function directorySizeMb(dir) {
  if (!existsSync(dir)) return 0;
  const ps = `
$sum = (Get-ChildItem -LiteralPath '${dir.replaceAll("'", "''")}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
if ($sum) { [math]::Round($sum / 1MB, 1) } else { 0 }
`;
  return Number(runPowerShell(ps));
}

const processes = readDevProcesses().filter((processInfo) => {
  const commandLine = String(processInfo.CommandLine || "").toLowerCase();
  return commandLine.includes(repoNeedle) || commandLine.includes("node_modules");
});

if (processes.length > 0 && fixProcesses) {
  stopProcesses(processes);
  console.log(`Stopped ${processes.length} stale Node/Next process(es).`);
} else if (processes.length > 0) {
  const message = `Found ${processes.length} Node/Next process(es). Run pnpm run dev:clean to stop stale processes.`;
  if (warnOnly) {
    console.warn(message);
  } else {
    console.log(message);
  }
} else {
  console.log("No stale Node/Next processes found.");
}

const nextDir = path.join(repoRoot, ".next");
if (cleanCache && existsSync(nextDir)) {
  const resolvedNext = path.resolve(nextDir);
  const resolvedRepo = path.resolve(repoRoot);
  if (!resolvedNext.startsWith(resolvedRepo + path.sep)) {
    throw new Error(`Refusing to delete outside repo: ${resolvedNext}`);
  }
  rmSync(resolvedNext, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  console.log("Removed .next cache.");
} else if (existsSync(nextDir)) {
  const stats = statSync(nextDir);
  const size = stats.isDirectory() ? directorySizeMb(nextDir) : 0;
  console.log(`.next cache exists (${size} MB).`);
} else {
  console.log(".next cache is absent.");
}
