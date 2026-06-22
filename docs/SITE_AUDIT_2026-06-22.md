# BookFlow 全站品質稽核

日期：2026-06-22
正式站原始 commit：`0148e0455903f50932c2de8d3785790f7de0bb45`

本報告列出本輪確認到的問題，不宣稱涵蓋所有可能問題。

## 摘要

| 等級 | 已確認 | 已修正於分支 | 尚待 staging/production |
|---|---:|---:|---:|
| P0 | 0 | 0 | 0 |
| P1 | 9 | 9 | 9 |
| P2 | 12 | 11 | 12 |
| P3 | 6 | 6 | 6 |

## 已確認與修正

| 等級 | 問題與影響 | 根本原因／範圍 | 修正與自動化驗證 |
|---|---|---|---|
| P1 | 正式頁缺少 CSP、nosniff、frame、referrer、permissions、COOP/CORP | `next.config.ts` 無安全標頭 | 建立 allowlist CSP 與完整標頭；本機 production HTTP header probe passed |
| P1 | API 可被同一使用者/IP 重複觸發 | AI、通知、push、OTP、count routes 無持久限流 | `consume_api_rate_limit`、abuse log、body/content-type/timeout；hardening checks passed |
| P1 | Gemini 失敗仍可能消耗額度，重送可能重複扣除 | 使用前直接 increment | reservation/idempotency/complete/release；quota regression passed |
| P1 | seller update grant 漏 publisher/marketplace 欄位，修改 publisher 不一定回 pending | migration 權限與 trigger 漂移 | 明確 column allowlist、review trigger 同步教材欄位；migration checks passed |
| P1 | 刊登欄位缺少一致長度與價格上限 | 表單、前端與 DB constraint 不一致 | HTML、TS validation、PostgreSQL constraints；validation tests passed |
| P1 | 學生證圖片/OCR 無完整保存與撤回政策 | Storage 與 row lifecycle 分離 | pending dedupe、2/day、consent、撤回、審核即刪、30-day cleanup、audit |
| P1 | 聊天通知可能暴露訊息內容，失敗可無限重試 | notification payload/retry 無隱私與終止狀態 | generic preview、5 次上限、abandoned 狀態、timeout |
| P1 | 缺少帳號刪除／匿名化流程 | Auth、公開個資與交易 FK 未設計共同流程 | `/api/account/delete`、soft auth delete、資料匿名化與最小保留 |
| P1 | 課本版本資訊不足時容易買錯 | 只有自由文字、無結構化教材欄位 | 出版社/冊次/ISBN/課綱等欄位；下訂前強制版本確認 |
| P2 | modal 無完整 dialog semantics、焦點鎖與背景隔離 | 共用 modal 只做視覺層 | role、aria、focus trap、Escape、restore、inert；實際瀏覽器 passed |
| P2 | 重要操作使用 `window.prompt/confirm` | 缺乏站內確認元件 | 所有重要操作改為站內 ActionDialog；static check passed |
| P2 | 刊登在 OCR、網路失敗或離開時可能失去輸入 | 無草稿生命週期 | local draft/autosave/beforeunload；圖片不持久化 |
| P2 | 320–430px 控制項小於 44px | 手機 CSS 高度不足 | touch target 修正；四種 viewport 實測 0 個可見小控制項 |
| P2 | 圖片只信 MIME/副檔名，缺少像素上限 | upload validation 太寬鬆 | magic bytes、40MP 上限、canvas 重編碼去 EXIF、JPEG fallback |
| P2 | Tesseract 依賴外部 script CDN | runtime 動態插入 jsDelivr | 改專案鎖定套件 lazy import，保留安全 AI/manual fallback |
| P2 | 商品 detail query 未登入時不穩定，失效商品無狀態 | URL state 綁登入流程 | 公開 deep link、market query、popstate、missing state |
| P2 | OCR 只處理一般書名/作者 | 無台灣教材 taxonomy | 教育階段、年級、學期、科目、冊次、課綱、類型、審定字號 |
| P2 | OCR 無 ISBN/EAN、正反面、候選與回饋 | 單張、單來源草稿 | BarcodeDetector、兩張照片、candidate ranking、匿名修正回饋 |
| P2 | 通知與管理缺乏足夠稽核／清理 | operational rows 無 retention | moderation audit、資料類型 retention cleanup、orphan chat image cleanup |
| P2 | 離線狀態不清楚 | 無 online/offline UX | 離線 banner，保留已載入內容與草稿 |
| P2 | 首頁 First Load JS 偏高 | `marketplace-app.tsx` 過度集中 | OCR/AI 已 lazy load；目前 216 kB，仍待拆聊天與後台 |
| P3 | 二手市場殘留課本文案 | 共用固定字串 | 搜尋、footer、skip/empty/meta 依市場切換；browser passed |
| P3 | 正式站顯示 Prototype／未完成控制 | prototype label、disabled filter | 移除 prototype 與「即將推出」控制 |
| P3 | 空市場與無結果混在一起 | 單一 empty state | 分流真空市場與 filter-no-result，提供刊登/清除動作 |
| P3 | robots、sitemap、manifest、icons 缺失 | 公開站 metadata 不完整 | 新增公開檔案、canonical、OG、Twitter、theme/apple icon |
| P3 | 缺少隱私、條款與交易安全頁 | 無使用者可見政策 | `/privacy`、`/terms`、`/safety` 與 footer links |
| P3 | PWA push deep link 缺乏更新與 origin 防護 | service worker 僅處理通知 | skipWaiting/claim/update、same-origin safe target |

