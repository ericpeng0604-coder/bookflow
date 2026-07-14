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
    body: {},
  },
  {
    name: "reserve_book_ocr_quota",
    body: {
      target_user_id: "00000000-0000-0000-0000-000000000000",
      request_key: "00000000-0000-4000-8000-000000000000",
      daily_limit: 20,
    },
  },
  {
    name: "consume_api_rate_limit",
    body: {
      rate_scope: "staging-probe",
      rate_key_hash: "00000000000000000000000000000000",
      request_limit: 1,
      window_seconds: 60,
    },
  },
  {
    name: "record_textbook_ocr_feedback",
    body: {
      original_metadata: {},
      corrected_metadata: {},
      catalog_version: "staging-probe",
    },
  },
  {
    name: "anonymize_account_for_deletion",
    body: { target_user_id: "00000000-0000-0000-0000-000000000000" },
  },
  {
    name: "get_public_trust_badges",
    body: { target_user_ids: [] },
  },
  {
    name: "get_my_review_status",
    body: { target_request_id: "00000000-0000-0000-0000-000000000000" },
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
  "book_ocr_daily_usage",
  "book_ocr_quota_reservations",
  "api_rate_limits",
  "api_abuse_events",
  "student_verification_audit_logs",
  "moderation_audit_logs",
  "textbook_ocr_feedback",
  "account_deletion_requests",
  "trade_reviews",
  "risk_profiles",
  "risk_policy_settings",
  "risk_audit_logs",
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
