# BookFlow AI Handoff

## 任務目標

BookFlow zero giveaway release 0.1.5

## 目前狀態與背景

- Task ID: `20260722-zero-giveaway-release`.
- Task: `BookFlow zero giveaway release 0.1.5`.
- Branch: `codex/repair-admin-workbench`.
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
- Add the compact zero-giveaway market layout with category filtering, square listing cards, and giveaway-specific labels.
- Add delayed floating meetup-mode descriptions that do not shift the fields below.
- Keep listing-photo upload guidance readable and preserve OCR edits when users manually revise fields.
- Preserve existing Supabase data flows and do not add a database migration.

## 下一步

1. Push the release commit and wait for required GitHub and Vercel gates.
2. Merge the PR only after all required gates pass.
3. After merge, verify the exact production SHA with `/api/health/release` and `release:smoke`.

## 變更檔案

- `app/globals.css`, `components/marketplace-app.tsx`, `components/marketplace/navigation-state.ts`, `lib/marketplace/queries.ts`, `lib/marketplace/student-card-ai.ts`, and `package.json`.

## 驗證結果

- Local release candidate passed: 29/29 project checks, TypeScript, ESLint, and production build.
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
- Current implementation commit: `999ad08`.
