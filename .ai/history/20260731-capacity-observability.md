# Capacity observability and frontend performance

- Base: `e977986fd262349fde4a6e666a45d99f65f8244f`
- Branch: `codex/capacity-observability-release`
- Scope: lazy-load infrequent marketplace panels, parallelize chat workspace
  reads, and document p95/p99, slow SQL/RPC, and connection evidence.
- The PostgreSQL/RLS baseline is already on `origin/main`; no migration is
  included in this release.
- Validation: capacity optimization structure check passed 12/12.
- Capacity testing remains staging-only and must report the merged SHA.
