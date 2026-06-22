# AI 交接歷史

- 任務：fix Gemini OCR response parsing for stylized Chinese textbook covers
- 執行者：codex
- 狀態：完成
- 基準 Commit：`9372a6780be083e0a81d7ac3498088cae6ed0416`
- 封存時間：2026-06-22T02:49:35.361Z

---
# BookFlow AI Handoff

## 目前目標

修正 Gemini 對陰影、描邊與圖片背景中文字封面回傳「格式無法辨識」的正式站缺陷。

## 重要背景與決策

- 基準為已上線的 `origin/main` commit `9372a6780be083e0a81d7ac3498088cae6ed0416`。
- 問題範例為《微積分》第九版封面；圖片檔正常，但本機 OCR 漏掉立體陰影書名，Gemini fallback 回傳無法被舊解析器解析。
- 工作位於獨立 worktree 與 `codex/fix-gemini-ocr-response`，未帶入主工作區修改。
- 未修改 rollback、rollback protection 或 CODEOWNERS 三個受保護檔案。
- 新 migration 採 additive expand/contract；正式 migration 必須先通過 staging workflow。
- OCR 採本機 Tesseract、結構化台灣教材規則、EAN-13、正反面照片與 Gemini fallback；不確定欄位留空。
- 使用者已授權在 staging 與檢查通過後完成合併、production migration、部署及正式站驗證；禁止 production 負載測試。

## 已完成

- Gemini 回傳會合併同一 candidate 的所有文字 parts，不再只讀第一段。
- JSON 解析可處理 markdown fence、前後說明文字與字串跳脫，仍拒絕不完整 JSON。
- 結構化輸出額度由 500 提升為 1200 tokens，並關閉此抽取任務不需要的 thinking。
- 提示詞明確要求辨識帶陰影、描邊、漸層或照片背景的繁體中文大標題。
- 加入 multipart、前後文字、不完整 JSON、輸出額度與 thinking 設定回歸測試。

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

- 完成 production build、commit、PR 與 Release Readiness。
- 合併後等待 Vercel exact SHA，執行 release smoke。
- 以真實登入帳號重試同一張《微積分》第九版封面。

## 修改範圍

- Next.js UI、API routes、SEO/PWA、政策頁與安全標頭。
- Marketplace OCR、教材 metadata、搜尋、圖片與通知模組。
- `supabase/migrations/20260622090000_site_quality_hardening.sql`。
- project/staging checks、OCR benchmark、依賴宣告與工作手冊。
- AI handoff/state/history 與完整稽核報告。

## 驗證結果

- 實際圖片確認：標準 JPEG、720×960、134235 bytes；不是檔案或尺寸問題。
- 本機 Tesseract 實測只讀到作者列，漏掉「微積分」「第九版」「滄海圖書」，因此安全規則正確觸發 Gemini fallback。
- AI fallback 回歸測試：passed。
- TypeScript：passed。
- 修改檔 ESLint：passed，0 errors / 0 warnings。
- Project checks：23/23 passed。
- Production build：passed；首頁 First Load JS 維持 216 kB。

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

`9372a6780be083e0a81d7ac3498088cae6ed0416`
