#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const workloads = new Set([
  "public-list",
  "public-search",
  "public-detail",
  "authenticated-profile",
  "authenticated-notifications",
  "authenticated-conversations",
  "purchase-request",
  "purchase-race",
  "realtime",
]);

const workload = process.env.CAPACITY_WORKLOAD || "";
const targetLabel = process.env.CAPACITY_TARGET_LABEL || "";
const baseUrl = process.env.CAPACITY_SUPABASE_URL || "";
const anonKey = process.env.CAPACITY_SUPABASE_ANON_KEY || "";
const allowedHosts = new Set(
  (process.env.CAPACITY_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const confirmed = process.env.CAPACITY_CONFIRM === "yes";
const confirmMutations = process.env.CAPACITY_CONFIRM_MUTATIONS === "yes";
const concurrency = positiveInt("CAPACITY_CONCURRENCY", 1);
const durationSeconds = positiveInt("CAPACITY_DURATION_SECONDS", 30);
const timeoutMs = positiveInt("CAPACITY_REQUEST_TIMEOUT_MS", 10_000);
const bookId = process.env.CAPACITY_BOOK_ID || "";
const profileId = process.env.CAPACITY_PROFILE_ID || "";
const conversationId = process.env.CAPACITY_CONVERSATION_ID || "";
const tokens = parseTokens(process.env.CAPACITY_ACCESS_TOKENS_JSON || "");
const outputFile = process.env.CAPACITY_OUTPUT_FILE || "";

function positiveInt(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function parseTokens(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("CAPACITY_ACCESS_TOKENS_JSON must be a JSON array");
  }
  if (!Array.isArray(parsed) || parsed.some((token) => typeof token !== "string" || !token.trim())) {
    throw new Error("CAPACITY_ACCESS_TOKENS_JSON must contain non-empty strings");
  }
  return parsed.map((token) => token.trim());
}

function percentile(values, ratio) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)].toFixed(2));
}

function getCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "NOT VERIFIED";
  }
}

function validateConfig() {
  if (!workloads.has(workload)) throw new Error(`CAPACITY_WORKLOAD must be one of: ${[...workloads].join(", ")}`);
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("CAPACITY_SUPABASE_URL must be an explicit https:// non-production target");
  const parsed = new URL(baseUrl);
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("Target host is not in CAPACITY_ALLOWED_HOSTS; refusing to load test an unverified environment");
  }
  if (!anonKey) throw new Error("CAPACITY_SUPABASE_ANON_KEY is required and is never printed");
  if (!confirmed) throw new Error("Set CAPACITY_CONFIRM=yes only after verifying targetLabel is local, isolated, or staging");
  if (!["local", "isolated", "staging"].includes(targetLabel)) {
    throw new Error("CAPACITY_TARGET_LABEL must be local, isolated, or staging");
  }
  if (["authenticated-profile", "authenticated-notifications", "authenticated-conversations", "purchase-request", "purchase-race", "realtime"].includes(workload) && tokens.length === 0) {
    throw new Error("Authenticated workloads require synthetic staging access tokens in CAPACITY_ACCESS_TOKENS_JSON");
  }
  if (["public-detail", "purchase-request", "purchase-race"].includes(workload) && !bookId) {
    throw new Error("This workload requires CAPACITY_BOOK_ID for a synthetic test listing");
  }
  if (workload === "authenticated-profile" && !profileId) {
    throw new Error("authenticated-profile requires CAPACITY_PROFILE_ID");
  }
  if (workload === "realtime" && !conversationId) {
    throw new Error("realtime requires CAPACITY_CONVERSATION_ID for a synthetic test conversation");
  }
  if (["purchase-request", "purchase-race"].includes(workload) && !confirmMutations) {
    throw new Error("Purchase load is mutating; set CAPACITY_CONFIRM_MUTATIONS=yes for a synthetic staging listing only");
  }
  if (workload === "purchase-race" && tokens.length < 2) {
    throw new Error("purchase-race requires at least two distinct synthetic access tokens");
  }
}

function authHeaders(token) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    "Content-Type": "application/json",
  };
}

