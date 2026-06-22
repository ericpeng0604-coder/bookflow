# AI 交接歷史

- 任務：remove advanced textbook metadata fields from listing form
- 執行者：codex
- 狀態：完成
- 基準 Commit：`b00deb91c4433e3144d396113428956b385f1c54`
- 封存時間：2026-06-22T12:59:31.131Z

---
# BookFlow AI Handoff

## 目前目標

簡化課本刊登表單，移除出版社與進階教材 metadata 欄位。

## 重要背景與決策

- 基準為已上線的 `origin/main` commit `b00deb91c4433e3144d396113428956b385f1c54`。
- 工作位於獨立 worktree 與 `codex/simplify-book-listing-form`，未帶入主工作區修改。
- 資料庫 schema 與既有刊登資料不刪除；本次只簡化賣家輸入流程。
- 未修改 rollback、rollback protection 或 CODEOWNERS 三個受保護檔案。
- 新 migration 採 additive expand/contract；正式 migration 必須先通過 staging workflow。
- OCR 採本機 Tesseract、結構化台灣教材規則、EAN-13、正反面照片與 Gemini fallback；不確定欄位留空。
- 使用者已授權在 staging 與檢查通過後完成合併、production migration、部署及正式站驗證；禁止 production 負載測試。

## 已完成

- 從課本刊登／編輯表單移除：出版社、教育階段、年級、學期、科目、冊次／部別、課綱、書籍類型、ISBN-13、審定字號。
- OCR 自動填寫縮減為書名、作者與版本，不再建立使用者看不到的 metadata。
- 移除 ISBN 條碼掃描接線，避免不可見欄位被自動寫入。
- 編輯既有刊登時以隱藏保留值維持原 metadata；新刊登一律為空，不會誤寫或清空舊資料。
- OCR 修正回饋只比較仍可由使用者確認的書名、作者與版本。
- 加入表單欄位移除、舊資料保留及不可見 OCR metadata 的回歸檢查。

- 補齊安全標頭、API body/content-type/timeout/rate-limit、濫用紀錄與安全錯誤。
- AI 額度改為 reservation/idempotency/complete/release，失敗或無可用結果不扣永久額度。
- 修正 seller column grant、publisher/新教材欄位修改後重新審核與資料庫長度限制。
- 學生證 pending 去重、每日限制、同意、撤回、審核即刪除敏感資料、30 天清理及管理稽核。
- 通知移除聊天內容預覽，加入 5 次重試上限、abandoned/dead-letter 狀態及供應商 timeout。
- 所有重要操作改為站內 modal；加入刊登草稿、離開提醒、離線狀態與 44px 觸控尺寸。
- 建立帳號刪除／匿名化 API 與 UI，移除非必要資料並保留匿名交易／安全紀錄。
- 建立 robots、sitemap、manifest、icon、metadata、政策頁與安全 deep link。
- 台灣教材欄位、搜尋正規化、出版社別名、ISBN/EAN、審定字號、候選排序、修正回饋及版本確認警告。
- Tesseract 改為專案鎖定套件動態載入；圖片驗證實際 magic bytes、像素上限、EXIF 重編碼與 JPEG fallback。
- 稽核報告：`docs/SITE_AUDIT_2026-06-22.md`。

## 剩餘工作

- commit、PR、Release Readiness、合併與正式站 exact-SHA smoke。
- 使用登入帳號確認正式站課本刊登表單只保留必要欄位。

## 修改範圍

- Next.js UI、API routes、SEO/PWA、政策頁與安全標頭。
- Marketplace OCR、教材 metadata、搜尋、圖片與通知模組。
- `supabase/migrations/20260622090000_site_quality_hardening.sql`。
- project/staging checks、OCR benchmark、依賴宣告與工作手冊。
- AI handoff/state/history 與完整稽核報告。

## 驗證結果

- TypeScript：passed。
- 修改檔 ESLint：passed，0 errors / 0 warnings。
- Project checks：23/23 passed。
- Production build：passed；首頁 First Load JS 由 216 kB 降至 215 kB。

## 風險或阻礙

- migration 尚未套用 staging 或 production，RLS/RPC 仍需真實資料庫驗證。
- 首頁 First Load JS 216 kB，高於原正式基準約 204 kB，需後續拆分聊天與管理工作區。
- Google OAuth、Email OTP、真實推播／Email、iOS Safari、Android Chrome 與真實 AI 圖片請求尚未完成 staging/production 驗證。
- 200% 瀏覽器縮放曾嘗試檢查但自動化介面未能證實縮放值，仍需人工或真實瀏覽器驗證。
- 未在 production 執行負載測試；容量測試只允許 staging。

## 下一個 AI 的操作

1. 執行最後完整 `npm run check:all`、workflow、encoding 與 protected-file diff。
2. commit/push、建立 PR，監看 required checks 與 staging migration。
3. staging 通過後合併，執行 production migration 與 exact-SHA release smoke。
4. 更新本文件與稽核報告中的最終 commit、migration 與正式站證據。

## 最後基準 Commit

`b00deb91c4433e3144d396113428956b385f1c54`
