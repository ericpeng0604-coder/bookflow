# BookFlow AI Handoff

## 目前目標

Ship the site-local image search optimization for BookFlow marketplace through PR, merge, and production verification.

## 重要背景與決策

- Branch: `codex/image-search-optimization`.
- Base: latest `origin/main` at `84adb1aee447db4414db7fa3ba44361106d3903e`.
- This is an application/UI release with no database migration.
- No external image-search service is added.
- No GitHub workflow changes are included.
- No protected recovery files are changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback or recovery-system change.
- The untracked hero draft images in `public/` are intentionally excluded.
- The previous reused branch `codex/homepage-review-tweaks` had already been merged in PR #57, so final deployment moved to this clean branch from latest `origin/main`.

## 已完成

- Upgraded image search from a single OCR text query to a multi-query site-local matching plan.
- Added candidate searches through the existing `list_books_page` RPC and ranked merged results on the frontend.
- Added title, author, edition, publisher, and metadata scoring for image-search results.
- Updated the marketplace UI so image-search mode shows the recognized query, result count, and ranked results.
- Manual text edits now leave image-search sorting mode and return to normal marketplace search.
- Weak OCR without login keeps the existing list and explains that AI fallback is available after login.
- Added image-search regression checks to the project check runner.
- Opened clean PR #60 after closing superseded PR #59.

## 剩餘工作

1. Push the updated handoff fix to PR #60.
2. Wait for GitHub checks to pass.
3. Merge PR #60 into `main`.
4. Wait for Vercel production deployment.
5. Verify `https://bookflow-green.vercel.app/api/health/release` reports the merged SHA.
6. Run production release smoke with the merged SHA.

## 修改範圍

- `components/marketplace-app.tsx`
- `lib/marketplace/image-search.ts`
- `lib/marketplace/queries.ts`
- `app/globals.css`
- `app/home-a11y.css`
- `scripts/check-image-search.mjs`
- `scripts/check-home-accessibility.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260702-2245-image-search-optimization-release.md`

## 驗證結果

- `scripts/release-plan.mjs`: passed; no migrations or protected recovery changes.
- `scripts/check-image-search.mjs`: passed.
- `scripts/check-book-ocr-ai.mjs`: passed.
- `scripts/check-mobile-book-ocr.mjs`: passed.
- `scripts/check-home-accessibility.mjs`: passed, 21/21.
- `scripts/run-project-checks.mjs`: passed, 25/25.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- `git diff --check`: passed.
- Encoding check for modified source/check files: passed.
- Local browser smoke at `http://127.0.0.1:3107`: desktop and 390px mobile image-search buttons present, no mobile horizontal overflow.

## 風險或阻礙

- Production is not confirmed until PR #60 is merged and the merged SHA is deployed to `https://bookflow-green.vercel.app`.
- PR #59 was closed because it used a reused branch that had already been merged; PR #60 is the intended clean release PR.
- The project check runner emits existing Node module-type warnings; checks still pass.

## 下一個 AI 的操作

1. Run `scripts/ai-collaboration.mjs check-ci` or wait for CI to confirm this handoff.
2. Merge PR #60 after required checks pass.
3. Use the merged SHA for production release smoke.
4. Confirm the production homepage image-search entry points and release health endpoint.

## 最後基準 Commit

- Base commit: `84adb1aee447db4414db7fa3ba44361106d3903e`
- Current release commit before this handoff fix: `7ebfc83b16452cfce93883073caf2b1c1d262a1e`
