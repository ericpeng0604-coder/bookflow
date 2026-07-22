import { execFileSync } from "node:child_process";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).replace(/\r?\n+$/, "");
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

function normalizeStatusEntry(entry) {
  return entry.slice(3).trim();
}

function unique(values) {
  return [...new Set(values)];
}

function classifyFile(file) {
  if (
    file === "instrumentation.ts"
    || file === "instrumentation-client.ts"
    || file === "sentry.server.config.ts"
    || file === "sentry.edge.config.ts"
    || file === "app/global-error.tsx"
    || file === "docs/MONITORING.md"
    || file === ".github/workflows/production-uptime-smoke.yml"
    || file.toLowerCase().includes("sentry")
  ) {
    return "observability";
  }

  if (file.startsWith("supabase/")) return "database";
  if (file.startsWith(".github/workflows/")) return "workflows";
  if (
    file.startsWith("app/")
    || file.startsWith("components/")
    || file.startsWith("lib/")
    || file.startsWith("public/")
  ) {
    return "runtime";
  }
  if (
    file === "package.json"
    || file === "package-lock.json"
    || file === "pnpm-lock.yaml"
    || file === "next.config.ts"
    || file === "tsconfig.json"
    || file === "eslint.config.mjs"
    || file.startsWith("scripts/")
  ) {
    return "tooling";
  }
  if (
    file.startsWith("docs/")
    || file === "AI_HANDOFF.md"
    || file === "AI_WORK_MANUAL.md"
    || file === ".env.example"
    || file === "env.example"
    || file.startsWith(".ai/")
  ) {
    return "docs";
  }
  return "other";
}

function isReleaseInfrastructureFile(file) {
  return (
    file.startsWith(".github/workflows/")
    || file.startsWith("scripts/")
    || file.startsWith("docs/")
    || file.startsWith(".ai/")
    || file.startsWith("app/release/")
    || file.startsWith("app/api/release/")
    || file.startsWith("app/api/health/source/")
    || file === "tests/release-dashboard.test.mjs"
    || file === "tests/release-source.test.mjs"
    || file === "lib/release-dashboard.ts"
    || file === "lib/release-dashboard-server.ts"
    || [
      "AI_HANDOFF.md",
      "AI_WORK_MANUAL.md",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "eslint.config.mjs",
    ].includes(file)
  );
}

function isReleaseInfrastructure(files) {
  return files.length > 0 && files.every(isReleaseInfrastructureFile);
}

export function analyzeReleaseScope(baseRef = "origin/main") {
  const statusEntries = lines(git(["status", "--porcelain=v1"]));
  const statusFiles = unique(statusEntries.map(normalizeStatusEntry));
  const prFiles = lines(git(["diff", "--name-only", `${baseRef}...HEAD`]));
  const workingTreeAreas = unique(statusFiles.map(classifyFile));
  const prAreas = unique(prFiles.map(classifyFile));
  const substantiveWorkingTreeAreas = workingTreeAreas.filter((area) => area !== "docs");
  const substantivePrAreas = prAreas.filter((area) => area !== "docs");
  const mixedWorkingTree = substantiveWorkingTreeAreas.length >= 3;
  const mixedPrScope = substantivePrAreas.length >= 3;
  const hasObservability =
    workingTreeAreas.includes("observability") || prAreas.includes("observability");
  const releaseInfrastructureWorkingTree = isReleaseInfrastructure(statusFiles);
  const releaseInfrastructurePr = isReleaseInfrastructure(prFiles);
  const safeReleaseInfrastructure = releaseInfrastructureWorkingTree || releaseInfrastructurePr;

  return {
    statusFiles,
    prFiles,
    workingTreeAreas,
    prAreas,
    hasObservability,
    riskyMixedScope:
      !safeReleaseInfrastructure && (
        (hasObservability && (mixedWorkingTree || mixedPrScope))
        || (mixedWorkingTree && statusFiles.length >= 8)
      ),
  };
}

export function formatReleaseScopeStop(scope) {
  const output = [];
  output.push("STOP: release scope is mixed enough that Codex should isolate the change in a clean worktree first.");
  output.push("");
  output.push(`Working tree areas: ${scope.workingTreeAreas.join(", ") || "none"}`);
  output.push(`PR areas: ${scope.prAreas.join(", ") || "none"}`);

  if (scope.hasObservability) {
    output.push("");
    output.push("Observability order:");
    output.push("  1. Isolate the monitoring change in a clean worktree or fresh branch.");
    output.push("  2. Verify local typecheck/build on that isolated scope.");
    output.push("  3. Merge the code to main.");
    output.push("  4. Confirm production reports that merged commit.");
    output.push("  5. Only then trigger the production smoke or synthetic error.");
  } else {
    output.push("");
    output.push("Create a clean worktree from origin/main and cherry-pick or reapply only the intended release files.");
  }

  return output.join("\n");
}
