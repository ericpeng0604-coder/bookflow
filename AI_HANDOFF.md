# BookFlow AI Handoff

## 任務目標

修復手機多圖商品詳情、圖片切換卡頓、低調 footer 版本標示與隱藏列表 UI，並透過既有 release 流程部署正式站。

## 目前狀態與背景

- Task ID: `20260718-mobile-gallery-version-release`.
- Task: `fix mobile multi-image details and release versioning`.
- Branch: `codex/release-candidate-toolkit`.
- Base commit: `b789ae4e7d5616392862dde2165ac78e998e56cf`.
- History: `.ai/history/20260718-mobile-gallery-version-release.md`.
- No database migration is included in the current changes.
- Protected recovery files are unchanged.

## 已完成

- 統一整理 `image_url` 與 `image_urls`：封面優先、移除空值與重複網址，並相容舊單圖資料。
- 商品詳情若只拿到封面，背景補抓完整 gallery。
- 手機版加入主圖、數量、左右切換、可橫向滑動縮圖、安全 fallback 與最多六張預載入。
- footer 版本由 `package.json` 注入，以低對比小字顯示。
- 新增 gallery 與隱藏列表 UI regression checks。
- 新增 `release:version:patch`，每次正式部署將 patch 版本加 `0.0.1` 並同步 lockfile。

## 下一步

1. 推送 branch 並建立 PR，等待 CI 與 Vercel。
2. 通過必要 gate 後合併至 `main`，等待正式部署。
3. 用合併後完整 SHA 驗證 `/api/health/release` 與 production smoke。

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `lib/marketplace/mappers.ts`
- `next.config.ts`
- `scripts/check-book-gallery.mjs`
- `scripts/bump-version.mjs`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/run-project-checks.mjs`
- `package.json`
- `package-lock.json`
- `docs/RELEASE_WORKFLOW.md`
- `AI_WORK_MANUAL.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260718-mobile-gallery-version-release.md`

## 驗證結果

- Memory contract: passed.
- Project checks: passed, 34/34.
- Book gallery check: passed, 7/7.
- Chat/listing order UX check: passed, 25/25.
- TypeScript、ESLint、production build: passed。
- Local browser auth smoke reached the Google account chooser with process-local public Supabase configuration; no credentials were stored.

## 風險與注意事項

- No database migration or protected recovery file change is included.
- Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings are non-blocking and pre-existing; all required gates passed。
- 若正式站尚未套用既有 gallery migration，發布前需先完成該 migration 的 staging/production parity。

## 下一位 AI 工作指引

1. 保持 `AI_HANDOFF.md`、`.ai/state.json` 與指定 history file 同步。
2. 使用 `node scripts/release-pr-status.mjs --wait <pr>` 低輸出等待 PR checks。
3. 部署後用正式站 `/api/health/release` 與 `release:smoke` 驗證 exact merged SHA。

## 相關 Commit

- Base commit: `b789ae4e7d5616392862dde2165ac78e998e56cf`.
- Feature commit: `d816a8d`.
- Release candidate commit: `bf9bf21459a6bc785ed8a45f098fe450946008f3`.
