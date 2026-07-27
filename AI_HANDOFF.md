# BookFlow AI Handoff

## Task title

Establish first-phase Copilot collaboration protection.

## Release context

- Task ID: `20260727-copilot-protection`.
- Task: `establish first-phase Copilot collaboration protection`.
- Branch: `codex/copilot-protection-20260727`.
- Base commit: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`.
- Base ref: `origin/main`.
- PR: `#157` (open, Draft; first-phase protection only).
- History: `.ai/history/20260727-copilot-protection.md`.
- Agent: `codex`.
- Mode: `write`.
- No product behavior, Supabase migration/RLS, main ruleset, or protected
  recovery file is changed.

## Completed work

- Added `copilot` as a supported collaboration agent.
- Added `review` and `write` modes with Copilot defaulting to `review`.
- Blocked Copilot write mode for purchase, Supabase, and notification scope.
- Added agent branch-prefix, Draft PR, test-result, and `NOT VERIFIED` guidance.
- Added the Copilot instructions and pull request template.

## Next steps

1. Run the focused collaboration checks, lint, typecheck, tests, and diff check.
2. Review the final diff for scope and encoding safety.
3. Stop before push, merge, auto-merge, main-ruleset changes, or cleanup.

## Changed files

- `scripts/ai-collaboration.mjs`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/pull_request_template.md`
- `AI_HANDOFF.md`
- `.ai/state.json`
- `.ai/history/20260727-copilot-protection.md`

## Verification

- `node scripts/ai-collaboration.mjs check`: passed.
- `node scripts/check-memory.mjs`: passed.
- Copilot default review smoke and restricted Supabase write rejection: passed.
- `pnpm run lint`: passed.
- `pnpm run typecheck`: passed.
- `pnpm test`: passed, 22 tests.
- `pnpm run check:project`: passed, 38/38 checks.
- `node scripts/check-release-scope.mjs`: passed.
- `git diff --check`: passed.
- Second-phase update checks: `node scripts/check-memory.mjs`,
  `node scripts/ai-collaboration.mjs check`, `node scripts/ai-collaboration.mjs
  check-ci origin/main HEAD`, `node scripts/check-workflows.mjs`,
  `node scripts/check-release-scope.mjs`, and `git diff --check`: passed.
- Main ruleset enforcement: VERIFIED — the main ruleset is active with
  `strict=true`, and requires `Release Readiness`, `Staging Migration`, and
  `Vercel`.
- PR #158 negative test: VERIFIED — `Release Readiness`, `AI handoff`, and
  `AI 交接完整性` failed with the blocking message `Substantive changes must
  update AI_HANDOFF.md and .ai/state.json.` PR #158 was closed, not merged,
  and has no auto-merge.
- Cross-PR overlap blocking: VERIFIED: NOT IMPLEMENTED — PR #157 and PR #158
  both changed `.github/copilot-instructions.md`, but no overlap check,
  warning, or required context was produced.
- Branch and worktree cleanup: VERIFIED — the PR #158 remote/local branch and
  worktree were cleaned up.
- Production behavior/deployment: NOT VERIFIED — out of scope, no merge or
  deployment performed.

## Risks and blockers

- PR #157 only commits the first-phase repository collaboration protection. It
  does not promise or implement cross-PR overlap blocking; the second-phase
  measurement above records that capability as `VERIFIED: NOT IMPLEMENTED`.
- Copilot write mode remains prohibited for purchase, Supabase, and
  notification scope.

## AI follow-up

1. Keep Copilot in review mode unless a user explicitly authorizes write mode.
2. Keep agent PRs Draft and use `codex/*` or `copilot/*` branches.
3. Keep test results and the exact `NOT VERIFIED` label for genuinely
   unverified items in every agent PR; do not use it for measured absence of a
   capability.
4. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in
   sync.

## Commit

- Base commit: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`.
- Current implementation commit: `00420d8` (initial PR #157 implementation).
