# 2026-07-26 - Conversation navigation and TradeChat session extraction

- Rebuilt from `origin/main` at `05b4beb9915f21be770bd1dbe5adb20133ccd219`.
- Moved conversation ownership and recovery seams into `useConversationNavigation`.
- Moved TradeChat message loading, pagination, realtime guards, dedupe, and recall into `useTradeChatSession`.
- Added focused checks for navigation recovery and chat session behavior.
- No database migration, workflow, or protected recovery file changed.
- Production remains unverified until the PR is merged and the exact merged SHA passes the protected release workflow and smoke check.
