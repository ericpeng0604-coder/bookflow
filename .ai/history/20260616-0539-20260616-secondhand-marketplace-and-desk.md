# AI 交接歷史

- 任務：secondhand marketplace and desktop menu
- 執行者：codex
- 狀態：完成
- 基準 Commit：`ab710726ba40ea6df5db9288ee007e04a39be92e`
- 封存時間：2026-06-16T05:39:00.918Z

---
# BookFlow AI Handoff

## 目前目標

準備發布「二手物品專區」與「桌機右上角三條線選單」：

- 在現有 marketplace 內新增「課本 / 二手物品」市場切換，不另建一套交易系統。
- 二手物品區使用獨立潮流商店風格，切換時整站主題、hero、卡片、篩選與表單跟著改變。
- 桌機版右上角新增三條線選單，收納帳號、登入、登出、管理等次要功能，避免 header 過度擁擠。
- 新增 Supabase migration，讓既有 `books` 表支援 `listing_type` 與 `item_category`。

## 重要背景與決策

- 沿用現有 `books`、purchase requests、favorites、chat、reports、moderation、notifications 流程，避免另建 secondhand tables 造成交易流程分叉。
- 舊資料預設為 `listing_type = 'book'`、`item_category = 'book'`，保持現有課本市場相容。
- 二手物品分類先固定為：3C 電子、文具用品、宿舍生活、服飾配件、運動休閒、其他。
- 這次有資料庫變更，production 發布必須包含 Supabase migration：`supabase/migrations/20260616090000_secondhand_listing_type.sql`。
- `.cursor/mcp.json`、`_run_verify.cmd`、`_verify_report.txt`、`output/` 是既有未追蹤本機輔助檔，未納入提交。

## 已完成

- 新增 marketplace listing type 資料流：
  - `lib/types.ts` 增加 `ListingType`、`Book.listingType`、`Book.itemCategory`。
  - `lib/marketplace/filters.ts`、`queries.ts`、`mappers.ts` 支援 listing type 與 item category。
  - `app/api/marketplace/count/route.ts` 將 `listingType` / `itemCategory` 傳給 `count_books_filtered` RPC。
- 新增 Supabase migration：
  - `books.listing_type`、`books.item_category`。
  - 更新 `list_books_page`、`count_books_filtered`、`list_pending_reviews_page`、`list_my_books`。
  - 新增 public catalog type/category index。
- 更新 `components/marketplace-app.tsx`：
  - 首頁新增「課本 / 二手物品」切換。
  - 二手區 hero、搜尋 placeholder、分類篩選、列表卡片、詳情頁依類型切換文案與顯示欄位。
  - 刊登表單支援課本/二手物品兩種模式；二手模式隱藏作者、版本、課程、老師、科系欄位。
  - 桌機右上角三條線選單啟用，桌機和手機共用選單邏輯。
- 更新 `app/globals.css`：
  - 新增 `.theme-secondhand` 第二套主題 token。
  - 新增二手商店感 hero、卡片、篩選、footer、表單類型切換樣式。
  - 桌機三條線 dropdown 樣式與手機全寬選單樣式共存。

## 剩餘工作

- 提交並推送 `codex/secondhand-marketplace` 分支。
- 建立 PR 到 `main`。
- 等 GitHub checks、AI handoff、Release Readiness、Staging Migration、Vercel Preview 通過。
- 合併 PR 後確認 Production Deployment Monitor 成功。
- 在 production 套用 `20260616090000_secondhand_listing_type.sql` migration。
- 使用 production `/api/health/release` 驗證 deployed commit，並抽查首頁、二手切換、桌機選單、`/api/marketplace/count?listingType=secondhand`。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `app/api/marketplace/count/route.ts`
- `lib/types.ts`
- `lib/marketplace/filters.ts`
- `lib/marketplace/mappers.ts`
- `lib/marketplace/queries.ts`
- `supabase/migrations/20260616090000_secondhand_listing_type.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md`（完成交接時由 script 產生）

## 驗證結果

本機已通過：

- TypeScript：`node node_modules/typescript/bin/tsc --noEmit`
- ESLint：`node node_modules/eslint/bin/eslint.js .`
  - 通過，僅剩既有 `@next/next/no-img-element` warning，無 error。
- Project checks：`node scripts/run-project-checks.mjs`
  - 16/16 passed。
- Production build：`node node_modules/next/dist/bin/next build`
  - 通過，僅剩既有 `<img>` warning。
- Browser 本機檢查：
  - 桌機寬度可切換二手物品區，`main.theme-secondhand` 生效。
  - 二手分類篩選顯示完整分類。
  - 桌機右上角三條線 dropdown 可開啟，顯示「逛二手 / 我要刊登 / 我的交易 / 登入 / 註冊」。
  - 手機 390px 寬度下，選單全寬顯示且二手主題仍生效。

## 風險或阻礙

- 這次 migration 改了 RPC 簽名。前端已同步新參數，但 production database 必須套 migration 後二手列表/count 才會完整可用。
- `list_books_page` 舊簽名會被 drop，新簽名保留預設值；若外部工具直接用舊 positional RPC 參數，需同步更新。
- 目前仍沿用 `books` 命名，所以 admin/report/notification 文案多數仍是「刊登」語意；未做大規模資料表 rename。
- 未追蹤本機檔案維持不提交：`.cursor/mcp.json`、`_run_verify.cmd`、`_verify_report.txt`、`output/`。

## 下一個 AI 的操作

1. 確認 `git status` 只包含本次二手 marketplace 相關追蹤檔與 migration。
2. 執行 `scripts/ai-collaboration.mjs complete codex` 產生 history 並更新 state。
3. Commit、push、建立 PR。
4. 監看 GitHub/Vercel checks，合併後確認 production deployment。
5. 套 production Supabase migration，最後用 `/api/health/release` 與 production UI/API smoke checks 驗證。

## 最後基準 Commit

待提交。
