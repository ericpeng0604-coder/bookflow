# BookFlow AI Handoff

## 任務目標

修復學生證審核在長時間開啟管理頁後的 session 失效問題，並讓一般
使用者在送出驗證前看見 OCR 辨識出的 8 碼學號以便核對。

## 目前狀態與背景

- Branch: `codex/student-verification-release`.
- Base commit: `bca8cc3` (`origin/main`).
- This release changes the student-verification UI and authenticated review
  request flow only; the existing student-verification migration is already in
  `origin/main`.
- No protected recovery file is changed.
- Production deployment is pending local gates, PR checks, merge, and smoke.

## 已完成

- Refresh the Supabase session before student-verification review actions.
- Retry the review request once after an HTTP 401 auth failure.
- Show the recognized student number and a confirmation instruction in the
  ordinary user verification panel.
- Add focused regression assertions for the displayed number and auth refresh.

## 下一步

1. Run local typecheck, lint, project checks, and production build.
2. Run release preflight, commit, push, and open the release PR.
3. Wait for required checks, merge after they pass, then verify the Vercel
   production deployment commit and production smoke.

## 變更檔案

- `components/marketplace-app.tsx`
- `lib/marketplace/student-verification.ts`
- `scripts/check-student-verification.mjs`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-student-verification-release.md`

## 驗證結果

- Focused student-verification check: pending.
- Typecheck, lint, project checks, and production build: pending.
- Staging and production database operations: not required for this UI/API
  change; the required schema is already in `origin/main`.

## 風險與注意事項

- The original checkout remains dirty and mixed; this release worktree is
  intentionally isolated from it.
- A Vercel Preview is not production proof.
- Do not modify the rollback workflows or `.github/CODEOWNERS`.

## 相關 Commit

- Base commit: `bca8cc3`.
- Current implementation commit before final commit: not committed yet.
