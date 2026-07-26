# Enable scheduled Dependabot checks

- Task ID: `20260726-enable-dependabot`.
- Base commit: `34d359b59729cbbecf737c5c73b072b727a65733`.
- Configuration commit: `f3223c855389e915e011ccc61e928b22d0601aa8`.
- Branch: `chore/enable-dependabot-20260726`.

## Scope

- Added weekly npm dependency checks.
- Added weekly GitHub Actions dependency checks.
- Limited each ecosystem to three open PRs.
- Ignored automatic major-version updates.

## Verification

- Reviewed the one-file configuration diff.
- Vercel preview, staging migration, quality/build, and CodeQL checks passed.
- Workflow syntax was not verified because the actionlint Docker image pull timed out.
- No production deployment or database migration is required.

## Handoff

- Preserve the configuration-only scope.
- Keep `AI_HANDOFF.md`, `.ai/state.json`, and this append-only history entry synchronized.
