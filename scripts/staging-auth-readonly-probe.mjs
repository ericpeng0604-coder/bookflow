#!/usr/bin/env node

const base = process.env.STAGING_SUPABASE_URL?.replace(/\/+$/, "");
const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

if (!base || !anonKey || !serviceKey || !email || !password) {
  throw new Error("Required staging authentication test configuration is missing.");
}

const adminHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

async function findAccount() {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: adminHeaders,
    });
    if (!response.ok) throw new Error(`FAIL: staging account lookup returned HTTP ${response.status}`);
    const payload = await response.json();
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const found = users.find((user) => String(user?.email || "").trim().toLowerCase() === wanted);
    if (found) return found;
    if (users.length < 200) return null;
  }
  throw new Error("FAIL: staging account lookup exceeded the safe pagination limit");
}

console.log("PASS: staging test credentials are present");
let account = await findAccount();
if (!account) {
  const createResponse = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        e2e_test: true,
        full_name: "Campus Books E2E",
        department: "未設定",
      },
    }),
  });
  if (!createResponse.ok) {
    throw new Error(`FAIL: staging E2E account creation returned HTTP ${createResponse.status}`);
  }
  account = await createResponse.json();
  if (!account?.id) throw new Error("FAIL: staging E2E account creation returned no usable user");
  console.log("PASS: staging E2E Auth account was created");
} else {
  console.log("PASS: staging E2E Auth account already existed; password was not changed");
}

if (!account.email_confirmed_at && !account.confirmed_at) {
  throw new Error("FAIL: the staging E2E account email is not confirmed");
}
console.log("PASS: staging E2E account email is confirmed");

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
  if (code.includes("invalid_credentials") || message.includes("invalid login credentials")) {
    throw new Error("FAIL: staging E2E password authentication rejected the configured password");
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

const logoutResponse = await fetch(`${base}/auth/v1/logout`, {
  method: "POST",
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${session.access_token}`,
  },
});
if (![200, 204].includes(logoutResponse.status)) {
  throw new Error(`FAIL: staging logout returned HTTP ${logoutResponse.status}`);
}
console.log("PASS: staging Auth logout endpoint succeeded");
console.log("NOT VERIFIED: browser UI login, post-login routing, and browser UI logout");
