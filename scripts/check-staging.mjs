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

for (const rpc of ["is_verified_admin", "list_books_page"]) {
  const response = await request(`/rest/v1/rpc/${rpc}`, anonKey, {
    method: "POST",
    body: "{}",
  });
  const body = await response.text();
  if (response.status === 404 || body.includes("PGRST202")) {
    throw new Error(`Required staging RPC is missing: ${rpc}`);
  }
}

for (const table of ["notifications", "purchase_requests", "conversations"]) {
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
