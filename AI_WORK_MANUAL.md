# AI Work Manual

This is the shared project memory for Codex, Cursor, and other AI agents.
Read it before making changes. Update it when a verified mistake, failed
assumption, escaped defect, or recurring workflow problem reveals a reusable
lesson.

## How to Use This Manual

1. Read `AGENTS.md`, this manual, and relevant project handoff files first.
2. Apply every active lesson that is relevant to the task.
3. Do not mark work complete until the required evidence exists.
4. When adding a lesson, record facts and prevention steps, not blame.
5. Never include secrets, tokens, credentials, personal data, or production
   connection details.
6. Prefer updating an existing lesson over creating a duplicate.

## Definition of Done

- Review the final diff and preserve unrelated existing work.
- Check modified text and source files for broken encoding or malformed text.
- Run applicable type checks, production builds, linting, tests, and
  project-specific checks.
- Report the command and result. A check that could not run is `NOT VERIFIED`.
- Verify important success, loading, empty, error, retry, and permission paths.
- Database and production-critical changes must pass staging before production.
- A completed checklist, created script, or plausible implementation is not
  evidence that the behavior works.

## Recorded Lessons

### LESSON-001: A completed plan is not verified software

**Observed problem:** An optimization task was reported as complete even though
the local type check and production build had not successfully run.

**Cause:** Plan completion and file creation were treated as proof of working
behavior.

**Detection:** Require actual command results and exit codes. Look for phrases
such as "could not run", missing output, or claims without test evidence.

**Prevention rule:** Never claim a build, feature, migration, or capacity target
passes unless the relevant check ran successfully. Mark blocked checks as
`NOT VERIFIED`.

### LESSON-002: Encoding corruption can create functional defects

**Observed problem:** Newly created TypeScript files contained mojibake in
user-facing messages and filter sentinel values. This could break compilation,
filters, and displayed text.

**Cause:** Text encoding was not inspected after generating or rewriting files.

**Detection:** Review every added or modified text file, search for replacement
characters or suspicious byte-decoding patterns, and run type checks/builds.

**Prevention rule:** Preserve the repository's encoding, use UTF-8 for files
containing Chinese text, inspect rendered strings, and fix all corruption before
reporting completion.

### LESSON-003: A load-test script is not a capacity result

**Observed problem:** Creating a 200-concurrency script could be mistaken for
proof that the application supports 200 simultaneous users.

**Cause:** Test tooling and test evidence were conflated.

**Detection:** Ask for the verified target environment, request count,
concurrency, latency distribution, error rate, and application/database resource
metrics.

**Prevention rule:** Make capacity claims only from recorded staging results.
Increase load gradually and never target production without explicit approval.

### LESSON-004: Database optimization requires plans and permission tests

**Observed problem:** Pagination RPCs and indexes were added without complete
evidence that search indexes, count-query cost, row-level security, and moderator
access behaved correctly.

**Cause:** Query shape and SQL creation were treated as sufficient database
validation.

**Detection:** Use representative data, inspect safe `EXPLAIN` or
`EXPLAIN ANALYZE` output, and test both allowed and denied role scenarios.

**Prevention rule:** Validate correctness, query plans, indexes, locking,
compatibility, migration order, rollback, and authorization in local or staging
before production.

### LESSON-005: Remote and production actions require exact approval

**Observed problem:** Instructions to "finish everything" can be interpreted too
broadly and may lead an agent toward remote migrations, deployment, or load
testing.

**Cause:** General task approval was confused with approval for a specific risky
environment action.

**Detection:** Identify the exact project, environment, URL, command, and likely
effect before execution.

**Prevention rule:** Broad approval never authorizes production. Obtain explicit
approval separately for remote database changes, staging deployment, production
deployment, and production load testing.

### LESSON-006: Outbound links require a trusted application URL

**Observed problem:** A notification email used the request `Origin` header to
build its application link, allowing a caller-controlled destination.

**Cause:** An inbound request header was treated as trusted deployment
configuration.

**Detection:** Review email, webhook, redirect, and notification URLs for values
derived from `Origin`, `Host`, or forwarded-host headers. Before deployment,
open the configured public URL and verify that its visible brand and application
match the intended project.

**Prevention rule:** Build externally delivered application links from a
validated server-side environment variable, never directly from request headers.
Do not infer the canonical domain from a similar project name; verify the domain
against the live application before saving or deploying it.

### LESSON-007: Public email endpoints need abuse controls

**Observed problem:** A signup helper endpoint accepted an arbitrary email
address without authentication and could become an email relay when enabled.

**Cause:** A convenience message was implemented outside the authentication
provider's protected verification flow.

**Detection:** Review every outbound email endpoint for caller-controlled
recipients, authentication, authorization, rate limits, and replay protection.

**Prevention rule:** Prefer authentication-provider templates for verification
messages. Any custom email endpoint must authenticate the caller, restrict the
recipient, rate-limit requests, and prevent replay before it is enabled.

### LESSON-008: Consent-gated contact data must not live in public rows

**Observed problem:** A proposed per-listing LINE ID field was initially placed
on the publicly readable `books` table, so API callers could bypass the UI and
read it before consent.

**Cause:** Display-level hiding was mistaken for data-level access control.

**Detection:** Trace sensitive fields through table grants, RLS policies, RPCs,
and direct REST access instead of checking only whether the UI renders them.

**Prevention rule:** Store consent-gated contact data in a private RLS-protected
table and expose it only through an authorization-aware RPC after consent.

### LESSON-009: Local completion is not online implementation

**Observed problem:** A locally completed UI fix was described as finished while
the production website still served the previous version.

**Cause:** Code completion, repository publication, database migration, and
production deployment were not clearly distinguished.

**Detection:** Before reporting a user-facing feature as implemented, compare
the local commit, remote branch, deployment status, production behavior, and
required migration state.

**Prevention rule:** Explicitly label any uncommitted, unpushed, undeployed, or
unmigrated work as "not yet implemented online" and list the remaining release
step. Claim online implementation only after production verification.

### LESSON-010: Deployment probes must match the installed shell version

**Observed problem:** A production endpoint probe waited through repeated
failures because it used a PowerShell parameter unavailable on the installed
Windows PowerShell version.

**Cause:** The probe assumed PowerShell 7 behavior without checking the local
runtime.

**Detection:** Treat an immediate unknown-parameter error as a probe failure,
not a deployment failure, and check `$PSVersionTable.PSVersion` when command
compatibility is uncertain.

**Prevention rule:** Use Windows PowerShell-compatible HTTP error handling in
repository deployment checks unless the runtime version has been verified.

### LESSON-011: Column type migrations must drop every dependent RLS policy

**Observed problem:** A production migration could not change an order status
column from an enum to text because one older RLS update policy still referenced
that column.

**Cause:** The migration removed the policies created by the main schema but
missed a later policy variant introduced by the suspension hardening migration.

**Detection:** Before altering a column type, inspect `pg_policy`, constraints,
indexes, views, triggers, and functions for dependencies, including names from
all historical migrations.

**Prevention rule:** Treat column type changes as repository-wide dependency
migrations. Drop every dependent policy variant before the change and recreate
only the policies required by the new authorization model.

## New Lesson Template

### LESSON-NNN: Short title

**Observed problem:** What verifiably went wrong.

**Cause:** The technical or workflow reason.

**Detection:** How future agents can notice the problem early.

**Prevention rule:** A concrete, reusable rule that prevents recurrence.
