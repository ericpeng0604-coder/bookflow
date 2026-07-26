# Conversation navigation recovery architecture release

- Base: `0a65850fb04cb9afae751e8e6f8a616096eb3e6f`.
- Branch: `agent/marketplace-architecture-20260726`.
- Scope: centralize conversation read recovery and remove the TradeChatPanel
  data-layer seam leak.
- Commits: `e6d1e734ed58651e1c34523e42454355e1892ba1`, `a63a612`.
- No database migration is included; staging migration is NOT APPLICABLE.
- Local evidence: focused behavior 4/4, trade chat 9/9, chat switching 5/5,
  changed-file ESLint, TypeScript, and production build passed; full
  `release:local` passed with 35/35 project checks.
- Pending evidence: PR #140 checks/review, merge SHA, production deployment,
  release health, and production smoke.
- Safety decisions: clean worktree from `origin/main`, explicit file staging,
  unrelated dirty-checkout edits excluded, and protected recovery files remain
  unchanged.
