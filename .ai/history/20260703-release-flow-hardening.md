# 2026-07-03 Release Flow Hardening

## Scope

- Harden BookFlow release tooling and documentation.
- Keep the change release-process only: no product runtime behavior, database migration, GitHub workflow edit, or protected recovery-file change.
- Preserve the npm/package-lock workflow.

## Implementation

- Centralized required handoff sections in `scripts/lib/handoff-contract.mjs`.
- Rebuilt `scripts/ai-collaboration.mjs` with readable validation messages and a `draft` command.
- Added `release:doctor` environment diagnostics.
- Expanded `release:plan` and `release:preflight` to guide low-token release proof, stale-branch recovery, handoff repair, and npm-lock safeguards.
- Updated release documentation and project checks.

## Evidence

- Syntax checks passed for changed release scripts.
- `node scripts/check-release-flow.mjs`: passed.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/release-doctor.mjs`: passed.
- `node scripts/release-plan.mjs`: passed.
- `git diff --check`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/release-preflight.mjs`: passed after commit.
- `tsc --noEmit`: passed using a temporary `node_modules` junction to the main checkout's npm-created dependency tree.
- `eslint .`: passed using the same temporary dependency junction.
- `next build`: passed using the same temporary dependency junction.
