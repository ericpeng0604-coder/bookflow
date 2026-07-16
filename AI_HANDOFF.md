# BookFlow AI Handoff

## 任務目標

將聊聊頁整理成可正式發布的 IG 風格響應式介面：桌機維持左側聊天室列表與右側聊天內容，手機在列表與全螢幕聊天室之間切換，並保留既有交易聊天功能。

## 目前狀態與背景

- Branch: `codex/ig-chat-layout`。
- Base commit: `ae7174f6a3f235fcd425c1ebf1f778efe20a549c` (`origin/main`)。
- 本發布 worktree 從 `origin/main` 建立，未混入原工作區的學生驗證、OCR 或其他未提交修改。
- 本次沒有資料庫 migration、GitHub workflow、rollback 檔案或 `.github/CODEOWNERS` 變更。
- 正式部署目標為 `https://bookflow-green.vercel.app`，須依既有 PR、合併 `main`、Vercel 部署流程完成。

## 已完成

- 桌機版改為固定雙欄：左側聊天室列表持續可見，右側只更新目前選取的 `TradeChatPanel`。
- 加入選取狀態、`aria-current`、鍵盤 focus 狀態與穩定的列表欄寬。
- 手機版初始顯示聊天室列表，選取後切換全螢幕聊天內容，返回後恢復列表。
- 移除會讓列表消失的折疊狀態與多餘的聊天工具列，不新增底部導覽按鈕。
- 保留既有商品資訊卡、快速回覆、附件、圖片、檢舉、封鎖、結束聊天室、訊息載入、即時更新、已讀、舊訊息載入與非同步切換保護。
- 更新聊天版面檢查，涵蓋桌機列表保留與手機列表／聊天兩種狀態。

## 下一步

1. 完成 release scope、AI handoff、workflow 與 production preflight。
2. 建立乾淨 commit、推送分支並建立 PR，等待必要檢查。
3. 合併後用正式 commit 驗證 `/api/health/release`、首頁與 release smoke；若缺少登入工作階段，將正式聊天流程標示為 NOT VERIFIED。

## 變更檔案

- `app/globals.css`
- `components/marketplace-app.tsx`
- `scripts/check-chat-listing-order-ux.mjs`
- `scripts/check-chat-visibility-and-feedback.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260716-ig-chat-layout-release.md`

## 驗證結果

- `pnpm run typecheck`: passed。
- `pnpm run lint`: passed。
- `pnpm run check:chat-state`: passed。
- `pnpm run check:trade-chat`: passed。
- `pnpm run check:chat-listing-order-ux`: passed (23/23)。
- `node scripts/check-chat-visibility-and-feedback.mjs`: passed (9/9)。
- `pnpm run check:project`: passed (29/29)。
- `pnpm run build`: passed；建置完成並產生 22/22 靜態頁。pnpm 非 lockfile 安裝環境曾記錄非阻斷性的 Next ESLint plugin 載入警告，需在 PR／CI 的 npm lockfile 環境再次確認。
- Production deployment、登入後聊天流程與正式 commit: NOT VERIFIED until merge and post-deploy smoke。

## 風險與注意事項

- 本次只發布聊天 UI 與既有聊天互動，不新增資料庫欄位或 migration。
- 未登入的本機瀏覽器無法證明 Supabase 聊天資料、權限、即時更新或正式登入後流程；不得將未驗證項目描述為已上線。
- 快速切換仍依賴現有 `TradeChatPanel` 的 key 與非同步請求保護；發布前需用瀏覽器實際切換至少三個聊天室。
- 不修改 rollback workflow、recovery workflow 或 `.github/CODEOWNERS`。

## 下一位 AI 工作指引

1. 只在本發布 worktree 處理本次聊天範圍，保留原工作區所有未提交修改。
2. 先執行 `node scripts/check-release-scope.mjs`、`node scripts/ai-collaboration.mjs check-ci origin/main HEAD` 與 `node scripts/release-preflight.mjs`，再建立 commit。
3. PR 檢查完成後才合併；合併後以 `/api/health/release` 的 `commit` 與 `EXPECTED_COMMIT` 對照，再執行 release smoke。
4. 所有新增或修改的中文檔案維持 UTF-8，並掃描 replacement character `U+FFFD` 與 mojibake。
5. 保持 `AI_HANDOFF.md`、`.ai/state.json` 與對應 history entry 同步。

## 相關 Commit

- Base commit: `ae7174f6a3f235fcd425c1ebf1f778efe20a549c`。
- Current implementation commit: the final release commit on this branch; verify with `git rev-parse HEAD`。
