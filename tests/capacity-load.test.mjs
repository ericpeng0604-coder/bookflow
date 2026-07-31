import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("capacity runner help is dependency-free and exposes all workload families", () => {
  const result = spawnSync(process.execPath, ["scripts/capacity-load.mjs", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  for (const workload of [
    "public-list",
    "public-search",
    "public-detail",
    "authenticated-profile",
    "authenticated-notifications",
    "authenticated-conversations",
    "purchase-request",
    "purchase-race",
    "realtime",
  ]) assert.match(result.stdout, new RegExp(workload));
});

test("capacity runner refuses an unconfigured target without sending requests", () => {
  const result = spawnSync(process.execPath, ["scripts/capacity-load.mjs"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CAPACITY_WORKLOAD/);
});