## 台灣教材 benchmark

- 版本：`2026-06-22`
- 一般回歸：73 個案例全部通過。
- 獨立 holdout：20 個案例、90 個預期欄位。
- Recall：`1.000`
- Precision：`0.928`
- 支援出版社／別名：翰林、康軒、南一、龍騰、泰宇、三民、全華、東大、育達。
- 不確定欄位留空；不自動填價格、書況或刊登說明。

## 資料保存與清理

| 資料 | 用途 | 保存／刪除 |
|---|---|---|
| 學生證圖片與 OCR | 人工資格審核 | 審核/撤回立即刪除；殘留紀錄最多 30 天 |
| API 限流 | 防濫用 | bucket 2 天；blocked event 30 天 |
| AI 額度 | 成本與濫用控制 | reservation/usage 最多 30/180 天 |
| 已解決 feedback | 支援與改善 | 180 天 |
| 已解決檢舉 | 安全與申訴 | 365 天 |
| 通知 | 交易與操作提示 | 180 天 |
| 失效 push subscription | 裝置通知 | 停用/高失敗 90 天 |
| OCR 修正回饋 | 改善辨識 | 180 天 |
| 管理操作 audit | 安全稽核 | 730 天 |
| orphan chat images | 聊天附件 | 無訊息引用且超過 30 天刪除 |

## 已執行驗證

- TypeScript、ESLint、23/23 project checks、workflow checks、production build。
- PostgreSQL parser：105 個 migration statements accepted。
- 實際瀏覽器：modal、鍵盤、Escape、inert、320/375/390/430、二手市場、失效 deep link。
- robots、sitemap、manifest、政策頁 HTTP 200。
- npm lockfile audit：0 high/critical；2 moderate PostCSS advisories。

## NOT VERIFIED

- staging migration 實際套用、RPC signature、query plan 與完整 RLS allow/deny。
- Google OAuth、Email OTP、密碼重設與管理員 OTP 的真實 provider 流程。
- 真實兩買家併發、買賣雙方同時取消/確認及通知 claim race。
- 真實 Resend、Web Push 多裝置部分成功與 dead-letter 人工處理。
- iOS Safari、Android Chrome 與真實裝置螢幕閱讀器。
- 200% 瀏覽器縮放（自動化介面未能證實實際縮放值）。
- staging 容量測試與 RPC latency；未對 production 做負載測試。
- 真實教材照片 Gemini fallback 與實際 ISBN 條碼相機掃描。
- production exact commit、migration、release smoke 與桌機/手機 smoke。

## Rollback

- 應用程式：使用既有受保護 rollback workflow 回復部署 commit。
- 資料庫：本 migration 以 additive expand/contract 為主；應用 rollback 不自動回滾 schema。
- 若新欄位/RPC 發生問題，先回復應用使用舊欄位，再以獨立修復 migration 調整；不得直接刪除仍可能被舊/新版本使用的欄位。
