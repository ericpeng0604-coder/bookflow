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

### LESSON-058: Supabase Storage objects require the Storage API

**Observed problem:** Student verification review failed with `Direct deletion
from storage tables is not allowed`.

**Cause:** A database function attempted to delete rows from
`storage.objects`, which Supabase protects from direct table deletion.

**Detection:** Search new migrations and database functions for
`delete from storage.objects`; review and cleanup paths must use the Storage
API from a trusted server route instead.

**Prevention rule:** Keep database functions responsible for metadata and
status updates only. Use a server-side Storage API client for object deletion,
with authenticated permission checks and retry-safe cleanup.

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

### LESSON-019: Cross-feature static checks must tolerate equivalent implementations

**Observed problem:** Rebasing a feature onto a newer authentication change
caused a valid OTP reset path to fail its regression check after nearby cleanup
statements changed indentation. A later React cleanup intentionally replaced
chat state resets inside an effect with keyed component remounting, but the
chat-switching regression check still required the old `setMessages([])` and
`setImageUrls({})` implementation.

**Cause:** The check matched an exact multi-line source string or one specific
implementation, including fixed whitespace, instead of the required behavior
contract and safety invariants.

**Detection:** When a static check fails after a clean rebase, inspect the
target behavior before changing production code. Compare the assertion with the
integrated source and ask whether an equivalent implementation still preserves
the same user-visible guarantee.

**Prevention rule:** For cross-feature source checks, match stable syntax or
behavioral structure with whitespace-tolerant patterns. Prefer checking the
contract, such as keyed state isolation plus stale async invalidation, over
requiring a particular state-reset statement. Rerun the complete project suite
after every rebase or check update.

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

### LESSON-041: Workflow check names must be encoding-safe

**Observed problem:** The AI handoff workflow name, job name, and step names
were mojibake, while release documentation referenced the readable required
status name.

**Cause:** The workflow text was not included in workflow structure checks for
readable status names or encoding corruption.

**Detection:** Inspect required GitHub status names and run workflow checks that
fail on replacement characters, private-use characters, or known mojibake
signals in status-bearing workflow files.

**Prevention rule:** Keep required workflow and job names stable and readable,
and make `check:workflows` assert the exact status-bearing names before changing
branch protection or release documentation.

### LESSON-042: Release preflight catches stale branches and missing handoff

**Observed problem:** A small UI copy deployment took longer because a new
commit was first pushed to a branch whose earlier PR had already been
squash-merged, then GitHub checks failed because the handoff files were not
updated with the substantive code change.

**Cause:** Local release triage identified the changed areas but did not verify
that the branch contained only unapplied commits relative to `origin/main`, nor
that AI handoff requirements would pass before opening the PR.

**Detection:** Before opening or merging a release PR, compare the branch with
`origin/main` using `git cherry` semantics and run the AI handoff check against
the PR range.

**Prevention rule:** Run `npm run release:preflight` after the release commit
and handoff update are ready. If it reports already-applied commits mixed with
new commits, create a clean branch from `origin/main` and cherry-pick only the
new release commit. If it reports missing handoff files, update
`AI_HANDOFF.md`, `.ai/state.json`, and `.ai/history/` before pushing.

### LESSON-043: Duplicate dev servers slow local verification

**Observed problem:** The BookFlow checkout accumulated many Node/Next dev and
start processes on different local ports, while `.next` held a large cache and
the shell could not find the expected Node runtime.

**Cause:** Local preview servers were started repeatedly without a cleanup
gate, and checks assumed `node` or `npm` were available from the shell PATH.

**Detection:** Before blaming product code or Codex latency, inspect active
Node/Next processes for this checkout, check whether `.next` is stale or large,
and verify `node` plus the project package manager resolve in a fresh shell.
If cleanup fails because a listed process no longer exists, treat that as a
normal race rather than a product or deployment failure.

