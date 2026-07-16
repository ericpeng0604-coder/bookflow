# 2026-07-16 — Release flow hardening

## Summary

Hardened deployment provenance and verification for BookFlow without changing
application behavior or protected recovery infrastructure.

## Evidence target

- Staging RPC probes must assert status and response shape.
- Production migration must use an immutable commit SHA and matching successful
  Staging Migration run.
- Scheduled production smoke must compare the live commit with `main`.
- The npm lockfile, CI install command, and Windows Node wrapper must agree.

## Scope

- Workflow checks, release helper scripts, documentation, and handoff metadata.
- No production migration or application deployment was performed from this
  isolated worktree before PR validation.
