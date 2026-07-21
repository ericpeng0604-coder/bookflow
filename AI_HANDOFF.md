# BookFlow AI Handoff

## 任務目標

BookFlow zero giveaway release 0.1.5

## 目前狀態與背景

- Task ID: `20260722-zero-giveaway-release`.
- Task: `BookFlow zero giveaway release 0.1.5`.
- Branch: `codex/giveaway-release-20260722`.
- Base commit: `971347503a257d4baf4736e19d67c99bf1caf415`.
- History: `.ai/history/20260722-zero-giveaway-release.md`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add `Rollback-Workflow-Approved: true` unless this is an authorized rollback/recovery change.

## 已完成

- Remove the standalone message-page return-to-profile control.
- Prevent dashboard reloads from flashing the public market homepage before auth hydration.
- Align tablet mobile-menu positioning and distinguish its background dismiss label.
- Bump the application patch version from 0.1.4 to 0.1.5.
- Show the desktop header's "我的交易" button as active when the dashboard is open.
- Make the header “我的交易” action open the listings dashboard in one click.
- Preserve existing Supabase data flows and do not add a database migration.

## 下一步

1. Run focused regression checks, project checks, typecheck, lint, and production build.
2. Run release scope and handoff preflight checks, then commit and push the branch.
3. Open the PR and wait for required GitHub and Vercel gates.
4. After merge, verify the exact production SHA with `/api/health/release` and `release:smoke`.

## 變更檔案

- A new append-only `.ai/history/*.md` archive will be created before the PR.

## 驗證結果

- Local verification is pending for the desktop active-state patch.
- No production or database verification has been claimed yet.

## 風險與注意事項

- The release branch intentionally includes no Supabase migration and no protected recovery-file changes.
- Browser OAuth interaction requires the configured local public Supabase environment for local smoke testing; no credentials are stored in the repository.

## 下一位 AI 工作指引

1. Keep the release limited to the listed UI, test, and memory-contract changes.
2. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
3. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.

## 相關 Commit

- Base commit: `971347503a257d4baf4736e19d67c99bf1caf415`.
- Current implementation commit before final commit: `77428d3`.
