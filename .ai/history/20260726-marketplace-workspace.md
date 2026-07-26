# Marketplace workspace module

- Base: `a152f7a4734e1d2686fa607e4c07e6b593f2fedc`
- Branch: `agent/marketplace-workspace-20260726`
- Scope: extract workspace tab and moderation orchestration from
  `MarketplaceApp` into `useMarketplaceWorkspace`.
- Preserved requests/orders, student verification, conversation page cursor,
  favorites, trust badges, admin recovery, and logout reset behavior.
- Verification: focused module check, notification feed check, conversation
  navigation check, memory contract, typecheck, lint, build, and release
  preflight remain required before publication.
