# 2026-07-23 Cloudflare Turnstile P0

## Scope

- Implemented the P0 Cloudflare plan only: Supabase Auth CAPTCHA protection.
- No Cloudflare DNS, Vercel proxy, R2, Workers, Pages, D1, KV, or database migration changes.
- Work was isolated from the dirty active checkout at `origin/main` commit `247a4512553557c57110706defe61b29f970e54b`.

## Implementation

- Added an explicit Turnstile browser widget with expiry and load-error handling.
- Added token forwarding to password sign-in, signup, signup resend, password reset, and admin OTP.
- Kept Google OAuth provider invocation unchanged because the installed Auth SDK options do not expose `captchaToken`; admin OAuth sessions still require the protected OTP modal.
- Added CSP, environment example, setup documentation, and static contract checks.

## Verification

- Turnstile static check: passed.
- Google Auth static check: passed.
- Targeted ESLint: passed.
- TypeScript: passed.
- Production build: passed.
- Browser, real Supabase Dashboard CAPTCHA, token replay/expiry, wrong-hostname, and production checks: `NOT VERIFIED`.
