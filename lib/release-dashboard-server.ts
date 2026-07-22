import type { ReleaseDashboardJob } from "./release-dashboard";

export type ReleaseDashboardStore = { job: ReleaseDashboardJob | null };

declare global {
  var __bookflowReleaseDashboard: ReleaseDashboardStore | undefined;
}

export function dashboardEnabled() {
  return (
    process.env.BOOKFLOW_SOURCE_MODE === "workspace" &&
    process.env.BOOKFLOW_RELEASE_DASHBOARD_ENABLED === "true"
  );
}

export function getDashboardStore(): ReleaseDashboardStore {
  globalThis.__bookflowReleaseDashboard ??= { job: null };
  return globalThis.__bookflowReleaseDashboard;
}
