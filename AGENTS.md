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

Before starting work, search `AI_WORK_MANUAL.md` by task-relevant keywords and
read only the matching sections needed for the task. Apply those recorded
lessons, quality gates, and incident-prevention rules. Prefer a focused read
of roughly 1,000-3,000 tokens over loading the entire manual; expand the scope
only when the focused search finds a concrete reason.

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
