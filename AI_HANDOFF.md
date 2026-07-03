# BookFlow AI Handoff

## 目前目標

Restore the homepage listing card price color to the previous effective color and deploy it to production.

## 重要背景與決策

- Branch: `codex/restore-price-color`.
- Base: latest `origin/main` at `d56bb41b53fe9e92f7d446cf9fa2a64ad8a8a43e`.
- Previous effective homepage card price color was `#2b3f38`.
- No database migration is included.
- No protected recovery files are changed.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- Restored `.home-page .card-footer strong` from `var(--orange)` to `#2b3f38`.
- Rewrote the prior mojibake handoff file into readable UTF-8 content.
- Added `.ai/history/20260703-restore-price-color.md`.

## 剩餘工作

1. Push this branch.
2. Open a PR.
3. Wait for required GitHub checks.
4. Merge to `main`.
5. Verify production with `RELEASE_BASE_URL=https://bookflow-green.vercel.app` and the exact merged commit SHA.

## 修改範圍

- `app/globals.css`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260703-restore-price-color.md`

## 驗證結果

- `git diff --check`: passed.
- `node scripts/check-home-accessibility.mjs`: passed, 21/21.
- `node scripts/release-preflight.mjs`: passed.
- GitHub PR checks: pending.
- Production smoke: pending after merge.

## 風險或阻礙

- CSS-only runtime change.
- The original active checkout has unrelated local modifications; this release is isolated in a clean worktree.
- The previous `AI_HANDOFF.md` on `main` had mojibake, so this change rewrites it to readable content.

## 下一個 AI 的操作

1. Run `node scripts/release-preflight.mjs`.
2. Push `codex/restore-price-color`.
3. Open and merge the PR after checks pass.
4. Run production smoke against `https://bookflow-green.vercel.app`.

## 最後基準 Commit

- Base commit: `d56bb41b53fe9e92f7d446cf9fa2a64ad8a8a43e`.
- Current implementation commit before final amend: `a4ec2fb64da512b02cbb5b2017f26f87dc0d15b8`.
