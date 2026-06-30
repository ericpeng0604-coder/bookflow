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

### LESSON-012: Prop changes must invalidate asynchronous UI state

**Observed problem:** Switching chats could briefly show the previous chat and
allow its slower message or image request to overwrite the newly selected chat.

**Cause:** The chat component reused local state across conversation changes,
and asynchronous callbacks were not invalidated during cleanup.

**Detection:** Rapidly switch between records whose detail panels fetch data,
and verify that content, loading state, realtime events, and delayed responses
always belong to the currently selected record.

**Prevention rule:** Key stateful detail components by record identity, reset
record-specific state on change, and ignore asynchronous results after cleanup.

### LESSON-013: Lazy tabs must not hide required dashboard state

**Observed problem:** After a fresh login, purchase requests appeared empty
until the user clicked the requests tab because only the default listings tab
was loaded.

**Cause:** Tab-level query optimization was also used for shared badge and
transaction state that users expected to be ready when the dashboard opened.

**Detection:** Test a fresh login and first dashboard visit without clicking
each tab; verify shared counts and transaction records are already available.

**Prevention rule:** Keep expensive tab details lazy, but preload shared
dashboard state required by badges, cross-tab actions, and first-entry behavior.

### LESSON-014: Shipping SQL files does not migrate production

**Observed problem:** Purchase-notification SQL was merged and deployed with the
web app, but the production Supabase function remained unchanged.

**Cause:** A repository SQL file and a Vercel deployment were treated as if they
also applied a database migration.

**Detection:** Compare the production RPC behavior or migration history after
every database-related release; do not infer database state from a green web
deployment.

**Prevention rule:** Track database rollout as a separate required release
step, apply the idempotent SQL to staging and production with explicit approval,
and verify the resulting notification behavior before claiming it is online.

### LESSON-015: Release claims need independently enforced evidence

**Observed problem:** Pull requests could describe successful local checks even
though GitHub only enforced the AI handoff check, and database changes depended
on manually remembered SQL steps.

**Cause:** Verification evidence lived in PR text and operator knowledge instead
of required CI, versioned migrations, and post-deployment checks.

**Detection:** Compare the documented release checklist with required GitHub
statuses, migration history, staging evidence, Vercel deployment status, and
production smoke-test output.

**Prevention rule:** Enforce build and behavior checks in CI, apply timestamped
migrations to staging before production, and claim a release complete only
after the deployed commit passes production smoke tests.

### LESSON-016: Recovery authorization must survive PR merges

**Observed problem:** Checking only the pushed merge commit for the recovery
approval trailer can reject an authorized change because the trailer lives on
the reviewed commit inside the pull request.

**Cause:** The protection workflow treated the tip commit message as the entire
push authorization record.

**Detection:** Test both direct pushes and PR merge ranges that modify recovery
files, and verify that an approval trailer anywhere in the pushed range is
recognized.

**Prevention rule:** Validate recovery authorization across the exact
`before..after` push range, and keep application rollback from changing the
protected recovery files.

### LESSON-017: Static checks must preserve the source text they assert

**Observed problem:** Newly added regression scripts contained mojibake in
Chinese string assertions, so the checks could not verify the intended source.

**Cause:** The scripts were saved or generated without validating their encoded
text against the files under test.

**Detection:** Run every new check and inspect its asserted literals for
replacement characters or suspicious byte-decoding patterns.

**Prevention rule:** Save verification scripts as UTF-8, use stable structural
assertions where practical, and confirm every text assertion matches readable
source before relying on the result.

### LESSON-018: Active Next processes can invalidate local build evidence

**Observed problem:** A full verification run in the active checkout stalled
until timeout, while the same source completed a production build in a clean
detached worktree.

**Cause:** Long-running Node and Next processes shared the active checkout and
its `.next` output with the verification run.

**Detection:** When a build stops producing progress, inspect active Node
processes and `.next` state, then compare with one clean detached-worktree run.

