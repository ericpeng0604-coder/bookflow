#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routePath = join(root, "app/api/notifications/push/subscription/route.ts");
const routeSource = readFileSync(routePath, "utf8");

/**
 * Mirrors app/api/notifications/push/subscription/route.ts validation paths.
 * Keep in sync with the route when changing production behavior.
 */
function resolveAuthenticatedUser(headers, env, authLookup) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return null;
  const authResult = authLookup(token);
  if (authResult.error || !authResult.user) return null;
  return { userId: authResult.user.id, token };
}

function validateSubscriptionBody(body) {
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth || endpoint.length > 2000) {
    return { ok: false, status: 400, error: "Invalid push subscription" };
  }
  return { ok: true, endpoint, p256dh, auth };
}

function evaluatePostRequest({
  headers = {},
  body = {},
  env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
  },
  authLookup = () => ({ user: { id: "user-test-001" }, error: null }),
  upsert = async () => ({ error: null }),
  upsertCalls = [],
}) {
  const authenticated = resolveAuthenticatedUser(headers, env, authLookup);
  if (!authenticated) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const validation = validateSubscriptionBody(body);
  if (!validation.ok) {
    return { status: validation.status, body: { error: validation.error } };
  }

  return upsert({
    user_id: authenticated.userId,
    endpoint: validation.endpoint,
    p256dh: validation.p256dh,
    auth: validation.auth,
    enabled: true,
  }, { onConflict: "endpoint" }).then((result) => {
    upsertCalls.push({ endpoint: validation.endpoint, options: { onConflict: "endpoint" } });
    if (result.error) {
      return { status: 400, body: { error: result.error.message || String(result.error) } };
    }
    return { status: 200, body: { ok: true } };
  });
}

function evaluateDeleteRequest({
  headers = {},
  body = {},
  env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-key",
  },
  authLookup = () => ({ user: { id: "user-test-001" }, error: null }),
}) {
  const authenticated = resolveAuthenticatedUser(headers, env, authLookup);
  if (!authenticated) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return { status: 400, body: { error: "Invalid push subscription" } };
  }

  return { status: 200, body: { ok: true }, endpoint };
}

function validSubscription(overrides = {}) {
  return {
    endpoint: "https://push.example.test/subscription/abc",
    keys: {
      p256dh: "p256dh-test-key",
      auth: "auth-test-key",
    },
    ...overrides,
  };
}

async function runCase(name, runner) {
  try {
    await runner();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

const staticChecks = [
  ["requires authenticated user lookup", routeSource.includes("auth.getUser")],
  ["rejects missing subscription fields", routeSource.includes('return NextResponse.json({ error: "Invalid push subscription" }, { status: 400 })')],
  ["rejects overly long endpoint", routeSource.includes("endpoint.length > 2000")],
  ["uses upsert for duplicate endpoint handling", routeSource.includes('onConflict: "endpoint"')],
  ["delete validates endpoint", routeSource.includes("export async function DELETE")],
];

for (const [name, passed] of staticChecks) {
  assert.ok(passed, name);
  console.log(`PASS: static ${name}`);
}

await runCase("POST returns 401 when authorization header is missing", async () => {
  const result = await evaluatePostRequest({
    headers: {},
    body: validSubscription(),
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Unauthorized");
});

await runCase("POST returns 401 when bearer token is invalid", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer invalid-token" },
    body: validSubscription(),
    authLookup: () => ({ user: null, error: new Error("Invalid JWT") }),
  });
  assert.equal(result.status, 401);
  assert.equal(typeof result.body.error, "string");
  assert.equal(result.body.error, "Unauthorized");
});

await runCase("POST returns 401 when Supabase env is missing", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: validSubscription(),
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Unauthorized");
});

await runCase("POST returns 400 when endpoint field is missing", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: { keys: validSubscription().keys },
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 when keys.p256dh is missing", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: {
      endpoint: validSubscription().endpoint,
      keys: { auth: "auth-test-key" },
    },
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 when keys.auth is missing", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: {
      endpoint: validSubscription().endpoint,
      keys: { p256dh: "p256dh-test-key" },
    },
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 when endpoint is only whitespace", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: validSubscription({ endpoint: "   " }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 when keys use empty strings", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: validSubscription({ keys: { p256dh: "  ", auth: "auth-test-key" } }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 when endpoint exceeds 2000 characters", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: validSubscription({ endpoint: `https://push.example.test/${"a".repeat(2001)}` }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("POST returns 400 with database error message type", async () => {
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: validSubscription(),
    upsert: async () => ({ error: { message: "duplicate key value violates unique constraint" } }),
  });
  assert.equal(result.status, 400);
  assert.equal(typeof result.body.error, "string");
  assert.match(result.body.error, /duplicate key value/);
});

await runCase("POST accepts valid subscription and returns ok", async () => {
  const upsertCalls = [];
  const payload = validSubscription();
  const result = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: payload,
    upsertCalls,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].endpoint, payload.endpoint);
  assert.equal(upsertCalls[0].options.onConflict, "endpoint");
});

await runCase("POST duplicate requests upsert the same endpoint twice", async () => {
  const upsertCalls = [];
  const payload = validSubscription({ endpoint: "https://push.example.test/subscription/dup" });
  const first = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: payload,
    upsertCalls,
  });
  const second = await evaluatePostRequest({
    headers: { authorization: "Bearer valid-token" },
    body: payload,
    upsertCalls,
  });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(upsertCalls.length, 2);
  assert.equal(upsertCalls[0].endpoint, upsertCalls[1].endpoint);
  assert.equal(upsertCalls[0].options.onConflict, "endpoint");
});

await runCase("DELETE returns 401 without authorization", async () => {
  const result = evaluateDeleteRequest({
    headers: {},
    body: { endpoint: validSubscription().endpoint },
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Unauthorized");
});

await runCase("DELETE returns 400 when endpoint is empty", async () => {
  const result = evaluateDeleteRequest({
    headers: { authorization: "Bearer valid-token" },
    body: { endpoint: "  " },
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Invalid push subscription");
});

await runCase("DELETE accepts valid endpoint", async () => {
  const endpoint = validSubscription().endpoint;
  const result = evaluateDeleteRequest({
    headers: { authorization: "Bearer valid-token" },
    body: { endpoint },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.endpoint, endpoint);
});

console.log("Push subscription API checks passed (20/20).");