**Prevention rule:** Use the bundled runtime, a verified PATH, or the
Codex-safe `:codex` package scripts when the shell cannot find `node`. Run
`pnpm run dev:doctor` when local work feels slow, and run `pnpm run dev:clean`
before starting a new local preview if stale Next processes or `.next` cache
are present. Cleanup scripts must tolerate already-exited processes.

### LESSON-044: Context budget must not replace evidence

**Observed problem:** AI work in this repository can consume excessive context
and quota when agents repeatedly dump large files, logs, browser snapshots, or
deployment dashboards while trying to rediscover known project state.

**Cause:** Context reduction was treated as an ad hoc conversation preference
instead of a project workflow with explicit guardrails and evidence gates.

**Detection:** Watch for repeated full reads of high-context files such as
`components/marketplace-app.tsx`, `app/globals.css`, `AI_WORK_MANUAL.md`, and
large logs after the relevant location is already known. Also watch for repeated
dashboard polling when a direct status endpoint or release smoke script would
give stronger proof.

**Prevention rule:** Start each non-trivial task with targeted search, changed
hunks, `pnpm run ai:budget`, `pnpm run ai:budget:codex`, or
`pnpm run release:plan` as appropriate. Read only the narrow context needed to
make a safe change, reuse evidence gathered during the task, and prefer direct
HTTP/API probes for deployment proof. Do not save context by skipping required
tests, staging checks, production smoke, security review, diff review, or
protected-file checks.

### LESSON-045: UI workflow fixes need a narrow verification ladder

**Observed problem:** Multi-surface UI fixes around marketplace chat, request
flow, and homepage filters can waste substantial context when agents reread
large component files, retry shell-specific dev startup commands, and fall back
to broad manual browser exploration before running the focused checks that
already exist in the repository.

**Cause:** The task spans one large UI surface, but the verification path was
not reduced into a stable ladder. Agents rediscovered the same file regions,
runtime fallback, and regression targets instead of moving through a fixed
sequence.

**Detection:** Watch for repeated full reads of
`components/marketplace-app.tsx` or `app/globals.css` after the relevant
symbols are already known, repeated attempts to start local preview servers
through wrapper scripts when only host or port changes are needed, or browser
checks that begin before targeted static checks and a production build have
already narrowed the risk.

**Prevention rule:** For marketplace UI tasks, first locate exact symbols with
targeted search and read only the affected ranges. Then run the smallest
relevant regression scripts, such as `pnpm run check:chat-listing-order-ux`,
`pnpm run check:listing-ui`, and `pnpm run check:home-accessibility`, plus
`pnpm run typecheck` and `pnpm run build` when behavior crosses shared state,
chat flows, or database-backed request data. Use the bundled Node/pnpm runtime
when the shell PATH is incomplete. Only start a browser after the focused
checks pass, and treat that browser step as confirmation of the changed
interaction rather than the primary way to rediscover application state.

### LESSON-046: Production release proof must follow the protected workflow path

**Observed problem:** A marketplace release was ready to ship, but deployment
could not finish from the dirty local checkout alone because the real gating
steps were outside the code diff: the PR was still a draft, `Production
Migration` required a protected manual dispatch, and Vercel reported success
before direct health probes immediately reflected the new commit.

**Cause:** Release completion was treated as a git or build task instead of an
end-to-end workflow that includes PR state, protected GitHub Actions, database
migration approval, deployment propagation, and the repository's own smoke
evidence.

**Detection:** Before claiming a BookFlow release is deployed, verify all of
these in order: the shipping PR is not draft, required PR workflows are green,
database releases have a completed `Production Migration` run, the merge commit
has a successful Vercel status, and the latest `Production Deployment Monitor`
run (or equivalent `release:smoke` evidence) passed for that deployment.

**Prevention rule:** When a release includes database-backed application
changes, ship from the clean PR branch rather than the dirty working tree. Move
the PR out of draft before waiting on checks. Trigger `Production Migration`
only through the authenticated GitHub workflow, select the approved migration
ref, keep the required `production-database` Environment reviewer approval,
wait for the migration to succeed, then merge. Treat `Production Deployment
Monitor` or `release:smoke` success as the final proof point when
`/api/health/release` still shows the older commit during propagation.

