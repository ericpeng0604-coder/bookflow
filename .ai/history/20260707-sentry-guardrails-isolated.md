# AI Handoff Archive

- Task: ship sentry guardrails from isolated worktree
- Actor: codex
- Status: ready for verification
- Base commit: `6312a52a27166d470dc3778b24eff804f39cc9ba`
- Archived at: 2026-07-07T01:40:00.000Z

---

# BookFlow AI Handoff

## 任務目標

Ship the isolated Sentry observability integration and release-scope guardrails
from a clean worktree so production monitoring can be released without mixing in
unrelated UI, SQL, or workflow edits from the dirty checkout.

## 目前狀態與背景

- Branch: `codex/sentry-guardrails-isolated`.
- Base commit: `6312a52a27166d470dc3778b24eff804f39cc9ba` (`origin/main`).
- This release is scoped to Sentry instrumentation, monitoring docs, one
  uptime smoke workflow, and early release-scope guardrails.
- No database migration is included.
- No protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Added Next.js Sentry instrumentation files for server, edge, client, and
  global error capture.
- Added `docs/MONITORING.md` and a production uptime smoke workflow.
- Updated health-check and release docs to include Sentry prerequisites.
- Added `check-release-scope` plus release-plan/preflight guards so small
  observability releases stop early when they start from a dirty mixed-scope
  checkout.
- Fixed a false positive in the new scope classifier so `.env.example` is not
  misclassified as `other`.

## 下一步

1. Review the isolated diff and keep this branch limited to observability,
   release guardrails, and the required AI handoff files.
2. Commit the isolated change set.
3. Run `node scripts/release-preflight.mjs`.
4. Push and open a PR.
5. After merge, wait for `/api/health/release` to report the merged commit.
6. Only then trigger the production Sentry smoke or synthetic error and verify
   the issue arrives in Sentry.

## 變更檔案

- `.env.example`
- `next.config.ts`
- `package.json`
- `package-lock.json`
- `scripts/setup-health-check.mjs`
- `scripts/release-plan.mjs`
- `scripts/release-preflight.mjs`
- `scripts/check-release-scope.mjs`
- `scripts/lib/release-scope.mjs`
- `.github/workflows/production-uptime-smoke.yml`
- `docs/MONITORING.md`
- `docs/RELEASE_WORKFLOW.md`
- `instrumentation.ts`
- `instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- `app/global-error.tsx`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260707-sentry-guardrails-isolated.md`

## 驗證結果

- `node scripts/check-release-scope.mjs`: passed.
- `node scripts/release-plan.mjs`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `node node_modules/next/dist/bin/next build`: passed.
- `node scripts/setup-health-check.mjs --no-network`: failed as expected in the
  clean worktree because local `.env.local` secrets and `NEXT_PUBLIC_SENTRY_DSN`
  are not present there.

## 風險與注意事項

- The isolated worktree can build successfully, but production proof still
  depends on commit -> PR -> merge -> deployed commit -> Sentry smoke.
- Local setup-check failures here are environment completeness issues in the
  clean worktree, not proof that Vercel production is misconfigured.
- Keep this PR scoped; do not pull in the unrelated dirty-checkout edits.

## 下一位 AI 工作指引

1. Keep `AI_HANDOFF.md`, `.ai/state.json`, and
   `.ai/history/20260707-sentry-guardrails-isolated.md` in sync.
2. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` after the
   commit exists and before opening the PR.
3. Do not treat an env-only redeploy as proof that Sentry instrumentation is
   live in production.

## 相關 Commit

- Base commit: `6312a52a27166d470dc3778b24eff804f39cc9ba`.
- Current implementation commit before final commit: `not committed yet`.