**Prevention rule:** Do not treat a stalled build as a product failure or a
passing check. Verify release candidates in a clean worktree whenever the
active checkout is serving Next or has shared `.next` output.

### LESSON-019: Cross-feature static checks must tolerate formatting changes

**Observed problem:** Rebasing a feature onto a newer authentication change
caused a valid OTP reset path to fail its regression check after nearby cleanup
statements changed indentation.

**Cause:** The check matched an exact multi-line source string, including fixed
whitespace, instead of the required control flow and assignment.

**Detection:** When a static check fails after a clean rebase, inspect the
target behavior before changing production code and compare the assertion with
the integrated source.

**Prevention rule:** For cross-feature source checks, match stable syntax or
behavioral structure with whitespace-tolerant patterns, and rerun the complete
project suite after every rebase.

### LESSON-020: PostgREST RPC probes must match the deployed signature

**Observed problem:** A staging migration applied successfully, but its
verification job reported an existing moderation RPC as missing.

**Cause:** The probe supplied pagination parameters to a zero-argument
function, so PostgREST correctly returned its function-signature lookup error.

**Detection:** When migration history succeeds but an RPC existence probe
returns `PGRST202`, compare the request JSON keys with the exact SQL function
arguments before assuming the migration failed.

**Prevention rule:** Build staging RPC probes from the declared SQL signature,
use an empty object for zero-argument functions, and treat authorization
failures separately from signature lookup failures.

### LESSON-021: Hidden file inputs must survive form selector specificity

**Observed problem:** A listing form displayed both the browser's native file
control and a custom upload card, even though the native input had a visually
hidden utility class.

**Cause:** The general `.form input` rule had enough specificity to override
parts of the hidden-input utility, so the control became visible and duplicated
the upload affordance.

**Detection:** Open every file-upload form in the browser and confirm there is
exactly one visible file-selection control before relying on source classes.

**Prevention rule:** Prefer one accessible upload control. If a native file
input is intentionally hidden, verify its computed browser layout against the
form styles and add a regression check that rejects duplicate upload controls.

### LESSON-022: OCR output is untrusted until field-level validation

**Observed problem:** Mobile book-cover OCR processed a full-resolution photo
with a newly created bilingual worker, then wrote a high-confidence
mixed-script garbage string into the title field.

**Cause:** Engine confidence was treated as field correctness, and every run
paid the cost of loading broad language data and processing all source pixels.

**Detection:** Benchmark representative phone photos, preserve the raw OCR
text, and test whether malformed mixed-script strings can enter title, author,
or edition fields.

**Prevention rule:** Cap OCR image dimensions, warm and reuse workers, use a
small fast language pass before a lazy fallback, and require known-cover or
field-level plausibility checks before changing user-entered form values.

### LESSON-023: Cloud OCR fallback needs server-side limits and non-destructive merging

**Observed problem:** Improving weak mobile OCR with a cloud vision model could
expose a reusable API key, create unbounded cost, or replace text that a user
typed while recognition was still running.

**Cause:** A browser-side model call and unconditional form assignment treat
authentication, billing, privacy, and asynchronous user edits as separate
concerns even though they fail together in the same workflow.

**Detection:** Verify that the model key is server-only, requests require a
fresh authenticated session, quota is atomic and persistent, uploaded images
are not logged or stored, and delayed results do not replace non-empty fields.

**Prevention rule:** Put paid vision calls behind an authenticated server
endpoint with a database-backed daily quota, disclose temporary cloud
processing, and only fill fields that remain empty when the result arrives.

### LESSON-024: Vercel runtime OIDC tokens arrive in the request header

**Observed problem:** The production AI fallback reported missing service
configuration even though the application was deployed on Vercel with OIDC
support.

**Cause:** The route only checked `process.env.VERCEL_OIDC_TOKEN`. Vercel exposes
that value during builds, but Vercel Functions receive the runtime token through
the `x-vercel-oidc-token` request header.

