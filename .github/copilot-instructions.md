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

## Collaboration mode and scope

- Copilot starts in `mode: review`. Review means inspect, explain, and suggest;
  do not edit files unless the user explicitly opts into `mode: write`.
- Copilot write mode is temporarily disabled for paths or tasks involving
  `purchase`, `supabase`, or `notification`.
- Use a `copilot/*` branch for Copilot work. Keep agent pull requests Draft by
  default until a human explicitly approves review.
- Every agent PR must describe the checks that ran and list every unverified
  item with the exact label `NOT VERIFIED`.
- This phase does not change product behavior, migrations, RLS, main rulesets,
  existing branches/worktrees, or cross-PR overlap blocking.
