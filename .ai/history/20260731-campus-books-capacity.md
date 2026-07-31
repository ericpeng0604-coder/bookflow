# 2026-07-31 Campus-books concurrent capacity

## Scope

- Branch: `codex/campus-books-capacity-20260731`.
- Base: `1f8ee884b695c5a642dafc7cb26e760382343165` (`origin/main`).
- Environment scope: local, isolated, or staging only; production load testing and direct production migration are prohibited.

## Baseline status

- Baseline execution: `NOT VERIFIED` at task start.
- Existing capacity/observability files are historical source context, not proof of current staging or production state.
- Required evidence: workload-specific latency/error metrics, Auth/Realtime limits, Supabase slow-query and connection evidence, and exact environment/commit/data-volume metadata.

## Decisions

- Preserve the original dirty checkout and use a clean worktree from `origin/main`.
- Do not retain an optimization without same-condition before/after evidence and required correctness/security checks.

## Verification

- `check-memory` must pass after this handoff synchronization.
- All unavailable external or authenticated evidence remains `NOT VERIFIED`.
