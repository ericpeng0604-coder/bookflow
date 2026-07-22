import ReleaseDashboard from "./release-dashboard";
import styles from "./release.module.css";

export const dynamic = "force-dynamic";

export default function ReleasePage() {
  if (
    process.env.BOOKFLOW_SOURCE_MODE !== "workspace" ||
    process.env.BOOKFLOW_RELEASE_DASHBOARD_ENABLED !== "true"
  ) {
    return (
      <main className={styles.unavailable}>
        <span className={styles.eyebrow}>BOOKFLOW LOCAL TOOL</span>
        <h1>Release 操作台目前未開啟</h1>
        <p>請用 <code>npm run dev</code> 或 <code>npm run dev:codex</code> 啟動目前工作區，再開啟這個頁面。</p>
      </main>
    );
  }

  return <ReleaseDashboard />;
}