async function request(path, options = {}, token = "") {
  const started = performance.now();
  let status = null;
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      ...options,
      headers: { ...authHeaders(token), ...(options.headers || {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    status = response.status;
    await response.arrayBuffer();
    return { ok: response.ok, status, durationMs: performance.now() - started, error: null };
  } catch (error) {
    return {
      ok: false,
      status,
      durationMs: performance.now() - started,
      error: error?.name === "TimeoutError" ? "timeout" : error instanceof Error ? error.name : "NetworkError",
    };
  }
}

function rpc(name, body, token) {
  return request(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

async function runHttpWorkload(token, workerIndex) {
  switch (workload) {
    case "public-list":
      return rpc("list_books_page", {
        p_limit: 25,
        p_cursor_created: null,
        p_cursor_id: null,
        p_listing_type: "book",
        p_item_category: null,
        p_department: null,
        p_min_price: null,
        p_max_price: null,
        p_query: null,
        p_cursor_verified: null,
      });
    case "public-search":
      return rpc("list_books_page", {
        p_limit: 25,
        p_cursor_created: null,
        p_cursor_id: null,
        p_listing_type: "book",
        p_item_category: null,
        p_department: null,
        p_min_price: null,
        p_max_price: null,
        p_query: process.env.CAPACITY_SEARCH_TERM || "capacity-test",
        p_cursor_verified: null,
      });
    case "public-detail":
      return request(`/rest/v1/books?id=eq.${encodeURIComponent(bookId)}&select=id,title,author,price,status`, {}, token);
    case "authenticated-profile":
      return request(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}&select=id,name,department`, {}, token);
    case "authenticated-notifications":
      return rpc("count_my_unread_notifications", {}, token);
    case "authenticated-conversations":
      return rpc("list_my_conversations_page", {
        p_limit: 30,
        p_cursor_last_message_at: null,
        p_cursor_id: null,
      }, token);
    case "purchase-request":
    case "purchase-race":
      return rpc("create_purchase_request", {
        target_book_id: bookId,
        request_message: `capacity-test-${workerIndex}`,
        preferred_meetup_location: "capacity-test",
        preferred_meetup_time: "capacity-test",
      }, token);
    default:
      throw new Error(`Unsupported HTTP workload: ${workload}`);
  }
}

function realtimeJoin(token) {
  if (typeof WebSocket !== "function") {
    return Promise.resolve({ ok: false, status: null, durationMs: 0, error: "WebSocketUnavailable" });
  }
  const started = performance.now();
  const host = new URL(baseUrl).hostname;
  const socket = new WebSocket(`wss://${host}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.close();
      resolve({ ok: false, status: null, durationMs: performance.now() - started, error: "timeout" });
    }, timeoutMs);
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        topic: `realtime:trade-chat:${conversationId}`,
        event: "phx_join",
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { key: "" },
            postgres_changes: [{ event: "*", schema: "public", table: "trade_messages", filter: `conversation_id=eq.${conversationId}` }],
            private: false,
          },
          access_token: token,
        },
        ref: "1",
      }));
    });
    socket.addEventListener("message", (event) => {
      let payload;
      try { payload = JSON.parse(String(event.data)); } catch { return; }
      if (payload.event !== "phx_reply") return;
      clearTimeout(timer);
      socket.close();
      const ok = payload.payload?.response?.status === "ok";
      resolve({ ok, status: ok ? 101 : 403, durationMs: performance.now() - started, error: ok ? null : "RealtimeJoinRejected" });
    });
    socket.addEventListener("error", () => {
      clearTimeout(timer);
      socket.close();
      resolve({ ok: false, status: null, durationMs: performance.now() - started, error: "RealtimeSocketError" });
    });
  });
}

async function worker(workerIndex, deadline, records) {
  while (performance.now() < deadline) {
    const token = tokens.length ? tokens[workerIndex % tokens.length] : "";
    const result = workload === "realtime" ? await realtimeJoin(token) : await runHttpWorkload(token, workerIndex);
    records.push(result);
  }
}

function summarize(records, startedAt, endedAt) {
  const durations = records.map((record) => record.durationMs);
  const errors = records.filter((record) => !record.ok);
  const byStatus = {};
  for (const record of records) {
    const key = record.status === null ? "network" : String(record.status);
    byStatus[key] = (byStatus[key] || 0) + 1;
  }
  const timeouts = errors.filter((record) => record.error === "timeout").length;
  const http429 = records.filter((record) => record.status === 429).length;
  const http5xx = records.filter((record) => record.status !== null && record.status >= 500).length;
  const elapsedSeconds = Math.max((endedAt - startedAt) / 1000, 0.001);
  const errorRate = records.length ? errors.length / records.length : 1;
  const isWrite = workload.startsWith("purchase-");
  const p95 = percentile(durations, 0.95);
  const sloMs = isWrite ? 1500 : 750;
  return {
    workload,
    target: { label: targetLabel, host: new URL(baseUrl).hostname },
    commit: getCommit(),
    dataset: {
      label: process.env.CAPACITY_DATASET_LABEL || "NOT VERIFIED",
      books: process.env.CAPACITY_BOOK_COUNT || "NOT VERIFIED",
      users: process.env.CAPACITY_USER_COUNT || "NOT VERIFIED",
      conversations: process.env.CAPACITY_CONVERSATION_COUNT || "NOT VERIFIED",
    },
    conditions: { concurrency, durationSeconds, timeoutMs },
    requests: {
      total: records.length,
      successful: records.filter((record) => record.ok).length,
      failed: errors.length,
      rps: Number((records.length / elapsedSeconds).toFixed(2)),
      p50Ms: percentile(durations, 0.5),
      p95Ms: p95,
      p99Ms: percentile(durations, 0.99),
      timeout: timeouts,
      http429,
      http5xx,
      httpErrorRate: Number((errorRate * 100).toFixed(3)),
      byStatus,
    },
    stableCandidate: Boolean(p95 !== null && p95 <= sloMs && errorRate < 0.01),
    databaseEvidence: "NOT VERIFIED: capture Supabase slow-query, lock, Realtime-limit, and pool-connection evidence for this same time window",
  };
}

function writeResult(result) {
  if (!outputFile) return;
  mkdirSync(dirname(outputFile), { recursive: true });
  appendFileSync(outputFile, `${JSON.stringify(result)}\n`, { encoding: "utf8" });
}

if (process.argv.includes("--help")) {
  console.log("Run one explicit workload with CAPACITY_TARGET_LABEL, CAPACITY_SUPABASE_URL, CAPACITY_SUPABASE_ANON_KEY, CAPACITY_ALLOWED_HOSTS, and CAPACITY_CONFIRM=yes.");
  console.log(`Workloads: ${[...workloads].join(", ")}`);
  process.exit(0);
}

try {
  validateConfig();
  const records = [];
  const startedAt = performance.now();
  const deadline = startedAt + durationSeconds * 1000;
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index, deadline, records)));
  const result = summarize(records, startedAt, performance.now());
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
  if (!result.stableCandidate) process.exitCode = 2;
} catch (error) {
  console.error(`CAPACITY LOAD NOT RUN: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
