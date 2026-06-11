# BookFlow AI Instructions

Do not modify, delete, rename, format, or regenerate the production recovery
files during ordinary feature, bug-fix, refactoring, or documentation work:

- `.github/workflows/rollback-production.yml`
- `.github/workflows/protect-rollback-workflow.yml`
- `.github/CODEOWNERS`
- `AGENTS.md`

These files may only be changed when the user explicitly requests a rollback or
recovery-system change. Authorized commits must include the exact trailer
`Rollback-Workflow-Approved: true`. Never use that trailer for unrelated work.
