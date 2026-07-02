# BookFlow AI Handoff

## 目前目標

Deploy the homepage review update from PR #57 and fix the latest-listings card alignment so the leftmost card lines up with the other cards.

## 重要背景與決策

- Branch: `codex/homepage-review-tweaks`
- PR: #57, `[codex] Tune homepage typography and listing layout`
- This is a UI-only release.
- No database migrations are included.
- No GitHub workflow changes are included.
- No protected recovery files are changed.
- Do not add `Rollback-Workflow-Approved: true`; this is not a rollback or recovery-system change.
- `node` and `npm` are not on PATH in this environment; use the bundled Node runtime when needed.
- The untracked hero draft images in `public/` are not part of this release unless explicitly included later.

## 已完成

- Reduced the homepage hero typography from the previous oversized version.
- Restored the latest-listings section closer to the previous textbook-card layout.
- Added site-local image search controls for textbook cover photos.
- Added a hidden placeholder course tag for homepage listing cards without a department/course label, so the first card aligns with cards that do have labels.
- Made homepage card body rows use a fixed vertical rhythm and footer-at-bottom layout.
- Added a home accessibility regression check for the reserved label alignment space.
- Added image-search checks to the project check runner.

## 剩餘工作

1. Push the current branch to PR #57.
2. Wait for GitHub checks to pass.
3. Merge PR #57 into `main`.
4. Wait for Vercel production deployment.
5. Verify `https://bookflow-green.vercel.app/api/health/release` reports the merged SHA.
6. Run production release smoke with the merged SHA.
7. Confirm the production homepage first-row cards remain visually aligned.

## 修改範圍

- `app/globals.css`
- `components/marketplace-app.tsx`
- `lib/marketplace/image-search.ts`
- `scripts/check-home-accessibility.mjs`
- `scripts/check-image-search.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260702-1715-homepage-review-card-alignment-release.md`

## 驗證結果

- `scripts/release-plan.mjs`: passed; release is UI-only with no migrations or protected recovery changes.
- `scripts/check-home-accessibility.mjs`: passed, 21/21.
- `scripts/check-image-search.mjs`: passed.
- `scripts/run-project-checks.mjs`: passed, 25/25.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- `git diff --check`: passed.
- Local production preview at `http://127.0.0.1:3003/`: returned HTTP 200.
- Browser measurement at a wide viewport confirmed the first four homepage cards share the same top/bottom values for tag, title, author, metadata, and footer rows.

## 風險或阻礙

- Production is not confirmed until the merged SHA is deployed to `https://bookflow-green.vercel.app`.
- This branch contains existing image-search UI work plus the card-alignment fix; keep the unrelated untracked hero draft images out of the release unless explicitly requested.
- The project check runner emits existing Node module-type warnings; checks still pass.

## 下一個 AI 的操作

1. Run `scripts/ai-collaboration.mjs check`.
2. Review the final diff and stage only the release files listed above.
3. Commit and push `codex/homepage-review-tweaks`.
4. Watch PR #57 checks.
5. Merge after checks pass.
6. Run production health and release smoke verification with the merged SHA.
7. Confirm the production homepage visual result.

## 最後基準 Commit

`eb25c6c159b65e6e458bb01c84582195d4288458`
