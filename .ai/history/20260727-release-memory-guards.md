# Release metadata and propagation guard hardening

- Added an early `release-preflight` check for handoff branch metadata drift.
- Added a static release-flow regression assertion for the guard.
- Added LESSON-076 for exact merged-SHA verification after deployment propagation.
- No runtime application behavior, database migration, or protected recovery file changed.
- Verification: pending.
