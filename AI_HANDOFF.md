# BookFlow AI Handoff

## 任務目標

Implement Supabase Auth Cloudflare Turnstile protection

## 目前狀態與背景

- Task ID: `20260723-bookflow-cloudflare-turnstile`.
- Task: `Implement Supabase Auth Cloudflare Turnstile protection`.
- Branch: `codex/cloudflare-turnstile` (isolated clean clone; no commit or deploy yet).
- Base commit: `247a4512553557c57110706defe61b29f970e54b`.
- History: `.ai/history/20260723-cloudflare-turnstile.md`.
- This change has no database migration and does not change Cloudflare DNS, Vercel proxying, R2, Workers, or Supabase Storage.
- No workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback/recovery change.

## 已完成

- Added an explicit Cloudflare Turnstile widget with token expiry/error handling and no client-side secret.
- Passed one-time CAPTCHA tokens to Supabase password sign-in, email signup, signup-code resend, password reset, and admin OTP delivery.
- Kept Google OAuth unchanged at the provider call; admin OAuth sessions still open the protected OTP flow.
- Added Turnstile CSP allowances, `.env.example` guidance, README setup steps, and a dedicated static integration check.
- Preserved the existing database-backed rate limits and made the feature backward-compatible when the public site key is unset.

## 下一步

1. Configure a Cloudflare Turnstile widget and the matching Supabase CAPTCHA Secret Key per README.
2. Run browser verification for desktop, mobile, accessibility, token expiry/replay, and wrong-hostname failures.
3. After review, commit and push the isolated implementation branch; no production deployment has been requested or performed.

## 變更檔案

- `.env.example`, `README.md`, `app/globals.css`, `next.config.ts`
- `components/marketplace-app.tsx`, `components/turnstile-widget.tsx`
- `package.json`, `scripts/check-turnstile.mjs`, `scripts/check-google-auth.mjs`, `scripts/run-project-checks.mjs`
- `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/20260723-cloudflare-turnstile.md`

## 驗證結果

- `node scripts/check-turnstile.mjs` passed.
- `node scripts/check-google-auth.mjs` passed.
- Targeted ESLint passed for all changed TypeScript/JavaScript files.
- `tsc --noEmit` passed.
- `next build` passed; Next emitted only cache snapshot warnings.
- Browser Turnstile, real Supabase CAPTCHA, token replay/expiry, wrong-hostname behavior, and production deployment remain `NOT VERIFIED`.

## 風險與注意事項

- Supabase Dashboard must hold the Turnstile Secret Key; it must never be copied to client code or `NEXT_PUBLIC_` variables.
- The public site key must be configured in every deployed hostname before Supabase CAPTCHA enforcement is enabled.
- Do not put Cloudflare Proxy, R2, Workers, or DNS changes in this P0 implementation.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.
3. Preserve `.github/workflows/rollback-production.yml`, `.github/workflows/protect-rollback-workflow.yml`, and `.github/CODEOWNERS`.
4. Separate local, staging, deployment, release health, and smoke evidence; report `NOT VERIFIED` when any exact-SHA proof is missing.

## 相關 Commit

- Base commit: `247a4512553557c57110706defe61b29f970e54b`.
- Current implementation is uncommitted in the isolated clone.
