# BookFlow AI Handoff

## 目前目標

Deploy the homepage review update from PR #57: reduce the hero typography by roughly 10-20% and restore the latest-listings area closer to the previous textbook-card layout.

## 重要背景與決策

- Branch: `codex/homepage-review-tweaks`.
- PR: #57, `[codex] Tune homepage typography and listing layout`.
- The original branch `codex/homepage-visual-polish` had already been squash-merged as PR #56, so this release was reapplied on a clean branch from latest `origin/main`.
- The scoped product change is `app/globals.css`.
- The untracked `public/bookflow-hero-reference.png`, `public/bookflow-hero-scene.png`, and `public/bookflow-hero-still-life.png` files were intentionally left out of this release.
- No database migrations, GitHub workflow changes, or protected recovery file changes are included.
- Do not add the rollback approval trailer because this is not a recovery-system change.

## 已完成

- Reduced the homepage hero title max from 80px to 68px and reduced related hero intro/search/trust text.
- Restored the latest-listings market width to 1240px.
- Restored the three-column filter row proportions.
- Restored taller textbook card images and visible author/metadata text.
- Restored card price styling toward the previous textbook-card layout.
- Opened PR #57.
- Fixed the missing AI handoff update after GitHub reported that code changed without synchronized handoff files.

## 剩餘工作

1. Push this handoff update to PR #57.
2. Wait for all GitHub checks to pass.
3. Merge PR #57 into `main`.
4. Wait for Vercel production deployment.
5. Verify `/api/health/release` reports the merged SHA.
6. Run production release smoke against `https://bookflow-green.vercel.app`.
7. Perform a final production homepage visual check.

## 修改範圍

- `app/globals.css`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260702-0848-20260702-homepage-review-typography-and-.md`

## 驗證結果

- `scripts/run-project-checks.mjs`: passed, 24/24.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- `git diff --check origin/main...HEAD`: passed.
- Local browser style check confirmed:
  - hero title computed max was 68px;
  - hero input and button text were 15px;
  - latest-listings market width was 1240px;
  - listing card images were 215px tall;
  - listing card author/metadata text was visible again.
- GitHub PR #57 currently has Vercel preview, Quality and build, Workflow syntax, CodeRabbit, and staging detection passing; AI handoff is being fixed by this update.

## 風險或阻礙

- Production is not confirmed until the merged SHA is deployed to `https://bookflow-green.vercel.app`.
- The release is UI-only, so no staging or production database migration is expected.
- There are unrelated untracked hero draft images in `public/`; keep them out of this release unless the user explicitly asks to include them.

## 下一個 AI 的操作

1. Run `scripts/ai-collaboration.mjs check`.
2. Commit and push the handoff update to `codex/homepage-review-tweaks`.
3. Watch PR #57 checks.
4. Merge after checks pass.
5. Run production health and smoke verification with the merged SHA.
6. Confirm the production homepage visual result.

## 最後基準 Commit

`eb25c6c159b65e6e458bb01c84582195d4288458`
