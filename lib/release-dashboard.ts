export const RELEASE_DASHBOARD_STAGES = [
  {
    id: "source",
    label: "來源指紋",
    description: "確認這個 server 是目前工作區，不是舊的 Next process。",
  },
  {
    id: "contracts",
    label: "Release 合約",
    description: "檢查 memory、workflow、release flow 與 SHA 防護規則。",
  },
  {
    id: "tests",
    label: "專案測試",
    description: "執行 tests/ 裡的自動化測試，確認規則沒有被破壞。",
  },
  {
    id: "quality",
    label: "型別與 lint",
    description: "執行 TypeScript typecheck 與 ESLint。",
  },
] as const;

export type ReleaseStageId = (typeof RELEASE_DASHBOARD_STAGES)[number]["id"];
export type ReleaseStageStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type ReleaseDashboardStage = {
  id: ReleaseStageId;
  label: string;
  description: string;
  status: ReleaseStageStatus;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number | null;
};

export type ReleaseDashboardEvent = {
  at: string;
  stageId?: ReleaseStageId;
  kind: "info" | "stdout" | "stderr" | "success" | "error";
  message: string;
};

export type ReleaseDashboardJob = {
  id: string;
  state: "idle" | "running" | "passed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  currentStage?: ReleaseStageId;
  stages: ReleaseDashboardStage[];
  events: ReleaseDashboardEvent[];
};

type DashboardCommand = { label: string; args: string[] };

export const RELEASE_DASHBOARD_COMMANDS: Record<ReleaseStageId, DashboardCommand[]> = {
  source: [
    { label: "release-source current", args: ["scripts/release-source.mjs", "current"] },
  ],
  contracts: [
    { label: "check-release-source", args: ["scripts/check-release-source.mjs"] },
    { label: "check-release-flow", args: ["scripts/check-release-flow.mjs"] },
    { label: "check-workflows", args: ["scripts/check-workflows.mjs"] },
    { label: "check-memory", args: ["scripts/check-memory.mjs"] },
  ],
  tests: [
    { label: "project tests", args: ["--experimental-strip-types", "--test", "tests/*.test.mjs"] },
  ],
  quality: [
    { label: "typecheck", args: ["node_modules/typescript/bin/tsc", "--noEmit"] },
    { label: "lint", args: ["node_modules/eslint/bin/eslint.js", "."] },
  ],
};

export function createDashboardStages(): ReleaseDashboardStage[] {
  return RELEASE_DASHBOARD_STAGES.map((stage) => ({
    ...stage,
    status: "pending",
  }));
}

export function createDashboardJob(id = `local-${Date.now()}`): ReleaseDashboardJob {
  return {
    id,
    state: "running",
    startedAt: new Date().toISOString(),
    stages: createDashboardStages(),
    events: [],
  };
}

export function summarizeDashboardLine(line: string, maxLength = 240): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}
