# AI Handoff Archive

- Task: show messages as a header icon
- Branch: `codex/message-header-icon-deploy`
- Base commit: `cee412fe01a58e15415d047f4df38e6def8b4e7d`
- Completed commit: `451767fddaa9494c82b2de2e3359a7abd90382e9`
- Status: handoff to release validation

## Scope

- Header-only MessageCircle icon before the notification bell.
- Existing conversations state and fetchConversations unread summary.
- Existing chats route and trade_message navigation preserved.
- Visible dashboard chats tab removed; mobile menu unchanged.
- Handoff contract section titles normalized to remove the pre-existing mojibake validation conflict.

## Evidence

- TypeScript, ESLint, project checks, focused chat checks, and production build passed.
- Browser checks passed at 1280, 320, 375, and 390px.
- Legacy chats URL loaded without a framework error overlay.
