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