**Detection:** Exercise the authenticated production route instead of relying
only on builds or unauthenticated smoke checks, and verify the runtime request
contains the OIDC header before declaring AI Gateway available.

**Prevention rule:** In Vercel Functions, read OIDC from
`request.headers.get("x-vercel-oidc-token")`, with environment variables used
only as explicit API-key or local-development fallbacks.

### LESSON-025: Provider compatibility needs an authenticated image request

**Observed problem:** After OIDC authentication was fixed, the AI Gateway still
rejected the production vision request even though the model existed and static
request-shape checks passed.

**Cause:** Model availability and endpoint documentation were treated as proof
that the selected provider compatibility surface worked for this exact
multimodal structured-output request.

**Detection:** Send the real authenticated image through the deployed endpoint
and distinguish service configuration, authentication, provider request, and
response parsing failures.

**Prevention rule:** For AI Gateway vision extraction, use the documented
OpenAI Chat Completions image and `json_schema` wire format, and do not claim
provider compatibility until one real deployed request returns parsed fields.

### LESSON-026: Compatibility endpoints require their documented parameter names

**Observed problem:** The production AI Gateway request still failed after
switching to Chat Completions because it retained provider-native options that
were not part of the Gateway's documented compatibility request.

**Cause:** `max_completion_tokens` and strict-schema behavior from a provider
API were mixed into a compatibility endpoint that documents `max_tokens` and a
plain `json_schema` object.

**Detection:** Compare the complete serialized request against the exact
compatibility-endpoint example, then verify it with an authenticated deployed
image instead of checking only the endpoint path and content types.

**Prevention rule:** On compatibility APIs, send only documented parameter
names and shapes until a deployed request succeeds; add optional provider
features one at a time with live regression evidence.

### LESSON-027: Privacy-safe diagnostics are required for paid provider failures

**Observed problem:** Multiple deployed image requests returned the same generic
fallback message, so parameter, billing, routing, and rate-limit failures could
not be distinguished without another deployment.

**Cause:** The route discarded the upstream HTTP status and machine-readable
error code together with the sensitive provider payload.

**Detection:** Exercise one authenticated production request and verify that a
failure reports a provider status and allowlisted code without echoing prompts,
images, credentials, or raw provider messages.

**Prevention rule:** For paid provider calls, return or record only sanitized
status and machine codes needed for operations; never log uploaded content or
raw model responses.

### LESSON-028: A fallback request marks local OCR as untrusted

**Observed problem:** When the cloud provider rejected a request, the form still
filled a mixed-name garbage string from the local OCR pass even though that pass
had already requested AI fallback.

**Cause:** The UI applied the local draft after the fallback attempt regardless
of whether the local recognizer had classified the overall result as weak.

**Detection:** Test a difficult real photo while forcing the AI endpoint to
fail, then verify every empty book field remains empty and existing manual text
is preserved.

**Prevention rule:** When local OCR requests cloud fallback, treat its draft as
untrusted and do not apply it unless a usable cloud result replaces it; failure
must leave fields blank rather than guessing.

### LESSON-029: Free AI fallback must not depend on a paid-account gate

**Observed problem:** The deployed vision fallback was technically correct but
Vercel AI Gateway rejected every request with customer verification required,
which required adding a credit card the project owner did not have.

**Cause:** Provider selection considered model quality and API compatibility but
not whether the production account could activate the advertised free credits.

**Detection:** Before integrating a free fallback, create the production
credential and run one authenticated image request without billing enabled.

**Prevention rule:** When no-card operation is required, use a provider whose
API key and image model work on its actual free tier, keep the key server-side,
and preserve a safe local/manual fallback when quota is exhausted.

### LESSON-030: Schema additions must update column grants and review triggers together

