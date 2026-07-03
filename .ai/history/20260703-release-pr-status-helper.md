# 2026-07-03 Release PR Status Helper

## Scope

- Reduce release waiting time and token use without reducing verification.
- Keep the change limited to release tooling, handoff readability, workflow status readability, and documentation.
- Do not change product runtime behavior, database migrations, or protected recovery files.

## Implementation

- Added `scripts/release-pr-status.mjs` and `release:pr-status` to poll GitHub required checks plus BookFlow release gates.
- Updated `scripts/release-plan.mjs` and `docs/RELEASE_WORKFLOW.md` to recommend compact required-check polling, remote merge, merged-SHA lookup, production health, and `release-smoke`.
- Rebuilt readable handoff contract/template text so preflight and CI no longer depend on mojibake headings.
- Rebuilt the AI handoff workflow display name as `AI 交接完整性`.
- Added a release lesson that saving tokens means using direct, compact evidence rather than skipping required proof.

## Evidence

- Bundled Node syntax checks for changed release scripts: passed.
- `node scripts/check-release-flow.mjs`: passed.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/release-plan.mjs`: passed.
- `git diff --check`: passed.
- `node scripts/check-workflows.mjs`: passed.
- `node scripts/run-project-checks.mjs`: passed, 26/26.
- `node scripts/release-pr-status.mjs 65`: passed and reported all release gates green.
- `tsc --noEmit`: passed using a temporary `node_modules` junction to the main checkout's npm-created dependency tree.
- `eslint .`: passed using the same temporary dependency junction.
- `next build`: passed using the same temporary dependency junction.
- The temporary `node_modules` junction and `.next` build output were removed after verification.
