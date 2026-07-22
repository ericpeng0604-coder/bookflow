"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReleaseDashboardJob } from "@/lib/release-dashboard";
import styles from "./release.module.css";

type SourceState = {
  status: string;
  mode?: string;
  commit?: string;
  dirty?: boolean;
  fingerprint?: string;
  message?: string;
};

const githubWorkflowUrl = "https://github.com/ericpeng0604-coder/bookflow/actions/workflows/release-production.yml";

function short(value?: string, size = 12) {
  return value ? `${value.slice(0, size)}…` : "—";
}

function formatTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusText(status: string) {
  return { pending: "等待中", running: "執行中", passed: "通過", failed: "失敗", skipped: "略過" }[status] ?? status;
}

export default function ReleaseDashboard() {
  const [source, setSource] = useState<SourceState | null>(null);
  const [job, setJob] = useState<ReleaseDashboardJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [sourceResponse, statusResponse] = await Promise.all([
        fetch("/api/health/source", { cache: "no-store" }),
        fetch("/api/release/status", { cache: "no-store" }),
      ]);
      const sourceData = (await sourceResponse.json()) as SourceState;
      const statusData = (await statusResponse.json()) as { job?: ReleaseDashboardJob };
      setSource(sourceData);
      setJob(statusData.job ?? null);
      setError(sourceResponse.ok && statusResponse.ok ? "" : sourceData.message ?? "本機操作台尚未就緒");
    } catch {
      setError("無法連線到本機 server，請確認 dev server 仍在執行。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (job?.state !== "running") return undefined;
    const timer = window.setInterval(() => void load(), 1000);
    return () => window.clearInterval(timer);
  }, [job?.state, load]);

  async function startChecks() {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/release/run", { method: "POST" });
      const data = (await response.json()) as { job?: ReleaseDashboardJob; error?: string };
      if (!response.ok && response.status !== 202) throw new Error(data.error ?? "檢查無法啟動");
      setJob(data.job ?? null);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "檢查無法啟動");
    } finally {
      setStarting(false);
    }
  }

  const lastEvents = useMemo(() => job?.events.slice(-80) ?? [], [job?.events]);
  const isRunning = job?.state === "running";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>BOOKFLOW LOCAL TOOL / RELEASE</span>
          <h1>Release 操作台</h1>
          <p>把原本看不懂的腳本流程，整理成可以逐步閱讀的本機檢查流程。</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.primaryButton} onClick={startChecks} disabled={starting || isRunning}>
            {isRunning ? "檢查執行中…" : starting ? "準備中…" : "開始本機檢查"}
          </button>
          <button className={styles.secondaryButton} onClick={() => void load()} disabled={loading || isRunning}>
            重新讀取來源
          </button>
        </div>
      </section>

      {error ? <div className={styles.alert} role="alert">{error}</div> : null}

      <section className={styles.sourceCard} aria-labelledby="source-title">
        <div className={styles.cardHeading}>
          <div><span className={styles.cardKicker}>STEP 0</span><h2 id="source-title">我現在測試的是哪一份程式？</h2></div>
          <span className={`${styles.badge} ${source?.status === "ok" ? styles.good : styles.warn}`}>{source?.status === "ok" ? "SOURCE OK" : "SOURCE UNKNOWN"}</span>
        </div>
        <div className={styles.sourceGrid}>
          <div><span>Commit</span><code title={source?.commit}>{short(source?.commit, 16)}</code></div>
          <div><span>Fingerprint</span><code title={source?.fingerprint}>{short(source?.fingerprint, 16)}</code></div>
          <div><span>工作區</span><strong>{source?.dirty ? "有變更（已納入指紋）" : "乾淨"}</strong></div>
          <div><span>模式</span><strong>{source?.mode ?? "—"}</strong></div>
        </div>
        <p className={styles.explain}>這個 fingerprint 是目前工作區的「版本指紋」。如果你修改程式卻沒有重啟 server，下一次本機檢查會直接標記 <b>NOT LATEST</b>。</p>
      </section>

      <section className={styles.workflow} aria-labelledby="workflow-title">
        <div className={styles.sectionHeading}><div><span className={styles.cardKicker}>LOCAL VERIFICATION</span><h2 id="workflow-title">檢查進度</h2></div><span className={styles.runTime}>{job ? `${job.state === "running" ? "進行中" : "上次執行"} ${formatTime(job.finishedAt ?? job.startedAt)}` : "尚未執行"}</span></div>
        <div className={styles.steps}>
          {(job?.stages ?? [
            { id: "source", label: "來源指紋", description: "先確認 server 來源。", status: "pending" },
            { id: "contracts", label: "Release 合約", description: "檢查 release 防護。", status: "pending" },
            { id: "tests", label: "專案測試", description: "執行自動化測試。", status: "pending" },
            { id: "quality", label: "型別與 lint", description: "確認程式品質。", status: "pending" },
          ]).map((stage, index) => (
            <article className={`${styles.step} ${styles[stage.status]}`} key={stage.id}>
              <div className={styles.stepNumber}>{stage.status === "passed" ? "✓" : stage.status === "failed" ? "!" : index + 1}</div>
              <div className={styles.stepBody}><div className={styles.stepTitle}><h3>{stage.label}</h3><span>{statusText(stage.status)}</span></div><p>{stage.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.logCard} aria-labelledby="log-title">
        <div className={styles.sectionHeading}><div><span className={styles.cardKicker}>LIVE OUTPUT</span><h2 id="log-title">發生了什麼？</h2></div><span className={styles.liveDot}>{isRunning ? "● LIVE" : "● READY"}</span></div>
        <div className={styles.log} aria-live="polite">
          {lastEvents.length ? lastEvents.map((event, index) => <div className={styles.logLine} key={`${event.at}-${index}`}><time>{formatTime(event.at)}</time><span className={styles[`log_${event.kind}`]}>[{event.kind}]</span><span>{event.message}</span></div>) : <p className={styles.emptyLog}>按下「開始本機檢查」後，這裡會逐行顯示腳本正在做什麼。</p>}
        </div>
      </section>

      <section className={styles.productionCard}>
        <div><span className={styles.cardKicker}>PRODUCTION</span><h2>要正式發布時怎麼做？</h2><p>本機操作台只負責讓你看懂與驗證流程；production 仍然要輸入完整 40 碼 SHA，交給 GitHub Actions 做 approval、migration、deployment 與 smoke。</p></div>
        <a className={styles.secondaryButton} href={githubWorkflowUrl} target="_blank" rel="noreferrer">開啟 GitHub Release</a>
      </section>
    </main>
  );
}
