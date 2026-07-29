# BookFlow Differential Security Review — 2026-07-28

## Executive Summary

| Severity | Count |
|---|---:|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 1 |
| LOW | 0 |

**Overall Risk:** HIGH

**Recommendation:** REJECT until the external hook registration is removed, replaced with an audited data-minimizing implementation, or explicitly approved with a documented threat model.

**Remediation status (2026-07-29):** The external AgentCraft registrations were removed from `.codex/hooks.json`, and `scripts/check-hooks.mjs` was added to prevent unreviewed project-shared hooks from returning. A live staging transaction-level suspended-user RLS test has now passed; a full HTTP Auth-token session test remains outside this run.

The website-facing RLS and atomic reservation changes did not show an authorization relaxation in this review. The blocking issue is local developer-tool configuration: the new hooks execute code outside the repository on broad lifecycle events and forward prompts and shell commands to a configurable AgentCraft server.

**Key Metrics:**

- 26 changed paths reviewed: 9 tracked modifications and 17 untracked additions.
- 4 new external hook trigger groups reviewed.
- 2 high-risk website surfaces reviewed: Books RLS/reservation RPCs and trade-chat session/auth-adjacent code.
- 12/12 trade-chat contract checks passed.
- Security hardening, AI OCR, and site hardening checks passed.
- Live transaction-level suspended-user RLS verification passed; a full HTTP Auth-token session test remains NOT VERIFIED.

## What Changed

**Review target:** `HEAD 953bb72` versus the current working tree, including untracked files. The untracked security-hardening migration family corresponds historically to commit `c0c4ebb` (`fix: harden Books RLS and atomic bundle reservations (#154)`).

| Area | Risk | Review result |
|---|---|---|
| `.codex/hooks.json` | HIGH | External hooks added to SessionStart, Stop, UserPromptSubmit, and every Bash PreToolUse event. |
| Books RLS and reservation migration | HIGH | Ownership, active-user, status, ordered row locks, and function grants are present; no direct privilege-relaxation finding. |
| Trade-chat session refactor | HIGH | Authorization remains delegated to existing Supabase RPC/storage helpers; contract checks pass. |
| Security/concurrency scripts | MEDIUM | Explicit staging guard and cleanup are present; they require staging credentials and confirmation. |
| Handoff/state/history/package metadata | LOW | No direct website security behavior; reviewed for scope and provenance. |

## HIGH Finding

### HIGH: External hooks expose prompts and shell commands to an unpinned local service

**Files:** `.codex/hooks.json:17-22`, `.codex/hooks.json:38-42`, `.codex/hooks.json:46-52`, `.codex/hooks.json:56-63`

**Blast Radius:** 4 lifecycle trigger groups; the PreToolUse hook applies to every Bash command in any session using this repository configuration.

**Test Coverage:** NO repository security test verifies hook provenance, destination allowlisting, payload redaction, or log retention.

**Evidence:**

- The repository config executes four absolute-path JavaScript files from `C:\Users\ericp\AppData\Local\AgentCraft\...`.
- The installed hook utility derives its destination from `AGENTCRAFT_SERVER_URL`, defaulting to `http://localhost:2468`; the environment variable can redirect traffic elsewhere.
- `agentcraft-hero-active.js` reads the submitted prompt, posts `mission_start` data including the prompt, and writes a prompt preview to a local debug log.
- `agentcraft-bash-command.js` reads the Bash tool input and posts the command, working directory, session, and agent metadata.
- The hook files are not versioned in this repository, so their behavior and integrity cannot be reviewed or pinned by the project diff.

**Attack Scenario:**

1. A developer opens or resumes a Codex session in this repository.
2. `SessionStart` and `UserPromptSubmit` execute the external AgentCraft hook automatically.
3. A prompt containing a private incident detail, token-like value, or source-path context is read by the hook and sent to the configured AgentCraft server; a Bash command is similarly sent on `PreToolUse[Bash]`.
4. If `AGENTCRAFT_SERVER_URL` is changed by the environment or the local service is compromised, the data leaves the host without a repository-level approval step.

**Impact:** Local prompts, commands, paths, and potentially secret-bearing command arguments can be disclosed outside the repository. The hook also gives an unreviewed external package code execution on the developer account at multiple lifecycle points.

**Recommendation:**

- Remove these four external registrations from the committed `.codex/hooks.json` unless the integration is explicitly approved.
- If the integration is required, vendor or pin the exact source, restrict the destination to a verified local endpoint, redact prompts/commands and environment-derived secrets, disable raw prompt logging, add timeouts, and add a repository check that rejects unapproved hook paths or remote destinations.
- Keep machine-specific integration in a user-local configuration rather than project-shared configuration.

## MEDIUM Finding / Verification Gap

