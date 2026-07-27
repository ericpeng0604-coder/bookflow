# 2026-07-27 Admin OTP delivery repair

- Task: repair administrator OTP delivery and retry handling.
- Base: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`.
- Branch: `codex/admin-otp-delivery-repair-20260727`.

The admin OTP flow now classifies Supabase Auth provider, CAPTCHA, rate-limit,
and invalid-email failures without exposing raw errors. Delivery and code
verification reset loading state after returned errors or thrown network
failures, so the modal remains retryable.

Turnstile focused checks, TypeScript, production build, and diff checks passed.
ESLint is NOT VERIFIED because the clean dependency install lacks
`@next/eslint-plugin-next`. Real SMTP delivery remains dependent on the
configured Supabase Email/SMTP and Turnstile settings.
