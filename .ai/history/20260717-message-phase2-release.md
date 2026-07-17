## 2026-07-17 — second-phase professional messages

- Release branch: `codex/message-phase2-production-clean`
- Base: `origin/main` at `b7441fb87b63c5a57c719ae41bfc9349cf846841`
- Scope: standalone message route, inbox summaries/pagination, realtime sorting and unread updates, grouped/date message presentation, hidden actions, retry/upload states, mobile viewport and focus behavior, and message summary RPC migration.
- Verification: TypeScript passed; targeted ESLint passed; message UX checks passed 13/13; production build passed; diff check passed.
- Full project checks hit a pre-existing `check-listing-navigation-ui` NativeDialog assertion in the production base. No unrelated listing/modal changes were included.
- Original dirty checkout remains untouched for release.
