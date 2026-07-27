# BookFlow AI Handoff

## Task title

Establish first-phase Copilot collaboration protection.

## Release context

- Task ID: `20260727-copilot-protection`.
- Task: `establish first-phase Copilot collaboration protection`.
- Branch: `codex/copilot-protection-20260727`.
- Base commit: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`.
- Base ref: `origin/main`.
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
- Production behavior, GitHub PR Draft state, push, merge, and deployment:
  NOT VERIFIED.

## Risks and blockers

- This is a repository workflow protection phase; it does not enforce main
  ruleset settings or automatically block overlap across pull requests.
- Copilot write mode remains prohibited for purchase, Supabase, and
  notification scope.

## AI follow-up

1. Keep Copilot in review mode unless a user explicitly authorizes write mode.
2. Keep agent PRs Draft and use `codex/*` or `copilot/*` branches.
3. Keep test results and the exact `NOT VERIFIED` label in every agent PR.
4. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching history entry in
   sync.

## Commit

- Base commit: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`.
- Current implementation commit: pending.
