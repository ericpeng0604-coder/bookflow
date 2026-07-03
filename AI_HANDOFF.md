# BookFlow AI Handoff

## 目前目標

部署站內以圖搜圖的後續修正：圖片搜尋完成後直接顯示排序後的書籍結果，不再把辨識出的文字寫進一般 marketplace 搜尋欄。

## 重要背景與決策

- Branch: `codex/image-search-no-query`.
- Base: latest `origin/main` at `3452e3aed33c74d24a8f7e40c34056b959a578dc`.
- 這次 runtime 變更只限於 marketplace image-search UI state。
- 辨識文字仍保留在 dedicated image-search state，讓使用者知道系統用什麼內容比對。
- No database migration is included.
- No GitHub workflow or protected recovery file is changed.
- Do not add `Rollback-Workflow-Approved: true`.
- 原 active checkout 有 unrelated local edits 與舊 release branch，因此本次 release 使用最新 `origin/main` 的乾淨 worktree。

## 已完成

- Removed `setQuery(finalPlan.displayQuery)` from the image-search success path.
- Kept `setImageSearchQuery(finalPlan.displayQuery)` so recognized text remains in the image-search status area.
- Added a regression assertion that rejects reintroducing `setQuery(finalPlan.displayQuery)`.
- Updated `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/20260703-image-search-no-query.md`.

## 剩餘工作

1. Amend this handoff fix into the release commit.
2. Rerun `node scripts/release-preflight.mjs`.
3. Push `codex/image-search-no-query`.
4. Open PR, wait for GitHub checks, merge to `main`.
5. Run production smoke against `https://bookflow-green.vercel.app` with the exact merged SHA.

## 修改範圍

- `components/marketplace-app.tsx`
- `scripts/check-image-search.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260703-image-search-no-query.md`

## 驗證結果

- `git diff --check`: passed.
- `node --experimental-strip-types scripts/check-image-search.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 25/25.
- `tsc --noEmit`: passed.
- `eslint .`: passed.
- `next build`: passed.
- First `node scripts/release-preflight.mjs`: failed only because `AI_HANDOFF.md` used non-required section names; this handoff rewrite addresses that.
- GitHub PR checks: pending.
- Production smoke: pending after merge.

## 風險或阻礙

- The bundled runtime exposes `node` but not `npm`, so local typecheck, lint, and build used a temporary `node_modules` junction to the main checkout's existing dependency tree. No dependency files or package-manager configuration are changed in this release.
- GitHub/Vercel will still perform their own clean install and checks from `package-lock.json`.
- There is no database or migration risk in this release.

## 下一個 AI 的操作

1. Amend the handoff rewrite into commit `9d1c1221b4c146e4383ae60de435c1caa69b3087`.
2. Rerun `node scripts/release-preflight.mjs` and confirm it passes.
3. Push the branch and open a PR.
4. Merge after required checks pass.
5. Verify production with `RELEASE_BASE_URL=https://bookflow-green.vercel.app EXPECTED_COMMIT=<merged-sha> node scripts/release-smoke.mjs`.

## 最後基準 Commit

- Base commit: `3452e3aed33c74d24a8f7e40c34056b959a578dc`.
- Current implementation commit before final amend: `9d1c1221b4c146e4383ae60de435c1caa69b3087`.
