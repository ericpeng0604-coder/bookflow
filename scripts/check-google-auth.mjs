#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260615000000_google_oauth_profile_support.sql", import.meta.url),
  "utf8",
);

const checks = [
  ["Google OAuth provider is used", app.includes('provider: "google"')],
  ["OAuth returns to the current site", app.includes("redirectTo: window.location.origin")],
  ["Google login is exposed in the login modal", app.includes("使用 Google 帳號繼續")],
  ["Google button has focus styling", css.includes(".google-login-button:focus-visible")],
  ["admin OAuth sessions still require verification", app.includes("await ensureAdminOtp(user.email)")],
  ["admin OTP dedupe resets when the session ends", app.includes("if (!user?.email) {\n        adminOtpRequestedRef.current = null;")],
  ["Google full_name is copied into profiles", migration.includes("new.raw_user_meta_data->>'full_name'")],
  ["Google display names respect the profile limit", migration.includes("left(") && migration.includes("60")],
  ["OAuth profiles get a usable department fallback", migration.includes("'未設定'")],
];

for (const [label, passed] of checks) {
  if (!passed) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}
