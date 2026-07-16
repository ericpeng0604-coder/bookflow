# 2026-07-16 IG-style chat layout release

## Summary

Implemented the scoped BookFlow chat UI release from a clean `origin/main`
worktree. Desktop keeps the conversation list visible beside the selected chat;
mobile switches between the list and a full-screen chat with an explicit back
control.

## Scope

- Responsive chat layout and selection behavior only.
- Existing `TradeChatPanel` behavior remains isolated and reusable.
- No database migration, workflow, rollback, recovery, or CODEOWNERS change.
- Student verification, OCR, and other dirty-worktree changes are excluded.

## Evidence

- Typecheck, lint, chat-state, trade-chat, chat listing/order UX, chat
  visibility/feedback, project checks, and production build completed locally.
- Replacement-character scan of the implementation files found no `U+FFFD` or
  private-use characters.
- Production deployment and authenticated chat flow remain pending PR merge and
  post-deploy smoke verification.

## Prevention rule

Keep the responsive list/panel state explicit: desktop renders both columns;
mobile derives the visible screen from the selected conversation and always
provides a return action. Never use a collapse state that hides the only way to
select another conversation.
