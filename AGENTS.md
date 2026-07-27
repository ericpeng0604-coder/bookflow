# Repository Safety Rules

## Protected Recovery Files

The following files are production recovery infrastructure and must not be
changed, deleted, renamed, formatted, or regenerated during ordinary work:

- `.github/workflows/rollback-production.yml`
- `.github/workflows/protect-rollback-workflow.yml`
- `.github/CODEOWNERS`

Only modify these files when the user explicitly asks to change the rollback or
recovery system. Before committing an authorized change, run the workflow
structure checks and add this exact commit-message trailer:

`Rollback-Workflow-Approved: true`

Never add that trailer to an unrelated commit.

## Project Lessons

Before starting work, read `AI_WORK_MANUAL.md` and apply its recorded lessons,
quality gates, and incident-prevention rules.

Before trusting handoff or history state, run `node scripts/check-memory.mjs`.
Then use `node scripts/ai-lookup.mjs <task keywords>` to open only the relevant
lesson windows. Use `--deep` only when the first pass identifies a concrete
reason to inspect `.ai/history` or global rollout summaries.

## Deploy And Environment Guardrails

When the user asks for deploy, merge, production confirmation, or other
release-complete work:

1. Check `git status --short` first.
2. If the active checkout is dirty with unrelated edits, stop release work in
   that checkout and move to a clean worktree from latest `origin/main`.
3. Before substantial implementation, confirm the local runtime path for the
   required verification commands. If `node`, `npm`, `lint`, `typecheck`, or
   `build` cannot run because of environment setup, fix that first or record
   the exact blocker before expanding the code change.
4. Use the repo's low-output helpers such as `npm run ai:budget`,
   `npm run release:plan`, and `npm run release:doctor` to narrow the next
   proof point before opening large logs or dashboards.

When a mistake, failed assumption, escaped defect, unsafe action, or recurring
workflow problem is discovered:

1. Fix the immediate issue.
2. Add a concise entry to `AI_WORK_MANUAL.md` describing:
   - what went wrong;
   - why it happened;
   - how to detect it;
   - the rule that prevents recurrence.
3. Do not record secrets, credentials, personal data, or unsupported blame.
4. Keep entries general enough to help future work, and update an existing
   lesson instead of adding duplicates.

## AI collaboration protection

- Supported collaboration agents are `codex`, `cursor`, and `copilot`.
- Collaboration state includes `mode: review` or `mode: write`; the default
  mode is `review`.
- Copilot must remain in `review` mode unless a task explicitly opts into
  `write` mode. Copilot write mode is temporarily prohibited for any
  `purchase`, `supabase`, or `notification` scope.
- Agent PR branches must use `codex/*` for Codex and `copilot/*` for Copilot.
  Agent PRs start as Draft and must include test results plus a `NOT VERIFIED`
  section for anything not proven.
- Do not use this phase to change product behavior, Supabase migrations/RLS,
  main rulesets, existing branches/worktrees, or cross-PR overlap automation.
