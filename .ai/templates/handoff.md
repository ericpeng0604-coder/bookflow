# BookFlow AI Handoff

## Task title

<task title>

## Release context

- Task ID: `<task-id>`.
- Task: `<task-title>`.
- Branch: `<branch>`.
- Base commit: `<base-commit>`.
- History: `.ai/history/<date-task>.md` or `pending`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add `Rollback-Workflow-Approved: true` unless this is an authorized rollback/recovery change.

## Completed work

- <completed work>

## Next steps

1. <next step>
2. <next step>

## Changed files

- `path/to/file`

## Verification

- `<command>`: passed / failed / NOT VERIFIED

## Risks and blockers

- <known risk or blocker, or None>

## AI follow-up

1. <follow-up action>
2. Keep `AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/*.md` in sync.

## Commit

- Base commit: `<base-commit>`.
- Current implementation commit before final commit: `<sha-or-not-committed-yet>`.
