#!/usr/bin/env node

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 10);
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

console.log(`Target URL: ${url}`);
console.log(`Target host: ${hostname}`);
console.log(`Concurrency: ${concurrency}`);

if (!confirmed) {
  console.error("Refusing to run: set LOAD_TEST_CONFIRM=yes after verifying this is staging or local.");
  process.exit(1);
}

if (!allowedHosts.includes(hostname)) {
  console.error(
    "Refusing to run: host is not allowlisted. Set LOAD_TEST_ALLOWED_HOSTS to the exact staging/local hostname.",
  );
  process.exit(1);
}

const endpoint = `${url}/rest/v1/rpc/list_books_page`;

async function runRequest(index) {
  const started = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_limit: 24,
      p_cursor_created: null,
      p_cursor_id: null,
      p_department: null,
      p_max_price: null,
      p_query: null,
    }),
  });
  const elapsed = performance.now() - started;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request ${index} failed (${response.status}): ${text}`);
  }
  await response.json();
  return elapsed;
}

const startedAt = performance.now();
const results = await Promise.allSettled(
  Array.from({ length: concurrency }, (_, index) => runRequest(index + 1)),
);
const totalMs = performance.now() - startedAt;
const fulfilled = results.filter((result) => result.status === "fulfilled");
const rejected = results.filter((result) => result.status === "rejected");
const durations = fulfilled.map((result) => result.value);
const avgMs = durations.length
  ? durations.reduce((sum, value) => sum + value, 0) / durations.length
  : 0;
const maxMs = durations.length ? Math.max(...durations) : 0;

console.log(`Concurrency: ${concurrency}`);
console.log(`Success: ${fulfilled.length}`);
console.log(`Failed: ${rejected.length}`);
console.log(`Total elapsed: ${totalMs.toFixed(0)} ms`);
console.log(`Average request: ${avgMs.toFixed(0)} ms`);
console.log(`Slowest request: ${maxMs.toFixed(0)} ms`);

if (rejected.length > 0) {
  console.error(rejected[0].reason);
  process.exit(1);
}
