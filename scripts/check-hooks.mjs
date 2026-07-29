#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hooksPath = resolve(".codex/hooks.json");
const hooks = JSON.parse(readFileSync(hooksPath, "utf8"));
const serialized = JSON.stringify(hooks);

assert.doesNotMatch(
  serialized,
  /agentcraft|node_modules|[A-Za-z]:[\\/]|https?:\/\//i,
  "project hooks must not invoke unreviewed external packages, absolute paths, or remote URLs",
);

const allowedEvents = new Set(["SessionStart", "Stop"]);
for (const eventName of Object.keys(hooks.hooks ?? {})) {
  assert.ok(allowedEvents.has(eventName), `unexpected project hook event: ${eventName}`);
}

for (const eventName of allowedEvents) {
  for (const group of hooks.hooks?.[eventName] ?? []) {
    for (const hook of group.hooks ?? []) {
      assert.equal(hook.type, "command", `${eventName} hooks must use command hooks`);
      assert.match(hook.command ?? "", /scripts[\\/]ai-collaboration\.mjs/);
    }
  }
}

console.log("project hook security contract passed");
