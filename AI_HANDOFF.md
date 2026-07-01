# BookFlow AI Handoff

## 目前目標

發布聊天與商品瀏覽 UX 更新：商品卡外層顯示科系與課程、聊聊內顯示正在詢問的商品與購買意願狀態、賣家可在聊聊內接受或婉拒購買意願，並把聊聊的檢舉/封鎖/結束操作收進右上三點選單。

## 重要背景與決策

- 新分支：`codex/chat-listing-order-ux`，從最新 `origin/main` 建立，避免混入舊 PR #53 分支。
- 本次沒有修改 `supabase/migrations/`，不需要資料庫 migration。
- 本次沒有修改 rollback/recovery 受保護檔案，所以不需要 `Rollback-Workflow-Approved: true` commit trailer。
- Supabase changelog 已檢查；本次沒有新增 table 或 grant，既有 Data API / RPC 使用方式不受新表格顯式 grant 變更影響。
- 本機 dev server 在 `http://127.0.0.1:3002` 以 Chrome 檢查 CSS/JS 載入正常；目前資料源回 0 件商品，因此真實商品卡視覺以靜態檢查與 build 覆蓋。

## 已完成

- 商品卡與收藏卡改用共用 helper，教科書外層優先顯示 `科系 · 課程`。
- 聊聊分頁載入 conversations 時同步取得目前使用者相關 purchase requests，讓聊天面板可顯示購買意願狀態。
- 聊天面板新增商品摘要卡，可從聊聊回到商品頁。
- 聊天面板在已有購買意願時顯示「你已送出購買意願」或「買家已送出購買意願」。
- 賣家可在聊聊內直接接受或婉拒 `pending` / `waitlisted` 的購買意願，沿用既有 `respond_to_purchase_request` 流程。
- 聊聊的檢舉聊天室、封鎖對方、結束/隱藏聊天室收進右上三點選單。
- 常用語句在點選一次或成功送出訊息後隱藏。
- 新增 `scripts/check-chat-listing-order-ux.mjs` 並納入 `scripts/run-project-checks.mjs`。

## 剩餘工作

- Stage and commit the intended files.
- Push `codex/chat-listing-order-ux`.
- Open a draft PR against `main`.
- Wait for GitHub checks, merge, and verify production.

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/marketplace/queries.ts`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/`

## 驗證結果

- bundled Node `scripts/check-chat-listing-order-ux.mjs`: passed, 8/8 checks.
- bundled Node `scripts/check-capacity-optimization.mjs`: passed, 10/10 checks.
- bundled Node `scripts/check-chat-visibility-and-feedback.mjs`: passed, 9/9 checks.
- bundled Node `scripts/run-project-checks.mjs`: passed, 24/24 checks.
- bundled Node `node_modules/typescript/bin/tsc --noEmit`: passed.
- bundled Node `node_modules/next/dist/bin/next build`: passed; production pages generated successfully.
- `git diff --check`: passed.
- Chrome local dev smoke on `http://127.0.0.1:3002`: CSS/JS loaded, mobile overflow probe found no overflowing elements.
- Local standalone ESLint remains blocked by the known `eslint-config-next` / Rushstack patch compatibility issue in this checkout. The Next build still completed with exit code 0.

## 風險或阻礙

- Production is not updated until this branch is pushed, PR checks pass, the PR is merged into `main`, and Vercel deploys the merged SHA.
- Because the current local Supabase-backed market returned 0 listings, visual verification of real populated cards must be confirmed on a seeded preview or production after deploy.

## 下一個 AI 的操作

1. Run `node scripts/ai-collaboration.mjs check`.
2. Stage the intended files only and commit.
3. Push `codex/chat-listing-order-ux`.
4. Open a draft PR against `main`.
5. Wait for GitHub checks.
6. Merge after checks pass.
7. Verify production deployed commit with `/api/health/release`.
8. Run release smoke against `https://bookflow-green.vercel.app` with the merged SHA.

## 最後基準 Commit

`938aea320fe0353fecdda0aab761bb2f71a63a19`
