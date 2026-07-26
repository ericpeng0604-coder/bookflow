# BookFlow AI Handoff

## 任務目標

集中 conversation read recovery 到 navigation seam，移除
`TradeChatPanel` 直接呼叫資料層的 seam leak，並完成可追溯發布準備。

## 目前狀態與背景

- Task ID: `20260726-marketplace-conversation-recovery`.
- Task: Centralize conversation read recovery behind navigation.
- Branch: `agent/marketplace-architecture-20260726`.
- Base commit: `0a65850fb04cb9afae751e8e6f8a616096eb3e6f`.
- History: `.ai/history/20260726-marketplace-conversation-recovery.md`.
- Current commit: `a63a612`.
- PR #140 已建立為 draft；尚未 merge 或部署。
- 無 database migration；staging migration 為 NOT APPLICABLE。
- 未修改 GitHub workflow 或 protected recovery file。

## 已完成

- 新增 conversation navigation policy，涵蓋 local read、recovery、restore、remove。
- 將 app-level mark-read 導向 policy 與 refresh-on-failure seam。
- 移除 `TradeChatPanel` 直接 data-layer mark-read 呼叫。
- 新增 reset、restore、hide、recovery focused behavior checks。
- 已建立 commit `e6d1e734ed58651e1c34523e42454355e1892ba1` 與
  handoff metadata commit `b22aadc46e95beb80098a7ccb0d5c3454689569b`。

## 下一步

1. 通過 PR #140 required checks 與 review。
2. Merge 後記錄 exact full main SHA。
3. 以該 SHA 執行 protected production release workflow。
4. 驗證 `/api/health/release` 與 production smoke 使用同一 SHA。

## 變更檔案

- `components/marketplace-app.tsx`
- `components/marketplace/conversation-navigation-policy.ts`
- `scripts/check-conversation-navigation-behavior.mjs`
- `package.json`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260726-marketplace-conversation-recovery.md`
- `AI_WORK_MANUAL.md`

## 驗證結果

- Conversation navigation behavior: 4/4 passed。
- Trade chat checks: 9/9 passed。
- Chat switching checks: 5/5 passed。
- Changed-file ESLint、TypeScript、production build passed。
- Release plan：clean。
- Release preflight：passed。
- Full release:local：passed（35/35 project checks、typecheck、lint、production build）。

## 風險與注意事項

- 原始 dirty checkout 的 seller、bundle 與其他 unrelated edits 已排除。
- Protected recovery files 保持未修改。
- Merge SHA、production deployment、release health、production smoke 尚未驗證。
- 未取得上述證據前，不可宣稱 production 已部署。

## 下一位 AI 工作指引

1. 先重跑 `release:preflight`，確認 handoff/state/history 同步。
2. 使用 compact PR gate wait，避免展開大量 CI log。
3. 只以 exact merged full SHA 執行 production workflow。
4. 持續同步 `AI_HANDOFF.md`、`.ai/state.json` 與 `.ai/history/*.md`。

## 相關 Commit

- Base commit: `0a65850fb04cb9afae751e8e6f8a616096eb3e6f`。
- Implementation commit: `e6d1e734ed58651e1c34523e42454355e1892ba1`。
- Current metadata commit: `b22aadc46e95beb80098a7ccb0d5c3454689569b`。
- CI typecheck fix: `a63a612`。
