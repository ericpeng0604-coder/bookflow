#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  importTypeScriptModule,
  nodeSupportsStripTypes,
  projectRoot,
} from "./lib/check-runner.mjs";

const emailSource = readFileSync(join(projectRoot, "lib/server/notification-email.ts"), "utf8");
const pushSource = readFileSync(join(projectRoot, "lib/server/notification-push.ts"), "utf8");

const designNotes = [
  "notification-email.ts: configuredAppUrl is pure and safe to unit test with env mocks.",
  "notification-email.ts: deliverNotificationEmails needs Supabase, Resend fetch, and claim/update loops; defer to integration tests with service mocks.",
  "notification-email.ts: escapeHtml is private; keep HTML escaping covered by static checks until a shared helper is exported.",
  "notification-push.ts: deliverBrowserPush configures VAPID and calls web-push; unsafe for unit tests without stubbing web-push and Supabase.",
  "notification-push.ts: notificationUrl is private; route selection should stay covered by static checks until extracted.",
];

for (const note of designNotes) {
  console.log(`DESIGN ${note}`);
}

const forbiddenRequestDerivedUrls = [
  /req\.headers\.get\(["']origin["']\)/i,
  /request\.headers\.get\(["']origin["']\)/i,
  /headers\(\)\.get\(["']host["']\)/i,
];

for (const [label, source] of [
  ["notification-email.ts", emailSource],
  ["notification-push.ts", pushSource],
]) {
  for (const pattern of forbiddenRequestDerivedUrls) {
    assert.ok(!pattern.test(source), `${label} must not build outbound URLs from request headers`);
  }
  assert.match(source, /process\.env\.APP_URL/, `${label} should read APP_URL from environment`);
}

assert.match(emailSource, /function escapeHtml/, "notification-email.ts should escape HTML before embedding notification content");
assert.match(emailSource, /escapeHtml\(notification\.title\)/, "notification-email.ts should escape notification titles");
assert.match(emailSource, /escapeHtml\(notification\.message\)/, "notification-email.ts should escape notification messages");
assert.match(emailSource, /escapeHtml\(appUrl\)/, "notification-email.ts should escape the configured app URL");
assert.match(emailSource, /EMAIL_NOTIFICATIONS_ENABLED === "true"/, "notification-email.ts should stay opt-in via EMAIL_NOTIFICATIONS_ENABLED");
assert.match(pushSource, /IMPORTANT_TYPES/, "notification-push.ts should filter to important notification types");
assert.match(pushSource, /WEB_PUSH_VAPID_PRIVATE_KEY/, "notification-push.ts should require VAPID configuration");
assert.match(pushSource, /No active browser subscription/, "notification-push.ts should skip notifications without subscriptions");

if (!nodeSupportsStripTypes()) {
  console.log("Notification delivery design checks passed (static-only; Node strip-types unavailable).");
  process.exit(0);
}

const previousAppUrl = process.env.APP_URL;
try {
  delete process.env.APP_URL;
  const { configuredAppUrl } = await importTypeScriptModule("lib/server/notification-email.ts");
  assert.equal(configuredAppUrl(), null);

  process.env.APP_URL = "https://bookflow.example.edu/";
  assert.equal(configuredAppUrl(), "https://bookflow.example.edu");

  process.env.APP_URL = "ftp://bookflow.example.edu";
  assert.equal(configuredAppUrl(), null);

  process.env.APP_URL = "not-a-url";
  assert.equal(configuredAppUrl(), null);
} finally {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
}

console.log("Notification delivery design checks passed (static + configuredAppUrl).");