**Observed problem:** New listing fields such as publisher and marketplace type
were accepted by the form but omitted from the seller update grant or the
change-detection trigger that sends edited listings back to review.

**Cause:** The table, explicit column allowlist, RPC return shape, and review
trigger evolved in separate migrations.

**Detection:** For every new seller-editable column, compare insert/update
payloads, column grants, review-trigger tuples, mapper fields, and list RPC
return columns in one schema-contract test.

**Prevention rule:** Treat listing-schema changes as one atomic contract:
storage, grants, moderation reset, RPCs, mappers, forms, and tests must change
together.

### LESSON-031: Paid quota needs reservation, idempotency, and release states

**Observed problem:** A provider timeout, 429, 5xx, malformed response, or
unusable recognition result could consume a user's daily AI allowance even
though no usable value was delivered.

**Cause:** Usage was incremented before the provider call without a reversible
reservation or replay key.

**Detection:** Force provider failure and concurrent duplicate requests, then
verify only one reservation exists and failed work returns capacity.

**Prevention rule:** Reserve quota under an idempotency key, serialize concurrent
requests, mark only usable results completed, and release every failed or
expired reservation.

### LESSON-032: Sensitive verification data needs deletion as part of the workflow

**Observed problem:** Student-card images and OCR text could remain after review
because row status and Storage cleanup were treated as separate operations.

**Cause:** The verification workflow had no pending dedupe, consent timestamp,
retention deadline, synchronized deletion, or access audit.

**Detection:** Review, reject, withdraw, and expire a verification in staging;
confirm both the Storage object and sensitive row fields are removed and the
audit event remains.

**Prevention rule:** Build sensitive-data deletion into the same privileged
transaction as the status change, then run a scheduled retention cleanup as a
second safety net.

### LESSON-033: Direct config imports must be direct package dependencies

**Observed problem:** A clean dependency layout could not run ESLint because
`eslint.config.mjs` imported `@eslint/eslintrc` even though the project relied
on another package manager hoisting it transitively.

**Cause:** A transitive dependency happened to be reachable in one
`node_modules` layout and was mistaken for a declared project dependency.

**Detection:** Run lint from a clean, isolated install with strict dependency
resolution instead of reusing an old shared `node_modules`.

**Prevention rule:** Any package imported by repository code or configuration
must be declared directly in `dependencies` or `devDependencies`.

### LESSON-034: Isolate worktree dependencies and keep one package manager

**Observed problem:** Running a package manager in an isolated worktree followed
the worktree's `node_modules` junction and updated the main workspace dependency
directory.

**Cause:** PowerShell failed to remove the reparse point, but the install
continued without rechecking whether the path was still a junction. A later
verification also invoked pnpm over an npm-created dependency tree, causing
both package managers to reorganize the same directory.

**Detection:** Inspect `LinkType` and `Target`, remove the exact junction, then
assert the path no longer exists before invoking any package manager. Record
which package manager created the independent dependency tree and use only that
manager (or direct local binaries) for the rest of the run.

**Prevention rule:** Never install through a worktree dependency junction. Stop
immediately if junction removal fails; use a tested literal reparse-point
deletion method and create an independent dependency directory first. Do not
run pnpm commands against an npm-created `node_modules`, or vice versa.

### LESSON-035: Gate later shell steps on each command exit code

**Observed problem:** A commit proceeded after `git diff --cached --check`
reported trailing whitespace because PowerShell continued to the next command.

**Cause:** Multiple validation and mutation commands were placed in one script
without explicitly checking `$LASTEXITCODE`. Later, token-saving attempts also
minified PowerShell so aggressively that required spaces around `foreach` and
named parameters were removed.

**Detection:** After every external validation command, assert its exit code
before staging, committing, pushing, or deploying.

**Prevention rule:** Do not rely on PowerShell to stop after a failed external
command. Check `$LASTEXITCODE` and throw before any following mutation.
Keep release scripts readable and one statement per line; never save tokens by
minifying PowerShell syntax.

