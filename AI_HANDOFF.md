# BookFlow AI Handoff

## 任務目標

BookFlow Figma homepage market-switch pilot

## 目前狀態與背景

- Task ID: `20260718-figma-home-market-switch-pilot`.
- Task: `BookFlow Figma homepage market-switch pilot`.
- Branch: `codex/figma-home-market-switch-pilot`.
- Base commit: `62531360d518171c7557238324e453f5ca199d15`.
- History: `.ai/history/20260718-figma-home-market-switch-pilot.md`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add `Rollback-Workflow-Approved: true` unless this is an authorized rollback/recovery change.

## 已完成

- Use the clean `origin/main` release baseline for a private Figma visual pilot.
- Preserve existing Supabase data flows and do not add a database migration.
- Figma file: `https://www.figma.com/design/eBGxlegWs8bZ9Ei6gTSVS8`

## 下一步

1. Capture and review the homepage market switch in Figma.
2. Run focused regression checks, project checks, typecheck, lint, and production build.
3. Run release scope and handoff preflight checks, then commit and push the branch if the pilot is approved.
4. Open the PR and wait for required GitHub and Vercel gates before any production claim.

## 變更檔案

- A new append-only `.ai/history/*.md` archive is created for this pilot.

## 驗證結果

- Figma capture/readback: `NOT VERIFIED` because the capture remains pending and the capture script was not observed in the browser.
- Local baseline checks passed: listing navigation UI and homepage accessibility; typecheck passed.
- No production or database verification has been claimed.

## 風險與注意事項

- The release branch intentionally includes no Supabase migration and no protected recovery-file changes.
- Browser OAuth interaction requires the configured local public Supabase environment for local smoke testing; no credentials are stored in the repository.

## 下一位 AI 工作指引

1. Keep the pilot limited to the market-switch focus ring, its focused check, and the Figma workflow contract.
2. Keep `AI_HANDOFF.md`, `.ai/state.json`, and the matching `.ai/history/*.md` in sync.
3. Run `node scripts/ai-collaboration.mjs check-ci origin/main HEAD` before opening or merging the PR.

## 相關 Commit

- Base commit: `62531360d518171c7557238324e453f5ca199d15`.
- Current implementation commit before final commit: `not committed yet`.
