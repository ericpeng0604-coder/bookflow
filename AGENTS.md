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
