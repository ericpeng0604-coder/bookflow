-- BookFlow migration-history baseline.
--
-- Existing staging and production databases must be verified against the
-- legacy SQL files before marking this version as applied:
--
--   supabase migration repair --status applied 20260614000000
--
-- This migration is intentionally a no-op. All new database changes must be
-- added as timestamped, forward-compatible files in this directory.
select 1;
