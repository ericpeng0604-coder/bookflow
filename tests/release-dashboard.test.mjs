import assert from "node:assert/strict";
import test from "node:test";
import {
  RELEASE_DASHBOARD_COMMANDS,
  RELEASE_DASHBOARD_STAGES,
  createDashboardJob,
  summarizeDashboardLine,
} from "../lib/release-dashboard.ts";

test("dashboard exposes a finite, allowlisted release sequence", () => {
  assert.deepEqual(RELEASE_DASHBOARD_STAGES.map((stage) => stage.id), ["source", "contracts", "tests", "quality"]);
  for (const stage of RELEASE_DASHBOARD_STAGES) {
    assert.ok(RELEASE_DASHBOARD_COMMANDS[stage.id].length > 0);
    for (const command of RELEASE_DASHBOARD_COMMANDS[stage.id]) {
      assert.equal(command.args[0].includes(";"), false);
      assert.equal(command.args.includes("--shell"), false);
    }
  }
});

test("dashboard starts with readable pending stages", () => {
  const job = createDashboardJob("test-job");
  assert.equal(job.id, "test-job");
  assert.equal(job.state, "running");
  assert.deepEqual(job.stages.map((stage) => stage.status), ["pending", "pending", "pending", "pending"]);
});

test("dashboard log lines stay concise", () => {
  assert.equal(summarizeDashboardLine("  a   readable   line  "), "a readable line");
  assert.equal(summarizeDashboardLine("x".repeat(20), 10), `${"x".repeat(9)}…`);
});