### LESSON-036: Structured AI output must allow for multipart and bounded responses

**Observed problem:** A clear university textbook cover reached Gemini, but the
application reported that the AI response format could not be parsed.

**Cause:** The parser read only the first response text part and the response
budget was too tight for a structured result from a thinking-capable model.

**Detection:** Test split response parts, fenced or prefixed JSON, incomplete
JSON, and a real cover whose local OCR cannot read stylized Traditional Chinese
title text.

**Prevention rule:** Join all provider text parts, extract one complete JSON
object defensively, reserve enough output tokens, and disable unnecessary
thinking for deterministic extraction requests.

### LESSON-037: Production smoke should not install unused dependencies

**Observed problem:** Small UI-only releases felt slow because the production
deployment monitor installed the whole dependency tree before running a smoke
script that only uses Node built-ins.

**Cause:** The workflow called `npm ci` and `npm run release:smoke` even though
`scripts/release-smoke.mjs` does not import project packages.

**Detection:** Inspect workflow step timing. If dependency installation takes
longer than the actual smoke probe and the script has no package imports, the
install is release overhead rather than verification.

**Prevention rule:** Keep production post-deploy smoke checks dependency-free
when practical, and run them directly with Node. Add dependency installation
only when the smoke script actually imports packages or build artifacts that
require it.

### LESSON-038: Modal focus traps must not depend on unstable callbacks

**Observed problem:** Typing into controlled fields inside the listing modal
made the modal jump upward and move focus away from the active input.

**Cause:** The modal focus-trap effect depended on an inline close callback.
Each controlled input render recreated that callback, so the effect cleaned up
and re-ran its initial-focus behavior while the user was typing.

**Detection:** Type into each controlled field in a scrollable modal while
watching the active element and modal scroll position. Add a static regression
check that focus-trap setup does not depend on an unstable render callback.

**Prevention rule:** Keep changing global-handler callbacks in refs and run
initial modal focus-trap setup only when the modal is mounted or when the
actual focus target changes.

### LESSON-039: Validate Chinese handoff text before committing

**Observed problem:** AI handoff and history text containing Traditional
Chinese could appear as mojibake in terminal output, making it unclear whether
the committed Markdown was readable.

**Cause:** PowerShell and terminal output can decode UTF-8 Markdown with the
wrong display encoding. Without an automated check, corrupted handoff text can
be mistaken for a harmless display issue or committed unnoticed.

**Detection:** Read handoff files with explicit UTF-8 and run the AI
collaboration check before staging. Treat Unicode replacement characters and
private-use glyphs in AI handoff/history Markdown as suspicious mojibake.

**Prevention rule:** Keep AI handoff and history files UTF-8, validate them
with the project checker, and reject commits when generated collaboration
Markdown contains unreadable mojibake markers.

### LESSON-040: Auth claim parsers must accept documented variants

**Observed problem:** A valid administrator OTP flow could be blocked with a
"use the administrator password first" error before checking the submitted
code, including when the administrator used the supported Google OAuth login.

**Cause:** The server-side JWT parser assumed the authentication method claim
always used one object shape and only modeled password login as the trusted
primary step, so another valid password-authenticated claim shape or Google
OAuth claim was treated as missing primary proof.

**Detection:** When an auth gate rejects a freshly authenticated user, decode
only non-secret claim structure in a local test fixture and compare the parser
against every supported login method and documented claim variant.

**Prevention rule:** Keep auth claim parsing strict about required security
facts but tolerant of supported login methods and documented representation
variants, and add a focused regression check for each accepted shape.

## New Lesson Template

### LESSON-NNN: Short title

**Observed problem:** What verifiably went wrong.

**Cause:** The technical or workflow reason.

**Detection:** How future agents can notice the problem early.

**Prevention rule:** A concrete, reusable rule that prevents recurrence.
