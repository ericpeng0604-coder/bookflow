import { spawn } from "node:child_process";
import process from "node:process";
import { NextResponse } from "next/server";
import {
  RELEASE_DASHBOARD_COMMANDS,
  createDashboardStages,
  type ReleaseDashboardEvent,
  type ReleaseDashboardJob,
  type ReleaseStageId,
} from "@/lib/release-dashboard";
import { dashboardEnabled, getDashboardStore } from "@/lib/release-dashboard-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENTS = 500;
const MAX_LINE_LENGTH = 240;

function now() {
  return new Date().toISOString();
}

function addEvent(job: ReleaseDashboardJob, event: Omit<ReleaseDashboardEvent, "at">) {
  job.events.push({ at: now(), ...event });
  if (job.events.length > MAX_EVENTS) job.events.splice(0, job.events.length - MAX_EVENTS);
}

function setStage(job: ReleaseDashboardJob, stageId: ReleaseStageId, status: "running" | "passed" | "failed" | "skipped", exitCode?: number | null) {
  const stage = job.stages.find((item) => item.id === stageId);
  if (!stage) return;
  stage.status = status;
  if (status === "running") stage.startedAt = now();
  else {
    stage.finishedAt = now();
    stage.exitCode = exitCode;
  }
}

function appendOutput(job: ReleaseDashboardJob, stageId: ReleaseStageId, kind: "stdout" | "stderr", chunk: Buffer | string) {
  const lines = String(chunk).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    addEvent(job, { stageId, kind, message: line.replace(/\s+/g, " ").slice(0, MAX_LINE_LENGTH) });
  }
}

function runCommand(job: ReleaseDashboardJob, stageId: ReleaseStageId, label: string, args: string[]) {
  return new Promise<number>((resolve) => {
    addEvent(job, { stageId, kind: "info", message: `執行：${label}` });
    const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, windowsHide: true });
    child.stdout.on("data", (chunk) => appendOutput(job, stageId, "stdout", chunk));
    child.stderr.on("data", (chunk) => appendOutput(job, stageId, "stderr", chunk));
    child.on("error", (error) => {
      addEvent(job, { stageId, kind: "error", message: `無法啟動：${error.message}` });
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function runJob(job: ReleaseDashboardJob) {
  addEvent(job, { kind: "info", message: "本機檢查開始；production 仍由 GitHub Actions 負責。" });

  for (const stage of job.stages) {
    job.currentStage = stage.id;
    setStage(job, stage.id, "running");
    addEvent(job, { stageId: stage.id, kind: "info", message: stage.description });

    let exitCode = 0;
    for (const command of RELEASE_DASHBOARD_COMMANDS[stage.id]) {
      exitCode = await runCommand(job, stage.id, command.label, command.args);
      if (exitCode !== 0) break;
    }

    if (exitCode !== 0) {
      setStage(job, stage.id, "failed", exitCode);
      addEvent(job, { stageId: stage.id, kind: "error", message: `停止：${stage.label} 失敗（exit ${exitCode}）。` });
      for (const remaining of job.stages) {
        if (remaining.status === "pending") setStage(job, remaining.id, "skipped");
      }
      job.state = "failed";
      job.finishedAt = now();
      delete job.currentStage;
      return;
    }

    setStage(job, stage.id, "passed", exitCode);
    addEvent(job, { stageId: stage.id, kind: "success", message: `${stage.label} 完成。` });
  }

  job.state = "passed";
  job.finishedAt = now();
  delete job.currentStage;
  addEvent(job, { kind: "success", message: "所有本機檢查完成。接著仍需用完整 SHA 走 GitHub Actions production release。" });
}

export async function POST() {
  if (!dashboardEnabled()) {
    return NextResponse.json({ status: "unavailable" }, { status: 404 });
  }

  const store = getDashboardStore();
  if (store.job?.state === "running") {
    return NextResponse.json({ status: "running", job: store.job }, { status: 409 });
  }

  const job: ReleaseDashboardJob = {
    id: `local-${Date.now()}`,
    state: "running",
    startedAt: now(),
    stages: createDashboardStages(),
    events: [],
  };
  store.job = job;
  void runJob(job);
  return NextResponse.json({ status: "started", job }, { status: 202 });
}
