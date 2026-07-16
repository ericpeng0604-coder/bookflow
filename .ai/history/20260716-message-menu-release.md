# 2026-07-16 — Messages in mobile navigation

## Summary

Added a visible `訊息` item to the mobile hamburger menu while preserving the
existing Header message icon and chat navigation.

## Scope

- Reused `openMessages()` and `unreadMessages` from the existing Header flow.
- Added a compact unread badge style for the mobile menu item.
- No database, RPC, route, or chat-system changes.

## Evidence target

- The menu item is visible at 320px, 375px, and 390px widths without horizontal overflow.
- Typecheck, lint, project checks, build, and release checks pass before merge.
