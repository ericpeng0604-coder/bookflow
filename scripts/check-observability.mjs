#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const baseUrl = (process.env.RELEASE_BASE_URL || "https://bookflow-green.vercel.app").replace(/\/+$/, "");
const requireSentry = process.argv.includes("--require-sentry");
const globalError = fs.readFileSync("app/global-error.tsx", "utf8");
const nextConfig = fs.readFileSync("next.config.ts", "utf8");

assert.match(globalError, /Sentry\.captureException/, "global error boundary must report to Sentry");
assert.match(nextConfig, /withSentryConfig/, "Next.js must be wrapped with Sentry build/runtime configuration");

const health = await fetch(`${baseUrl}/api/health/release`, { signal: AbortSignal.timeout(15_000) });
const healthBody = await health.json().catch(() => ({}));
assert.equal(health.status, 200, `release health returned HTTP ${health.status}`);
assert.equal(healthBody.status, "ok", "release health did not return status=ok");

const homepage = await fetch(baseUrl, { signal: AbortSignal.timeout(15_000) });
const csp = homepage.headers.get("content-security-policy") || "";
const sentryInCsp = /sentry|ingest/i.test(csp);
const localDsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

if (!sentryInCsp) {
  const message = "Production CSP does not expose a Sentry ingest origin.";
  if (requireSentry) throw new Error(message);
  console.warn(`NOT VERIFIED: ${message}`);
} else {
  console.log("Production Sentry ingest origin is present in CSP.");
}

if (!localDsnConfigured) {
  const message = "Local NEXT_PUBLIC_SENTRY_DSN is not configured; Vercel production env still needs manual confirmation.";
  if (requireSentry) throw new Error(message);
  console.warn(`NOT VERIFIED: ${message}`);
} else {
  console.log("Local Sentry DSN is configured.");
}

console.log(`Observability health passed for ${baseUrl}.`);