### MEDIUM: Suspended-user RLS behavior is asserted but not live-tested

**File:** `supabase/migrations/20260727060919_secure_book_rls_and_atomic_reservations.sql:33-64`

The migration adds `public.is_active_user()` to insert, update, and delete policies, and the handoff states that production probes passed. However, the handoff also records that no suspended-user fixture was available, so the exact deny path for a suspended authenticated session remains NOT VERIFIED.

**Recommendation:** Add a staging regression that uses a real suspended profile/session and verifies that listing insert, update, and delete are denied while moderator behavior remains intentional. Do not treat the migration contract alone as proof of live policy behavior.

**Live verification update (2026-07-29):** On staging project `yffcyktpwmeslydlbctb`, an isolated transaction temporarily suspended an existing non-moderator profile and simulated the `authenticated` role/JWT claims. `public.is_active_user()` returned false, and Books INSERT, UPDATE, and DELETE were all denied. The fixture transaction rolled back; a follow-up query found zero fixture rows and zero suspended profiles. This verifies the database RLS deny path, but not the separate HTTP Auth token issuance/session path.

## Website Security Changes Reviewed With No Finding

### Books RLS and reservation RPCs

The new migration:

- Drops historical permissive Books policies before recreating the active-listing policy.
- Requires seller ownership and active-user status for normal writes.
- Keeps moderation/lifecycle fields outside the authenticated seller update allowlist.
- Uses `security definer` with `set search_path = public`.
- Checks `auth.uid()` ownership inside the single-item and bundle RPCs.
- Locks request/book rows and selected bundle books before state changes.
- Uses deterministic book ordering and row-count assertions.
- Revokes public/anonymous execute access and grants the RPCs to `authenticated`.

These controls address the reviewed access-control and race-condition paths. The existing `check:security-hardening` contract passed, and the staging concurrency harness is guarded by explicit staging project and confirmation checks.

### Trade-chat session refactor

`lib/marketplace/trade-chat-session.ts` centralizes existing message, image, read-state, and recall helpers. The diff does not remove the existing RPC/storage authorization boundary. Uploaded images are rolled back after send failure, stale conversation generations are ignored, and `check:trade-chat` passed 12/12.

## Test Coverage Analysis

Passed checks:

- `pnpm run check:security-hardening`
- `pnpm run check:book-ocr-ai`
- `pnpm run check:site-hardening`
- `pnpm run check:trade-chat`
- `git diff --check`

The checks are primarily structural contracts. They do not prove the external hook's data handling, nor do they provide a live suspended-user RLS session test.

## Historical Context

- `c0c4ebb` added the Books RLS and atomic bundle reservation work and recorded staging concurrency evidence.
- Git history shows the trade-chat extraction was previously introduced as a dedicated session workflow seam; the current change continues that direction rather than reintroducing the old direct path.
- The external AgentCraft hook paths have no matching repository history, so provenance is unavailable from this worktree.

## Recommendations

### Immediate (Blocking)

- [ ] Remove or explicitly approve the AgentCraft hooks after source, endpoint, payload, and log handling review.
- [ ] Prevent `AGENTCRAFT_SERVER_URL` from redirecting project hook payloads to an unapproved remote destination.
- [ ] Add a regression check for project-shared hook configuration.

### Before Production

- [x] Run an isolated staging transaction-level suspended-user RLS test for Books insert/update/delete; full HTTP Auth-session coverage remains follow-up work.
- [ ] Keep the verified migration SHA and staging evidence tied to the exact release source.

### Technical Debt

- [ ] Move developer-only hooks to user-local configuration and keep repository configuration limited to reviewed, portable commands.
- [ ] Add security tests for prompt/command redaction and hook destination policy if the integration remains.

## Analysis Methodology

**Strategy:** FOCUSED, with adversarial analysis for HIGH-risk auth, database, external-call, and tool-hook changes.

**Techniques:**

- Working-tree diff and untracked-file inventory.
- Git history and commit-context lookup.
- Review of changed code and one-hop security dependencies.
- Search for removed auth/permission checks and new external calls.
- Blast-radius assessment by trigger and API surface.
- Concrete attacker scenarios for the external hook path.
- Existing structural and concurrency checks.

**Limitations:**

- The external AgentCraft package was inspected for hook input/destination behavior but not independently source-audited or verified against a signed release.
- No live production or staging database command was executed during the original review; a subsequent isolated staging RLS verification is recorded above.
- The current working tree contains unrelated/mixed edits; this report reviews them as present and does not claim that all belong to one intended release.

**Confidence:** HIGH for the committed hook behavior and reviewed SQL/code paths; HIGH for the live database RLS deny path; MEDIUM for the separate HTTP Auth-session path, which was not exercised.
