# AI Handoff Archive

- Task: establish first-phase Copilot collaboration protection
- Actor: codex
- Mode: write
- Status: local verification passed; release actions not requested
- Base commit: `1bb3673d52222c9bc96afb6d8ed33b1a49c6905a`
- Updated at: 2026-07-27

This change adds the first local collaboration guard for Copilot: explicit
review/write modes, safe defaults, agent branch conventions, Draft PR and
verification guidance, and a temporary write prohibition for purchase,
Supabase, and notification scope. It does not change product behavior,
migrations, RLS, main rulesets, or existing branches/worktrees.

## Verification status

- Focused collaboration checks, lint, typecheck, tests, and diff check: passed.
- Production, GitHub PR state, push, merge, auto-merge, and deployment: NOT
  VERIFIED.
