# Purchase CTA 8-second timeout release

- Task ID: `20260723-purchase-cta-timeout-8s`.
- Base: `1f1542e22932659341389b5e534fcbf286a6911f` (`origin/main`).
- Scope: AbortController timeout for active purchase-request lookup and explicit idle/loading CTA disablement.
- Database migrations: NOT APPLICABLE; this release changes no SQL.
- Clean source branch: `agent/fix-purchase-cta-timeout-8s-20260723`.
- Focused evidence: `node scripts/check-chat-listing-order-ux.mjs` passed 29/29 before commit.
- Pending: typecheck, lint, project checks, build, PR checks, staging/deployment evidence, exact merged SHA, production health, smoke, and browser CTA verification.
- Original dirty checkout remains untouched.
- PR #105 is not this release; its 10-second implementation is not used.
- No protected recovery file is changed.
- Release rule: never claim production completion without matching full SHA across source, merge, health, and smoke.
- Unavailable evidence must be reported as `NOT VERIFIED`.
- Commit and PR identifiers will be recorded after publication.
