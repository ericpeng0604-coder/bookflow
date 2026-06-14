# Versioned migrations

All new database changes belong in this directory and use a UTC timestamp:

`YYYYMMDDHHMMSS_short_description.sql`

Rules:

1. Prefer additive, backward-compatible expand/contract migrations.
2. Apply and verify migrations in the `staging` GitHub Environment first.
3. Test RPC availability and both allowed and denied RLS paths.
4. Apply production migrations only with the `Production Migration` workflow
   and approval from the `production-database` GitHub Environment.
5. Application rollback never reverses database migrations automatically.

The first file is a no-op baseline for databases that were originally built
from the legacy SQL files in `supabase/`. Verify the legacy schema, then mark
the baseline as applied with:

```text
supabase migration repair --status applied 20260614000000
```
