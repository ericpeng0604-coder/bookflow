# BookFlow AI Handoff

## 目前目標

Ship a homepage latest-listings card alignment fix after PR #57 was already merged. The leftmost card without a department/course label must align with the other cards that do have labels.

## 重要背景與決策

- Branch: `codex/home-card-alignment`
- Base: latest `origin/main` after PR #57 (`2aff270826e59a8d4dc382e64f435dda2eac6939`)
- This is a UI-only release.
- No database migrations are included.
- No GitHub workflow changes are included.
- No protected recovery files are changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback or recovery-system change.
- The original worktree has unrelated uncommitted image-search and hero-draft changes; this clean worktree intentionally excludes them.

## 已完成

- Added a hidden placeholder course tag for homepage listing cards without a department/course label.
- Made homepage card body rows use a fixed vertical rhythm and footer-at-bottom layout.
- Added a home accessibility regression check for the reserved label alignment space.

## 剩餘工作

1. Push `codex/home-card-alignment`.
2. Open a PR into `main`.
3. Wait for GitHub checks to pass.
4. Merge the PR.
5. Wait for Vercel production deployment.
6. Verify `https://bookflow-green.vercel.app/api/health/release` reports the merged SHA.
7. Run production release smoke with the merged SHA.
8. Confirm the production homepage first-row cards remain visually aligned.

## 修改範圍

- `app/globals.css`
- `components/marketplace-app.tsx`
- `scripts/check-home-accessibility.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260702-1725-home-card-alignment-release.md`

## 驗證結果

- `scripts/release-plan.mjs`: passed; release is UI-only with no migrations or protected recovery changes.
- `scripts/check-home-accessibility.mjs`: passed, 21/21.
- `scripts/run-project-checks.mjs`: passed, 24/24.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- `git diff --check`: passed.
- Local production preview at `http://127.0.0.1:3005/`: returned HTTP 200.
- Browser measurement confirmed the first four homepage cards share identical row positions for tag, title, author, metadata, and footer.

## 風險或阻礙

- Production is not confirmed until the merged SHA is deployed to `https://bookflow-green.vercel.app`.
- Keep unrelated untracked hero images and image-search edits out of this PR.

## 下一個 AI 的操作

1. Run local project checks, typecheck, lint, and build.
2. Run `scripts/ai-collaboration.mjs check`.
3. Commit and push `codex/home-card-alignment`.
4. Open and merge the PR after checks pass.
5. Run production health and release smoke verification with the merged SHA.

## 最後基準 Commit

`2aff270826e59a8d4dc382e64f435dda2eac6939`
