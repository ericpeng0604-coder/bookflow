# BookFlow cumulative marketplace cart and multi-item order release

- Base: `cb56051ddf3a64bd4c92683485258f570919f111`
- Branch: `codex/marketplace-complete-20260723`
- Scope: complete marketplace cart, cache, market-switch, multi-item order, regression checks, and `20260723120000_multi_item_orders.sql` migration.
- Protected recovery files remain unchanged.
- Local evidence: typecheck, lint, full tests (22), project checks (34/34), and production build passed.
- Pending evidence: staging migration parity, RLS and RPC probes, PR CI, merged SHA, production migration approval, deployment, health, and smoke.
- Environment note: `npm` is unavailable on PATH and `node_modules` is a junction to an existing trusted dependency tree; no package manager was run and CI remains required for independent dependency proof.
- Safety decisions: only explicitly requested files plus required handoff/state/history metadata are in scope; no `git add -A`, no protected recovery changes, and no production migration before staging evidence.
