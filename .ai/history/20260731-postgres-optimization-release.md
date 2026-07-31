# Core PostgreSQL optimization release

- Base: `1f8ee884b695c5a642dafc7cb26e760382343165`
- Branch: `codex/postgres-optimization-release-20260731`
- Scope: guarded seller-verification backfill, seller/RLS/order indexes,
  catalog substring-search index alignment, and risk moderation ordering indexes.
- Migration: `supabase/migrations/20260731090000_core_postgres_optimization.sql`
- Staging migration, RPC/RLS probes, and EXPLAIN verification are required
  before production.

## Release evidence

- The source is isolated from the original dirty checkout in a clean worktree.
- The migration diff is limited to the database optimization file.
- Production migration and deployment require the exact merged SHA and separate
  approval.
