# AI Handoff Archive

- Task: add non-blocking CodeQL security scan
- Actor: codex
- Status: handoff
- Base commit: `3e2dd548a8e6e5802aa0398e09e5d86a867b7694`
- Archived at: 2026-07-16T00:13:29+08:00

---

## Scope

Added `.github/workflows/codeql-nonblocking.yml` to scan JavaScript and
TypeScript with CodeQL without adding a deployment dependency. The workflow
scans PRs, the `main` branch, weekly, or manually.

## Evidence

- Local YAML parse passed.
- `node scripts/check-workflows.mjs` passed.
- GitHub workflow syntax check passed.
- CodeQL run for PR #95 passed.
- GitHub Code Scanning reported zero open alerts for the scanned change.
- The workflow uses CodeQL Action v4 and checkout v5 to avoid the observed
  Node 20 and CodeQL v3 deprecation warnings.

## Release boundary

No production deployment, database migration, application runtime change, or
protected recovery workflow change is included in this task.
