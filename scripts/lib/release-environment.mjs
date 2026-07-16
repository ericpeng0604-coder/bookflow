import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export function commandExists(command) {
  const probe = process.platform === "win32" ? "where.exe" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  try {
    execFileSync(probe, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
  }).trim();
}

export function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

export function inspectReleaseEnvironment(root = process.cwd()) {
  const packageLock = existsSync(join(root, "package-lock.json"));
  const pnpmLock = existsSync(join(root, "pnpm-lock.yaml"));
  const yarnLock = existsSync(join(root, "yarn.lock"));
  const packageManagerLocks = [
    packageLock && "package-lock.json",
    pnpmLock && "pnpm-lock.yaml",
    yarnLock && "yarn.lock",
  ].filter(Boolean);

  const packageJsonPath = join(root, "package.json");
  let packageManager = null;
  if (existsSync(packageJsonPath)) {
    try {
      packageManager = JSON.parse(
        execFileSync(process.execPath, [
          "-e",
          `process.stdout.write(JSON.stringify(require(${JSON.stringify(packageJsonPath)}).packageManager || null))`,
        ], { encoding: "utf8" }),
      );
    } catch {
      packageManager = "unreadable";
    }
  }

  const nodeModulesPath = join(root, "node_modules");
  let nodeModules = "absent";
  let nodeModulesTarget = null;
  if (existsSync(nodeModulesPath)) {
    const stats = lstatSync(nodeModulesPath);
    const real = realpathSync(nodeModulesPath);
    const isLinked = stats.isSymbolicLink() || real !== nodeModulesPath;
    nodeModules = isLinked ? "linked" : "directory";
    nodeModulesTarget = isLinked ? real : null;
  }

  const nextPath = join(root, ".next");
  let nextCache = "absent";
  if (existsSync(nextPath)) {
    const stats = statSync(nextPath);
    nextCache = stats.isDirectory() ? "present" : "present-file";
  }

  return {
    nodeOnPath: commandExists("node"),
    npmOnPath: commandExists("npm"),
    packageManagerLocks,
    packageManager,
    nodeModules,
    nodeModulesTarget,
    nextCache,
  };
}

export function printReleaseEnvironment(report) {
  console.log("Release environment:");
  console.log(`  node on PATH: ${report.nodeOnPath ? "yes" : "no"}`);
  console.log(`  npm on PATH: ${report.npmOnPath ? "yes" : "no"}`);
  console.log(`  lockfiles: ${report.packageManagerLocks.join(", ") || "none"}`);
  console.log(`  packageManager field: ${report.packageManager || "none"}`);
  console.log(`  node_modules: ${report.nodeModules}${report.nodeModulesTarget ? ` -> ${report.nodeModulesTarget}` : ""}`);
  console.log(`  .next cache: ${report.nextCache}`);

  if (report.packageManagerLocks.length > 1) {
    console.log("  STOP: multiple package-manager lockfiles are present. Keep only the lockfile used by CI.");
  }

  if (report.packageManagerLocks.includes("package-lock.json")) {
    if (report.packageManager && !report.packageManager.startsWith("npm")) {
      console.log("  STOP: package.json declares a non-npm package manager in an npm-lock project. Align the declaration with CI.");
    }
    if (!report.npmOnPath) {
      console.log("  Fallback: use the bundled Node executable for repo scripts, but do not switch this npm-lock project to pnpm just to run release checks.");
      console.log("  For full typecheck/lint/build, use an npm-created node_modules for this worktree or rely on GitHub CI after local script checks pass.");
    }
  }

  if (report.nodeModules === "linked") {
    console.log("  Warning: node_modules is linked. Do not run a package manager through this worktree until the link is removed.");
  }
}
