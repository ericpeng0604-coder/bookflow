#!/usr/bin/env node

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const maxConcurrency = Math.max(1, Number(process.env.LOAD_TEST_CONCURRENCY || 10));
const durationSeconds = Math.max(10, Number(process.env.LOAD_TEST_DURATION_SECONDS || 60));
const rampSteps = Math.max(1, Number(process.env.LOAD_TEST_RAMP_STEPS || 4));
const confirmed = process.env.LOAD_TEST_CONFIRM === "yes";
const allowedHosts = (process.env.LOAD_TEST_ALLOWED_HOSTS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (!url || !anonKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before running.");
  process.exit(1);
}

let hostname = "";
try {
  hostname = new URL(url).hostname;
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

if (!confirmed) {
  console.error("Refusing to run: set LOAD_TEST_CONFIRM=yes after verifying this is staging or local.");
  process.exit(1);
}
if (!allowedHosts.includes(hostname)) {
  console.error("Refusing to run: target host is not in LOAD_TEST_ALLOWED_HOSTS.");
  process.exit(1);
}

const endpoint = `${url}/rest/v1/rpc/list_books_page`;
const requestBody = JSON.stringify({
  p_limit: 25,
  p_cursor_created: null,
  p_cursor_id: null,
  p_department: null,
  p_max_price: null,
  p_query: null,
});
const durations = [];
const errors = new Map();
let completed = 0;
let stopped = false;

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function runRequest() {
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });
    const elapsed = performance.now() - started;
    if (!response.ok) {
      const key = `HTTP ${response.status}`;
      errors.set(key, (errors.get(key) || 0) + 1);
      await response.text();
      return;
    }
    await response.json();
    durations.push(elapsed);
  } catch (error) {
    const key = error instanceof Error ? error.name : "NetworkError";
    errors.set(key, (errors.get(key) || 0) + 1);
  } finally {
    completed += 1;
  }
}

async function worker() {
  while (!stopped) await runRequest();
}

const startedAt = performance.now();
const workers = [];
const stepDurationMs = durationSeconds * 1000 / rampSteps;
console.log(`Target: ${hostname}`);
console.log(`Ramp: ${rampSteps} steps to ${maxConcurrency} workers over ${durationSeconds}s`);

for (let step = 1; step <= rampSteps; step += 1) {
  const targetWorkers = Math.max(1, Math.ceil(maxConcurrency * step / rampSteps));
  while (workers.length < targetWorkers) workers.push(worker());
  console.log(`Step ${step}/${rampSteps}: ${targetWorkers} workers`);
  await new Promise((resolve) => setTimeout(resolve, stepDurationMs));
}

stopped = true;
await Promise.all(workers);
const totalSeconds = (performance.now() - startedAt) / 1000;
const failed = [...errors.values()].reduce((sum, value) => sum + value, 0);
const successful = durations.length;
const errorRate = completed ? failed / completed * 100 : 100;

console.log(`Requests: ${completed} total, ${successful} successful, ${failed} failed`);
console.log(`Throughput: ${(successful / totalSeconds).toFixed(2)} req/s`);
console.log(`Latency p50/p95/p99: ${percentile(durations, 0.5).toFixed(0)} / ${percentile(durations, 0.95).toFixed(0)} / ${percentile(durations, 0.99).toFixed(0)} ms`);
console.log(`Error rate: ${errorRate.toFixed(2)}%`);
if (errors.size > 0) console.log(`Errors: ${JSON.stringify(Object.fromEntries(errors))}`);

if (errorRate >= 1 || percentile(durations, 0.95) > 1500) process.exit(1);
