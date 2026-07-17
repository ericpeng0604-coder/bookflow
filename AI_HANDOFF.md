# BookFlow AI Handoff

## 任務目標

只發布本次聊天室相關範圍：刊登照片與封面 AI、通知面板、聊天室返回，以及對應的響應式 UI 排版；排除其他產品功能。

## 目前狀態與背景

- Task ID: `20260718-release-candidate-toolkit`.
- Task: `implement local release candidate and deployment evidence toolkit`.
- Branch: `codex/release-candidate-toolkit`.
- Base commit: `b789ae4e7d5616392862dde2165ac78e998e56cf`.
- History: `.ai/history/20260718-release-candidate-toolkit.md`.
- No database migration is included.
- GitHub workflow change: `.github/workflows/release-readiness.yml` uses the local release runner and uploads evidence.
- Do not add `Rollback-Workflow-Approved: true`.

## 已完成

- 刊登表單支援最多六張照片、設定與刪除封面，並在商品詳情頁提供照片切換。
- AI 辨識只讀取目前封面；更換封面保留原文字並提示重新辨識。
- 通知面板支援外部點擊與 Escape 關閉。
- 聊天返回明確移除 `conversation`，回到 `view=chat&tab=chats`。
- 移除桌面帳號名稱旁的登出按鈕，保留選單內登出入口。
- 刊登表單補上照片／課本資料／交易資訊分區導覽，並改善手機版文字與照片上傳卡排版。

## 下一步

1. 等待 PR 品質、Vercel 與資料庫 migration 檢查。
2. 合併後確認 production smoke。

## 變更檔案

- `scripts/release-candidate.mjs`
- `scripts/release-watch.mjs`
- `scripts/lib/release-candidate.mjs`
- `tests/release-candidate.test.mjs`
- `.github/workflows/release-readiness.yml`
- `app/globals.css`
- `lib/types.ts`
- `lib/marketplace/mappers.ts`
- `supabase/schema.sql`
- `supabase/migrations/20260717151328_book_gallery.sql`
- `AI_HANDOFF.md`
- `.ai/state.json`

## 驗證結果

- TypeScript check: passed.
- Targeted listing, OCR, chat, and notification checks: passed.
- ESLint for modified source: passed; CSS was ignored by ESLint configuration.
- Production build: passed.
- Local browser interaction: NOT VERIFIED on this clean release worktree.

## 風險與注意事項

- Staging migration was applied and its migration history was checked.
- Existing Supabase advisor notices are repository-wide and unrelated to this change.

## 下一位 AI 工作指引

1. Keep the release scope limited to the files and behaviors listed above.
2. Keep `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/*.md` in sync.

## 相關 Commit

- Base commit: `00ebb7a`.
- Current implementation commit before final commit: `00ebb7a`.
