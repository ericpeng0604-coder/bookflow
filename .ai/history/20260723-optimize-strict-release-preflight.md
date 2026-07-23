# AI Handoff Archive

- Task: Optimize strict release preflight
- Actor: codex
- Status: in_progress
- Base commit: 0a65850fb04cb9afae751e8e6f8a616096eb3e6f
- Archived at: 2026-07-23T19:20:00.000Z

---

This follow-up makes release-preflight stop on tracked or untracked worktree changes by default. The --allow-dirty option remains diagnostic-only. The purpose is to prevent dirty diffs from being mistaken for release source.
