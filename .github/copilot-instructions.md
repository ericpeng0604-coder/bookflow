# Campus-books repository instructions for GitHub Copilot

## Project foundation

- This repository is `ericpeng0604-coder/bookflow`, the Campus-books campus secondhand marketplace.
- Core product areas include secondhand books, secondhand items, free giveaways, listings, search, purchase requests, orders, chat, notifications, student verification, moderation, roles, suspension, OCR, and browser push.
- Primary stack: Next.js 15, React 19, TypeScript, Supabase, ESLint, Playwright, Sentry, `tesseract.js`, and `web-push`.
- Follow the lockfile committed to the target branch. The current repository uses `package-lock.json`, so use `npm` commands unless an explicitly approved task changes the package manager. Do not silently convert the repository to pnpm.
- Communicate in Traditional Chinese. Keep code, filenames, CLI commands, APIs, database identifiers, and technical terms in English.

## Required reading before changes

1. Read `AGENTS.md`.
2. Read `AI_WORK_MANUAL.md` and apply relevant recorded lessons.
3. Run `node scripts/check-memory.mjs` before trusting handoff or history state.
4. Run `node scripts/ai-lookup.mjs <task keywords>` and inspect only the relevant memory windows.
5. Read `AI_HANDOFF.md`, `.ai/state.json`, the matching `.ai/history/*.md`, and the current Issue or PR.
6. Search the current source code, migrations, policies, tests, and workflows related to the task.

Do not treat an old README, `supabase/schema.sql`, a baseline migration, an old handoff, or chat history as the current production state.

## Reasoning and reporting

Before implementation or review, separate findings into:

- **Verified facts**: supported by current repository content, CI output, staging evidence, or production evidence.
- **Repository items still to inspect**: relevant files, migrations, policies, tests, or workflows not yet checked.
- **Assumptions**: clearly marked and never presented as verified.

A plan, generated file, successful compilation, merged PR, applied migration, deployment, and verified production behavior are different states. Report them separately.

Any test or check that was not actually run must be labeled `NOT VERIFIED` with the reason.

## Git workflow and scope control

- Work on an isolated branch or clean worktree created from the latest intended base.
- Preserve unrelated uncommitted work. Never reset, overwrite, reformat, or absorb unrelated changes.
- Prefer the smallest safe change that satisfies the task.
- Do not push directly to `main` unless the user explicitly authorizes that exact action.
- Open a Draft PR first and include scope, changed files, verification commands, results, risks, and `NOT VERIFIED` items.
- Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching append-only `.ai/history/*.md` entry synchronized when repository rules require them.
- Do not merge, deploy, apply remote migrations, run production load tests, or modify production data without separate explicit approval for that exact action.

## Protected recovery infrastructure

Do not change, delete, rename, format, or regenerate these files during ordinary work:

- `.github/workflows/rollback-production.yml`
- `.github/workflows/protect-rollback-workflow.yml`
- `.github/CODEOWNERS`
- `AGENTS.md`

Only modify them when the user explicitly requests a rollback or recovery-system change. Authorized commits must include the exact trailer `Rollback-Workflow-Approved: true`; never use that trailer for unrelated work.

## Supabase and high-risk changes

For Supabase, schema, migration, RLS, RPC, Auth, roles, suspension, transactions, orders, purchase requests, notifications, or deployment work:

- Search the current repository and latest handoff before proposing or editing anything.
- Identify all affected tables, columns, constraints, indexes, views, triggers, functions, grants, RLS policies, API routes, UI states, and tests.
- Verify migration ordering, backward compatibility, rollback strategy, and environment state.
- Test both allowed and denied authorization cases.
- Never use UI hiding as a substitute for database authorization.
- Never expose service-role keys, database URLs, tokens, credentials, personal data, or production secrets in code, logs, Issues, PRs, comments, or responses.

For purchase and order flows, explicitly verify:

- race conditions and concurrent requests;
- atomicity and transaction boundaries;
- legal and illegal state transitions;
- uniqueness and idempotency guarantees;
- buyer, seller, admin, suspended-user, and anonymous RLS behavior;
- notification consistency, including duplicate, missing, retry, and stale-state scenarios.

Database and production-critical changes must pass staging verification before production can be considered ready.

## Implementation expectations

- Follow existing project structure and conventions before creating new abstractions.
- Use TypeScript types deliberately; avoid `any` unless a concrete reason is documented.
- Keep client/server boundaries explicit in Next.js.
- Preserve existing behavior outside the requested scope.
- Avoid broad refactors during bug fixes unless evidence shows they are required.
- For user-facing UI, verify mobile and desktop behavior, accessibility names, keyboard interaction, loading, empty, error, retry, and permission states when applicable.
- Do not hide responsive overflow with `overflow-x: hidden` when the underlying layout is broken.
- Treat third-party console noise separately from application errors by checking the source host and request URL.

## Verification and completion

Run the smallest relevant checks first, then the repository gates required by the change. Use existing scripts from `package.json` rather than inventing parallel validation paths.

Applicable evidence may include:

- focused tests;
- `npm run typecheck`;
- changed-file or full ESLint;
- Playwright tests at relevant viewport sizes;
- production build;
- project-specific checks;
- workflow validation;
- staging RLS, RPC, migration, concurrency, notification, and smoke tests.

Report each command, exit result, important output, and environment. Do not claim online implementation until the exact merged commit is deployed and production behavior is independently verified.

## Definition of a good Copilot response

A good response is concise but complete, cites the repository evidence it relied on, identifies risks early, preserves scope, and ends with concrete deliverables and honest `NOT VERIFIED` items. Never make completion sound stronger than the evidence supports.
