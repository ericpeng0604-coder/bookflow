## 2026-07-17 — staging migration history repair for message release

- The staging gate reported remote migration versions `20260717003854` and `20260717004057` missing from the clean `origin/main` release base.
- These two SQL files were present in the original workspace and are already represented in staging history.
- Added the two migration files unchanged to the release branch; no student-card or active-user-RPC runtime code was added.
- The message migration remains `20260717100000_chat_message_summary.sql`.
- Re-run Staging Migration for the exact release SHA before any production migration or merge.
