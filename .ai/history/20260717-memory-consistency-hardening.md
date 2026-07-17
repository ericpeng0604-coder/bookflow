# 2026-07-17 — Project memory consistency hardening

## Summary

Restored missing project-memory entrypoints and added an executable contract so
future agents cannot silently trust dangling commands, duplicate lesson IDs, or
handoff metadata that disagrees with structured state.

## Root cause

Memory rules, package commands, prose handoff facts, and `.ai/state.json` were
checked independently. Documentation could therefore outlive its script, and a
structurally complete handoff could still contain conflicting provenance.

## Durable prevention

- `scripts/check-memory.mjs` validates published script targets, unique lesson
  IDs, readable text, Git ancestry, history existence, and handoff/state fields.
- `scripts/ai-collaboration.mjs check` uses the same memory contract.
- `scripts/run-project-checks.mjs` runs the contract and its negative tests in CI.
- Node tests cover valid memory, missing targets, duplicate IDs, unreadable text,
  and stale metadata.

## Evidence

- `node scripts/check-memory.mjs`: passed; 66 unique lessons, 83 script targets,
  and aligned handoff/state metadata.
- `node scripts/ai-collaboration.mjs check`: passed.
- `node --test tests/memory-contract.test.mjs`: passed, 4/4.
- `node scripts/run-project-checks.mjs`: passed, 31/31.
- TypeScript typecheck, ESLint with zero warnings, and Next.js production build passed.
- Windows Codex runtime path and restored helper smoke checks passed.
- Release preflight and the PR-scoped AI handoff CI contract passed from the
  clean release commit.

## Scope

- Clean worktree based on `08b609752e95635d38502b8e778594760e4ee634`.
- No database migration, application runtime change, production action, or
  protected recovery file change.