### LESSON-047: Codex checks need stable runtime and preview commands

**Observed problem:** Local verification lost time because `node` was not on
the shell PATH, a guessed `typecheck:codex` script did not exist, `pnpm run dev
-- --hostname ...` passed Next flags as a project directory, and a stuck local
preview left `.next` in a state that blocked a later production build.

**Cause:** Runtime fallback, type checking, preview startup, and stale-process
cleanup were handled as ad hoc shell fixes instead of repository scripts with
known argument shapes.

**Detection:** Watch for `node is not recognized`, missing `:*codex` scripts,
Next reporting an invalid project directory named like a flag, `next dev`
staying on `Starting...`, or `next build` timing out while Node/Next processes
for this checkout are still running.

**Prevention rule:** In Codex or any shell that may not have Node on PATH, use
the repository `:codex` scripts: `pnpm run typecheck:codex`, `pnpm run
build:codex`, `pnpm run dev:doctor:codex`, `pnpm run dev:clean:codex`,
`pnpm run start:codex`, and targeted check variants such as `pnpm run
check:chat-listing-order-ux:codex`. Before rerunning a build after a stuck
preview, run `pnpm run dev:clean:codex` so `.next` is not shared with stale
Next processes. Because `dev:clean:codex` removes `.next`, run `pnpm run
build:codex` again before `pnpm run start:codex`.

### LESSON-048: Memory and project lookups need a low-output first pass

**Observed problem:** A memory inspection request consumed excessive context
because the investigation expanded from a narrow question into broad recursive
memory scans, full manual reads, and rollout-summary inspection before the
first pass had identified concrete high-risk entries.

**Cause:** Precision evidence gathering was started too early. The agent used
large source reads and broad keyword scans as the default lookup mechanism
instead of first building a small candidate list.

**Detection:** Watch for full reads of `MEMORY.md`, rollout summaries, raw
session logs, `AI_WORK_MANUAL.md`, browser DOM snapshots, or large source files
when the user only asked for a narrow inspection or creation task.

**Prevention rule:** Start lookup-heavy tasks with `pnpm run ai:lookup -- ...`
or `pnpm run ai:lookup:codex -- ...` and inspect only the returned candidate
line windows. Use `--deep` only after the first pass shows a concrete need for
rollout history. Do not reduce token usage by skipping required checks,
security review, deployment proof, or evidence needed for a reliable
conclusion.

### LESSON-049: Repeated mistakes need autonomous prevention

**Observed problem:** The user had to repeatedly remind agents to turn errors,
token waste, unsafe recall, and workflow friction into durable improvements
instead of one-off explanations.

**Cause:** Agents fixed the immediate symptom but waited for explicit follow-up
before adding the check, helper, redaction, lesson, or workflow guard that would
prevent the same issue from recurring.

**Detection:** Watch for any real mistake, failed assumption, repeated blocker,
escaped defect, sensitive-detail exposure, token-heavy rediscovery loop, or
workflow step that required user correction.

**Prevention rule:** Do not wait for the user to ask for prevention. Fix the
immediate issue, identify the root cause, add the smallest durable guard, and
verify that guard. Use `pnpm run ai:improve -- "problem"` or
`pnpm run ai:improve:codex -- "problem"` for a low-output self-improvement
brief, then implement the recommended script, check, manual lesson, redaction,
or regression test when it fits the issue. Keep the guard scoped and do not
replace required product checks or release proof with a checklist.

### LESSON-050: PR check waiting must be low-output

**Observed problem:** A deployment consumed excessive context because
`gh pr checks --watch --interval 10` repeatedly printed the full check table
while waiting for GitHub Actions, Vercel, CodeRabbit, staging migration, and
release readiness to complete.

**Cause:** The agent used an interactive watch command as if it were a compact
status poller. The command was operationally correct, but its repeated full
output did not add evidence beyond the final pass/fail state.

