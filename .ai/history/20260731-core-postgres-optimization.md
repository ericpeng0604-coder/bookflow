# Core PostgreSQL performance and RLS optimization

- Branch: `codex/core-postgres-optimization-release`.
- Base commit: `f43d499efdf54a5f1b9d54d47254b67dd7e0d272`.
- Scope: seller verification projection and public catalog indexes, RLS scalar subqueries, core transaction indexes, and keyset-paginated risk moderation.
- The migration is versioned as `20260731090000_core_postgres_optimization.sql` and has not yet been applied remotely.
- Protected recovery files and workflows were not changed.

## Verification

- TypeScript check passed.
- ESLint passed for all changed TypeScript files.
- Production build passed.
- Staging migration and role/RPC/EXPLAIN verification remain required before production.

## Release risks

- Do not claim online implementation until the Staging Migration workflow succeeds for the exact commit SHA and production migration is separately approved and verified.
- The migration must be applied through the repository workflow, not by treating the SQL file as remote state.
