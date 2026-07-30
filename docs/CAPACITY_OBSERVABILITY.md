# Capacity observability contract

Capacity results must be reproducible without exposing query parameters, user
data, access tokens, or service-role credentials.

## Application evidence

For each staging load stage, retain a structured report with target hostname,
VU count, endpoint p50/p95/p99, error classes, Auth 429 boundary, Realtime
results, and operations that exceed the configured SLO.

Use the conservative defaults unless a run explicitly records different
thresholds:

- reads: p95 at or below 750 ms;
- writes: p95 at or below 1,500 ms;
- unexpected HTTP/RPC errors: below 1%; and
- Realtime subscription errors: below 1%.

Application latency alone does not establish PostgreSQL execution time or
connection-pool saturation.

## Database and connection evidence

For the same staging project and time window, capture a timestamped Supabase
Database dashboard snapshot:

1. Query Performance / `pg_stat_statements`: query ID, calls, mean and maximum
   execution time, total execution time, and normalized statement category.
2. Metrics / Supavisor: peak database and pool connection utilization and the
   applicable plan connection limit.
3. Logs: statement-timeout, lock-wait, connection-limit, and Realtime-limit
   events, separately from application HTTP errors.

Enable and verify `pg_stat_statements` in staging before collecting these
snapshots. Do not expose `pg_stat_activity`, `pg_stat_statements`, or a
`SECURITY DEFINER` diagnostics RPC to `anon` or `authenticated` users merely
to automate the report.

## Capacity decision

Stop a stage when application error rate reaches 1%, two consecutive intervals
miss the latency SLO, or connection utilization remains at or above 80%. The
maximum stable capacity is only the highest stage that also completes its soak
with both application and database evidence available.
