#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const base = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const projectRef = process.env.STAGING_SUPABASE_PROJECT_REF;
const expectedProjectRef = "yffcyktpwmeslydlbctb";

if (!base || !anonKey || !serviceKey || !projectRef) {
  throw new Error(
    "STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY, STAGING_SUPABASE_SERVICE_ROLE_KEY, and STAGING_SUPABASE_PROJECT_REF are required.",
  );
}

const url = new URL(base);
if (
  process.env.STAGING_RLS_HTTP_CONFIRM !== "yes" ||
  projectRef !== expectedProjectRef ||
  url.protocol !== "https:" ||
  !url.hostname.startsWith(`${expectedProjectRef}.`) ||
  anonKey === serviceKey
) {
  throw new Error(
    `Refusing to run: set STAGING_RLS_HTTP_CONFIRM=yes and verify the HTTPS BookFlow staging project (${expectedProjectRef}).`,
  );
}

const marker = `codex-staging-http-rls-${randomUUID()}`;
const email = `${marker}@example.invalid`;
const password = `RlsHttp-${randomUUID()}-aA1!`;
let userId;
let controlBookId;

function headers(key, token) {
  return {
    apikey: key,
    Authorization: `Bearer ${token ?? key}`,
    "Content-Type": "application/json",
  };
}

async function request(path, { key, token, method = "GET", body, prefer } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...headers(key, token),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data };
}

function detail(data) {
  if (typeof data === "string") return data.slice(0, 240);
  if (!data) return "no response body";
  return JSON.stringify(data).slice(0, 240);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createUser() {
  const result = await request("/auth/v1/admin/users", {
    key: serviceKey,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { name: marker },
    },
  });
  assert(result.response.ok && result.data?.id, `admin user creation failed: ${result.response.status} ${detail(result.data)}`);
  userId = result.data.id;
}

async function signIn() {
  const result = await request("/auth/v1/token?grant_type=password", {
    key: anonKey,
    method: "POST",
    body: { email, password },
  });
  assert(result.response.ok && result.data?.access_token, `HTTP sign-in failed: ${result.response.status} ${detail(result.data)}`);
  return result.data.access_token;
}

async function waitForProfile() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request(`/rest/v1/profiles?id=eq.${userId}&select=id,account_status`, {
      key: serviceKey,
    });
    if (result.response.ok && result.data?.[0]?.id === userId) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("profile trigger did not create the temporary user profile");
}

const listingPayload = (title) => ({
  seller_id: userId,
  title,
  author: "security-test",
  condition: "good",
  price: 1,
  meetup: "temporary test location",
  description: "temporary HTTP RLS verification fixture",
  review_status: "pending",
  moderation_visibility: "visible",
  lifecycle_state: "active",
});

async function suspendProfile() {
  const result = await request(`/rest/v1/profiles?id=eq.${userId}`, {
    key: serviceKey,
    method: "PATCH",
    body: {
      account_status: "suspended",
      suspended_at: new Date().toISOString(),
      suspension_reason: marker,
    },
    prefer: "return=representation",
  });
  assert(result.response.ok && result.data?.[0]?.account_status === "suspended", `profile suspension failed: ${result.response.status} ${detail(result.data)}`);
}

async function createControlBook(token) {
  const result = await request("/rest/v1/books", {
    key: anonKey,
    token,
    method: "POST",
    body: listingPayload(`${marker}-control`),
    prefer: "return=representation",
  });
  assert(result.response.ok && result.data?.[0]?.id, `active control listing creation failed: ${result.response.status} ${detail(result.data)}`);
  controlBookId = result.data[0].id;
}

function denied(result) {
  return !result.response.ok || (Array.isArray(result.data) && result.data.length === 0);
}

async function verifyDeniedWrites(token) {
  const insert = await request("/rest/v1/books", {
    key: anonKey,
    token,
    method: "POST",
    body: listingPayload(`${marker}-insert-attempt`),
    prefer: "return=representation",
  });
  assert(denied(insert), `suspended INSERT was not denied: ${insert.response.status} ${detail(insert.data)}`);

  const update = await request(`/rest/v1/books?id=eq.${controlBookId}`, {
    key: anonKey,
    token,
    method: "PATCH",
    body: { title: `${marker}-update-attempt` },
    prefer: "return=representation",
  });
  assert(denied(update), `suspended UPDATE was not denied: ${update.response.status} ${detail(update.data)}`);

  const remove = await request(`/rest/v1/books?id=eq.${controlBookId}`, {
    key: anonKey,
    token,
    method: "DELETE",
    prefer: "return=representation",
  });
  assert(denied(remove), `suspended DELETE was not denied: ${remove.response.status} ${detail(remove.data)}`);

  const control = await request(`/rest/v1/books?id=eq.${controlBookId}&select=id,title`, {
    key: serviceKey,
  });
  assert(
    control.response.ok && control.data?.[0]?.title === `${marker}-control`,
    `service verification found an altered or deleted control listing: ${control.response.status} ${detail(control.data)}`,
  );
}

async function cleanup() {
  if (!userId) return;
  const result = await request(`/auth/v1/admin/users/${userId}`, {
    key: serviceKey,
    method: "DELETE",
  });
  if (!result.response.ok && result.response.status !== 404) {
    console.error(`WARNING: temporary user cleanup failed: ${result.response.status} ${detail(result.data)}`);
  }
}

try {
  await createUser();
  await waitForProfile();
  const token = await signIn();
  await createControlBook(token);
  await suspendProfile();
  await verifyDeniedWrites(token);
  console.log("suspended-user HTTP Auth RLS test passed: INSERT, UPDATE, and DELETE were denied");
} finally {
  await cleanup();
}
