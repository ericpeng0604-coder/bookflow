#!/usr/bin/env node

const base = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

if (!base || !anonKey || !serviceKey) {
  throw new Error(
    "STAGING_SUPABASE_URL, STAGING_SUPABASE_ANON_KEY, and STAGING_SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}
if (!/^https:\/\//.test(base) || anonKey === serviceKey) {
  throw new Error("Staging Supabase configuration is invalid.");
}

async function request(path, key, options = {}) {
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...options.headers,
    },
  });
}

const auth = await fetch(`${base}/auth/v1/settings`, {
  headers: { apikey: anonKey },
});
if (!auth.ok) throw new Error(`Staging Auth API returned HTTP ${auth.status}.`);

const rpcProbes = [
  { name: "is_verified_admin", body: {} },
  { name: "list_books_page", body: {} },
  {
    name: "hide_closed_conversation",
    body: { target_conversation_id: "00000000-0000-0000-0000-000000000000" },
  },
  {
    name: "list_feedback_for_moderation",
    body: { page_limit: 1, page_offset: 0 },
  },
];

for (const rpc of rpcProbes) {
  const response = await request(`/rest/v1/rpc/${rpc.name}`, anonKey, {
    method: "POST",
    body: JSON.stringify(rpc.body),
  });
  const body = await response.text();
  if (response.status === 404 || body.includes("PGRST202")) {
    throw new Error(`Required staging RPC is missing: ${rpc.name}`);
  }
}

for (const table of [
  "notifications",
  "purchase_requests",
  "conversations",
  "conversation_user_preferences",
  "user_feedback",
]) {
  const serviceResponse = await request(`/rest/v1/${table}?select=*&limit=0`, serviceKey);
  if (!serviceResponse.ok) {
    throw new Error(`Service-role staging probe failed for ${table}.`);
  }
  const anonResponse = await request(`/rest/v1/${table}?select=*&limit=1`, anonKey);
  if ([401, 403].includes(anonResponse.status)) {
    continue;
  }
  if (!anonResponse.ok) {
    throw new Error(`Anonymous RLS probe could not execute for ${table}.`);
  }
  const rows = await anonResponse.json();
  if (Array.isArray(rows) && rows.length > 0) {
    throw new Error(`Anonymous access unexpectedly returned rows from ${table}.`);
  }
}

console.log("Staging migration, RPC, and anonymous RLS checks passed.");
