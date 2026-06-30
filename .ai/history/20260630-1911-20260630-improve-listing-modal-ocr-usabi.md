# AI 交接歷史

- 任務：improve listing modal OCR usability
- 執行者：codex
- 狀態：完成
- 基準 Commit：`fa8b1ce017e0f19c47475ca0412b7d27fb444f69`
- 封存時間：2026-06-30T19:11:00.054Z

---
# BookFlow AI Handoff

## 目前目標

- 改善刊登課本 modal 的使用體驗：拖曳選字到小視窗外放開時不關閉、記住上次課本科系、OCR/AI 辨識顯示進度條。
- 強化 OCR/AI 對 `[上冊]`、`【上冊】`、`上册` 等上下冊標記的辨識。

## 重要背景與決策

- Branch: `codex/listing-modal-ocr-usability`.
- Base: `fa8b1ce017e0f19c47475ca0412b7d27fb444f69`.
- 本次從乾淨 main worktree 實作，沒有使用原本髒的 `codex-2` 工作區。
- 刊登表單只記住使用者指定的「科系」，不記住課程、老師、面交地點或其他欄位。
- OCR 仍維持保守：只填入可見或可信的書名、作者、版本/上下冊，不自動填價格、書況或備註。
- 沒有資料庫 migration。
- 沒有修改受保護 rollback/recovery 檔案。

## 已完成

- `ModalShell` 新增可設定的 backdrop 關閉行為，刊登表單停用背景點擊關閉，避免拖曳選字時誤關。
- 新刊登課本會用 localStorage 記住上次選擇的有效科系，編輯既有刊登不套用。
- OCR/AI 辨識流程新增可見進度條，既有階段文字仍保留。
- 本機 OCR 支援 bracketed 上下冊與簡體 `册`，AI normalize 會把 `volume` 合併到 `edition`。
- 已更新 listing UI、free OCR、AI OCR 回歸檢查。

## 剩餘工作

- 完成 AI collaboration 狀態。
- Commit、push、開 PR、等 checks、合併。
- 等正式站部署到合併 commit 後跑 production release smoke。

## 修改範圍

- `components/marketplace-app.tsx`
- `app/globals.css`
- `lib/marketplace/free-ocr.ts`
- `lib/server/book-ocr-ai.ts`
- `scripts/check-listing-navigation-ui.mjs`
- `scripts/check-free-ocr-book-covers.mjs`
- `scripts/check-book-ocr-ai.mjs`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/*.md` after completion

## 驗證結果

- `node scripts/check-listing-navigation-ui.mjs`: passed.
- `node --experimental-strip-types scripts/check-free-ocr-book-covers.mjs`: passed, 11/11.
- `node --experimental-strip-types scripts/check-book-ocr-ai.mjs`: passed.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- `node scripts/run-project-checks.mjs`: passed, 23/23 checks.
- `node node_modules/next/dist/bin/next build`: passed.
- Protected rollback/recovery files diff check: no changes.

## 風險或阻礙

- 風險低到中：UI 行為和 OCR 規則有使用者可見變更，但不涉及資料庫或交易流程。
- 實際登入後的拖曳選字和 OCR 進度條仍建議在正式站部署後由使用者畫面重測一次。

## 下一個 AI 的操作

1. Run `node scripts/ai-collaboration.mjs check`.
2. Complete AI collaboration state.
3. Commit and push `codex/listing-modal-ocr-usability`.
4. Open and merge PR after required checks pass.
5. Verify production commit and run release smoke.

## 最後基準 Commit

`fa8b1ce017e0f19c47475ca0412b7d27fb444f69`