**Detection:** Watch for commands such as `gh pr checks --watch`, dashboard
polling loops, or repeated full workflow tables during release work. If the
same pending/pass rows appear more than once, the wait path is too noisy.

**Prevention rule:** Use `pnpm run release:watch-pr -- <pr-number-or-url>` or
`pnpm run release:watch-pr:codex -- <pr-number-or-url>` to wait for PR checks.
It prints compact status changes and final failures only. Do not use
`gh pr checks --watch` in Codex unless the low-output helper is unavailable and
the user explicitly accepts the extra context cost.

### LESSON-051: Mobile chat switching must preserve the page viewport

**Observed problem:** Tapping a conversation in the mobile chat rail could move
the whole page to the bottom while opening the selected chat.

**Cause:** The chat switch preserved outer-page scroll only for desktop-width
layouts, while the mobile open-chat layout also changes height and loads a
scrollable message panel.

**Detection:** On a narrow viewport, scroll the dashboard so the chat rail is
visible, tap between conversations in the left rail, and verify the browser
viewport stays in place while only the message log scrolls.

**Prevention rule:** Conversation-list switching must explicitly preserve and
restore the outer page scroll on all viewport widths. Message-loading auto
scroll may target only the chat log, not the browser page.

### LESSON-052: Migrations must reference the real schema

**Observed problem:** A purchase-request migration called
`public.marketplace_listings`, but the project stores listings in
`public.books`, causing order submission to fail at runtime.

**Cause:** A new migration used an assumed table name instead of matching the
existing schema and RPC implementation.

**Detection:** Search new SQL for tables not present in `supabase/schema.sql`
or established migrations, and run the related feature structure check before
release.

**Prevention rule:** Database migrations must reuse the repository's canonical
tables and eligibility predicates. Add a feature check for any new SQL path that
touches order creation or listing availability.

### LESSON-053: Production observability proof needs code-shipping proof first

**Observed problem:** Sentry smoke verification was attempted after adding the
production DSN in Vercel, but before the Sentry integration code itself had
been shipped to the production deployment.

**Cause:** Environment-variable rollout and application-code rollout were
treated as if they moved together. A production redeploy of the old `main`
commit was incorrectly used as a proxy for shipping the new observability code.

**Detection:** Before testing a new monitoring, analytics, or feature flag
integration in production, compare the local commit containing the integration
with the commit currently reported by Vercel or `/api/health/release`. If the
production commit does not contain the new code, any smoke result is premature.

**Prevention rule:** For observability changes, verify shipping order
explicitly: commit merged to `main`, production deployment updated to that
commit, required environment variables present, then trigger the production
smoke or synthetic error. Never treat an env-only redeploy as proof that new
client or server instrumentation is live.

### LESSON-054: Small release scopes must leave dirty checkouts early

**Observed problem:** A Sentry rollout started in a checkout that already mixed
unrelated UI, SQL, workflow, and tooling edits, so later verification kept
re-separating intended release files from unrelated local work.

**Cause:** Scope isolation happened too late. The agent kept moving forward in
the active dirty checkout instead of moving the narrow change to a clean
worktree before verification, commit selection, and production rollout.

**Detection:** Before adding release-only or observability-only changes, inspect
the working tree areas. If the checkout already spans multiple substantive
areas such as runtime, database, workflows, and tooling, stop and isolate the
target change in a clean worktree or fresh branch.

**Prevention rule:** Treat "small change in a dirty checkout" as an early stop
condition, not a later cleanup task. Run `npm run check:release-scope` before
release verification, and move narrow production changes to a clean worktree
before building, committing, or testing production observability.

### LESSON-055: CI package-manager entrypoints must match the workflow runtime

**Observed problem:** PR #80 failed its `Quality and build` check because the
workflow installed dependencies with `npm ci`, then `npm run check:all` called
`pnpm run ...`, but the GitHub runner had no `pnpm` binary available.

**Cause:** The repository exposed mixed package-manager entrypoints at the
script boundary. A workflow that intentionally used npm was forced back onto
pnpm by `check:all`.

