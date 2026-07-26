# Notification feed module release

- Base: `1bdf349d1937fdad79340f97bb923fa71e92c30a`.
- Branch: `agent/marketplace-wave1-20260726`.
- Scope: extract notification feed loading, read state, refresh, and reset
  behavior from `MarketplaceApp`.
- No database migration is included; staging migration is NOT APPLICABLE.
- Local evidence before full release: notification module checks passed,
  notification refresh checks 6/6 passed, typecheck and changed-file lint
  passed.
- Pending evidence: full release:local, preflight, PR checks, merged SHA,
  production deployment, release health, and production smoke.
- Workspace, conversation navigation, and trade chat modules are intentionally
  excluded from this wave.
- Safety decisions: clean worktree from origin/main, explicit file staging,
  unrelated dirty-checkout changes excluded, protected recovery files unchanged.
