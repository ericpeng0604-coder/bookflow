#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");

const checks = [
  ["active request lookup has an independent timeout", /function withTimeout[\s\S]*?Promise\.race\(\[promise, timeout\]\)/.test(queries) && /fetchActiveRequestForBook[\s\S]*?withTimeout\(/.test(queries)],
  ["active request check has a bounded UI recovery", /activeRequestCheckStartedRef[\s\S]*?window\.setTimeout\([\s\S]*?setActiveRequestCheckState\("error"\)/.test(app)],
  ["active request check does not restart on object identity changes", /\[activeRequestCheckRetry, currentUser\?\.id, selectedBook\?\.id, selectedBook\?\.sellerId, selectedBookActiveRequest\?\.id, view\]/.test(app) && !/setActiveRequestCheckKey/.test(app)],
  ["active request retry restarts through a separate nonce", /activeRequestCheckStartedRef\.current = null[\s\S]*?setActiveRequestCheckRetry\(\(retry\) => retry \+ 1\)/.test(app)],
  ["request lookup errors expose retry", /!\["ready", "error"\]\.includes\(activeRequestCheckState\)[\s\S]*?activeRequestCheckState === "error"[\s\S]*?setActiveRequestCheckState\("idle"\)/.test(app)],
  ["request submission has duplicate guard and finally reset", /requestSavingRef\.current = true[\s\S]*?finally \{[\s\S]*?requestSavingRef\.current = false[\s\S]*?setRequestSaving\(false\)/.test(app)],
  ["request form disables duplicate submission", /<RequestModal[\s\S]*?saving=\{requestSaving\}/.test(app) && /disabled=\{!versionConfirmed \|\| saving\}/.test(app)],
  ["auth verification resets loading in finally", /const message = await onVerify\(code\)[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/.test(app)],
  ["login resets loading in finally", /const message = await onLogin\(email\.trim\(\), password\)[\s\S]*?finally \{[\s\S]*?setLoading\(false\)/.test(app)],
];

const failures = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
if (failures.length > 0) process.exit(1);
console.log(`Transaction loading checks passed (${checks.length}/${checks.length}).`);