**Detection:** When a CI job installs with `npm ci`, inspect any umbrella
script it calls. If that script shells out to `pnpm`, `yarn`, or another tool
that the workflow did not install, the job will fail before reaching the real
product checks.

**Prevention rule:** Keep top-level CI entrypoint scripts aligned with the
workflow runtime. If a GitHub workflow uses `npm ci`, umbrella scripts like
`check:all` must call `npm run ...` or direct local binaries instead of
assuming `pnpm` is available.

### LESSON-056: Guard optional migration dependencies before privilege changes

**Observed problem:** A staging migration failed because it attempted to
`REVOKE` privileges from an older overloaded RPC signature that was already
absent in the target database.

**Cause:** The migration assumed historical function signatures were present
even though earlier migrations may have dropped or never created them.

**Detection:** Run migrations against a staging database with a different
historical state and inspect `42883` errors around `GRANT` or `REVOKE`
statements.

**Prevention rule:** Use `DROP FUNCTION IF EXISTS` for obsolete overloads before
privilege changes, and only grant or revoke privileges for the signature that
the migration creates or otherwise proves exists.

### LESSON-057: Student-card OCR needs a consented vision fallback

**Observed problem:** Rotated and oblique student-card photos produced valid
student IDs for only some orientations with local numeric OCR.

**Cause:** A full-card photo contains glare, background, perspective, and
barcode noise that can split or distort the eight-digit line even after
rotation attempts.

**Detection:** Benchmark representative student-card photos across 0, 90, 180,
and 270 degree orientations; do not treat one clear reference photo as OCR
coverage.

**Prevention rule:** Keep local OCR as the private first pass, cap its wait
time, and offer a rate-limited AI vision fallback only after explicit user
consent. Always validate the returned candidate against the server-side
student-ID parser and retain the original image for moderator review.

### LESSON-058: PR CodeQL results do not prove default-branch cleanliness

**Observed problem:** The CodeQL PR run reported zero alerts, while the first
default-branch push scan later reported 15 existing open alerts, including
high-severity findings.

**Cause:** PR results were interpreted as a whole-repository baseline, and the
initial workflow did not include a default-branch push trigger.

**Detection:** After merging CodeQL, verify a successful push scan for the
default branch and query its Code Scanning alerts separately from PR alerts.

**Prevention rule:** Keep PR, default-branch push, and scheduled scans enabled;
treat a PR result of zero as "no alert in this change" rather than proof that
the repository is clean.

### LESSON-059: Migration existence checks must assert behavior and provenance

**Observed problem:** A staging RPC probe treated any response other than a
missing-function error as success, and production migration accepted a mutable
Git ref without proving that staging had passed for the same source.

**Cause:** Function existence, authorization behavior, migration history, and
release provenance were collapsed into one shallow check.

**Detection:** Review migration probes for explicit expected status and response
shape assertions. Review production migration inputs for full commit SHA
validation and matching staging-run evidence.

**Prevention rule:** Test public and protected RPCs against their expected
status contract, require immutable migration SHAs, bind production migration to
a successful staging run for that SHA, and record post-migration production
proof separately from migration history.

### LESSON-060: Release helpers must preserve status output and point to tracked files

**Observed problem:** The release scope guard truncated the first porcelain
status path after trimming leading whitespace, and the documented PR watcher
pointed to a helper file that did not exist.

**Cause:** Shell output formatting and helper names were treated as incidental
details instead of tested interfaces.

**Detection:** Run the release plan from a worktree whose first changed path is
hidden or metadata-only, then execute every command printed by the plan.

**Prevention rule:** Preserve Git porcelain leading status characters, keep
printed helper commands backed by tracked files, and add a release-flow test for
each published command entrypoint.

## New Lesson Template

### LESSON-NNN: Short title

**Observed problem:** What verifiably went wrong.

**Cause:** The technical or workflow reason.

**Detection:** How future agents can notice the problem early.

**Prevention rule:** A concrete, reusable rule that prevents recurrence.
