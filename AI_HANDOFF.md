# BookFlow AI Handoff

## 任務目標

將 notification feed 的資料載入、已讀更新、定時刷新與 reset 行為從
`MarketplaceApp` 集中到 headless module，保留通知路由在 caller。

## 目前狀態與背景

- Task ID: `20260726-marketplace-notification-feed`.
- Task: Extract the notification feed module from MarketplaceApp.
- Branch: `agent/marketplace-wave1-20260726`.
- Base commit: `1bdf349d1937fdad79340f97bb923fa71e92c30a`.
- History: `.ai/history/20260726-marketplace-notification-feed.md`.
- PR: not opened yet.
- No database migration is included; staging migration is NOT APPLICABLE.
- No GitHub workflow or protected recovery file is changed.

## 已完成

- Added `useNotificationFeed` for feed loading, unread count, mark-read,
  mark-all-read, visibility refresh, and user reset.
- Removed duplicate notification data-layer functions from `MarketplaceApp`.
- Kept notification destination routing in `MarketplaceApp`.
- Added focused static module checks and updated the existing refresh contract.

## 下一步

1. Pass full local release gates and release preflight.
2. Commit only the notification feed scope and open a draft PR.
3. Wait for required checks, then merge after review.
4. Deploy the exact merged main SHA and verify production health and smoke.

## 變更檔案

- `components/marketplace-app.tsx`
- `components/marketplace/use-notification-feed.ts`
- `scripts/check-notification-feed.mjs`
- `scripts/check-notification-refresh.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260726-marketplace-notification-feed.md`

## 驗證結果

- Notification feed module checks: passed.
- Notification and transaction refresh checks: 6/6 passed.
- TypeScript typecheck: passed.
- Changed-file ESLint: passed.
- Full `release:local`: pending.
- Production deployment and smoke: NOT VERIFIED.

## 風險與注意事項

- Workspace, conversation navigation, and trade chat module work is excluded
  from this release wave.
- Original dirty checkout changes remain excluded.
- Protected recovery files remain unchanged.
- Do not claim production deployment until merged full SHA, release health,
  and production smoke are verified.

## 下一位 AI 工作指引

1. Run `release:local` and `release:preflight` before staging.
2. Stage only the eight listed release files.
3. Use compact PR gate waiting and preserve required checks.
4. Use the exact merged full SHA for production deployment and smoke.
5. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in sync.

## 相關 Commit

- Base commit: `1bdf349d1937fdad79340f97bb923fa71e92c30a`.
- Current implementation commit: not committed yet.
