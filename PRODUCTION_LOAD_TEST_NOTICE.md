# Production read load test notice

This temporary branch contains a bounded, read-only load test for the not-yet-public production environment.

- No authentication, purchase, listing, chat, notification, upload, migration, RLS, or schema writes.
- Stages: 10, 25, 50, 100, 200 virtual workers.
- Stop threshold: error rate >= 1% or p95 latency > 1500 ms.
- This branch is not intended to merge.
