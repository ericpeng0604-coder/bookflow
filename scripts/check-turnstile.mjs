#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertIncludes(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`Turnstile check failed: ${label}`);
}

const app = read("components/marketplace-app.tsx");
const widget = read("components/turnstile-widget.tsx");
const nextConfig = read("next.config.ts");
const envExample = read(".env.example");
const readme = read("README.md");

assertIncludes(widget, "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", "official script URL");
assertIncludes(widget, 'callback: (token)', "token callback");
assertIncludes(widget, '"expired-callback"', "expired callback");
assertIncludes(widget, '"error-callback"', "error callback");
assertIncludes(widget, "turnstile.render", "explicit widget render");

for (const fragment of [
  "signUp({",
  "signInWithPassword({",
  "signInWithOtp({",
  "resetPasswordForEmail(email",
  "auth.resend({",
  "captchaToken",
  'action="admin_otp"',
]) assertIncludes(app, fragment, fragment);

if (widget.includes("SUPABASE_SERVICE_ROLE_KEY") || widget.includes("secret")) {
  throw new Error("Turnstile check failed: client widget contains a server secret");
}

for (const fragment of [
  "https://challenges.cloudflare.com",
  "script-src",
  "frame-src",
  "connect-src",
]) assertIncludes(nextConfig, fragment, `CSP ${fragment}`);

assertIncludes(envExample, "NEXT_PUBLIC_TURNSTILE_SITE_KEY=", "public site key env example");
assertIncludes(readme, "Authentication → Bot and Abuse Protection → CAPTCHA", "Supabase CAPTCHA setup");
assertIncludes(readme, "Secret Key 只放 Supabase CAPTCHA 設定", "secret placement guidance");

console.log("Turnstile integration checks passed.");
