#!/usr/bin/env node

const base = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!base || !anonKey || !serviceKey || !email || !password) {
  throw new Error("Required staging authentication test configuration is missing.");
}

async function findAccount() {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!response.ok) throw new Error(`FAIL: read-only staging account lookup returned HTTP ${response.status}`);
    const payload = await response.json();
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const found = users.find((user) => String(user?.email || "").trim().toLowerCase() === wanted);
    if (found) return found;
    if (users.length < 200) return null;
  }
  throw new Error("FAIL: read-only staging account lookup exceeded the safe pagination limit");
}

console.log("PASS: staging test credentials are present");
const login = await fetch(`${base}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    "content-type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});

if (!login.ok) {
  let authError = {};
  try { authError = await login.json(); } catch {}
  const code = String(authError?.error_code || authError?.code || "").toLowerCase();
  const message = String(authError?.msg || authError?.message || authError?.error_description || "").toLowerCase();
  if (code.includes("captcha") || message.includes("captcha")) {
    throw new Error("FAIL: password authentication requires CAPTCHA/Turnstile");
  }
  if (code.includes("email_not_confirmed") || message.includes("email not confirmed")) {
    throw new Error("FAIL: the staging test account exists but its email is not confirmed");
  }
  if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
    const account = await findAccount();
    if (!account) throw new Error("FAIL: no staging Auth account exists for E2E_TEST_EMAIL");
    if (!account.email_confirmed_at && !account.confirmed_at) {
      throw new Error("FAIL: the staging test account exists but its email is not confirmed");
    }
    throw new Error("FAIL: the staging test account exists, but E2E_TEST_PASSWORD was rejected");
  }
  throw new Error(`FAIL: password authentication returned HTTP ${login.status} with an unclassified safe error`);
}

const session = await login.json();
if (!session?.access_token || !session?.user?.id) throw new Error("FAIL: authentication response did not contain a usable session");
console.log("PASS: password authentication succeeded");

const userResponse = await fetch(`${base}/auth/v1/user`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
  },
});
if (!userResponse.ok) throw new Error(`FAIL: authenticated user lookup returned HTTP ${userResponse.status}`);
const user = await userResponse.json();
if (user?.id !== session.user.id) throw new Error("FAIL: authenticated user identity changed unexpectedly");
console.log("PASS: authenticated session lookup succeeded");

const adminResponse = await fetch(`${base}/rest/v1/rpc/is_verified_admin`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
    "content-type": "application/json",
  },
  body: "{}",
});
if (!adminResponse.ok) throw new Error(`FAIL: admin-role probe returned HTTP ${adminResponse.status}`);
const isAdmin = await adminResponse.json();
if (isAdmin !== false) throw new Error("FAIL: the staging E2E account unexpectedly has verified-admin access");
console.log("PASS: staging test account is not a verified administrator");
console.log("NOT VERIFIED: browser UI login and logout");
