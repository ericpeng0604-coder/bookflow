# BookFlow AI Handoff

## 目前目標

用一句話描述目前要完成的任務與成功狀態。

## 重要背景與決策

- Branch: `<branch>`.
- Base commit: `<base-commit>`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add `Rollback-Workflow-Approved: true` unless this is an authorized rollback/recovery change.

## 已完成

- 列出已經完成且有證據的工作。

## 剩餘工作

1. 列出下一步操作。
2. 包含 PR、merge、production smoke 等尚未完成的 release 步驟。

## 修改範圍

- `path/to/file`

## 驗證結果

- `command`: passed / failed / NOT VERIFIED。

## 風險或阻礙

- 列出仍然存在的風險、阻礙或需要人工確認的事項。

## 下一個 AI 的操作

1. 寫下下一個 AI 應該照做的具體步驟。
2. 保持 `AI_HANDOFF.md`、`.ai/state.json`、`.ai/history/*.md` 同步。

## 最後基準 Commit

- Base commit: `<base-commit>`.
- Current implementation commit before final commit: `<sha-or-not-committed-yet>`.
