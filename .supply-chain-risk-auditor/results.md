# Supply Chain Risk Report

---

## Metadata

- **Scan Date**: 2026-07-29 05:45:59 UTC
- **Project**: campus-books
- **Repositories Scanned**: 12 unique Git repositories
- **Total Dependencies**: 16 direct dependencies (8 runtime, 8 development)
- **Scan Duration**: approximately 14 minutes

---

## Executive Summary

The project has a generally healthy, organization-backed dependency set, but the
current lockfile contains patch levels of Next.js and React that are below the
fixed versions reported by their upstream security advisories. The most visible
supply-chain concerns are the single npm publishing maintainer and missing
security contact for `web-push`, the low-popularity and missing security contact
for `@eslint/eslintrc`, and unnecessary execution-capable development tooling.

The report is based on the committed `package.json`/`package-lock.json`, npm
registry metadata, and live GitHub repository metadata queried with `gh`. This
is a supply-chain health review, not a replacement for `npm audit`, `pnpm audit`,
or a runtime vulnerability scan.

### Counts by Risk Factor

| Risk Factor | Dependencies | Total |
|-------------|--------------|-------|
| Single maintainer or small team | `web-push` | 1 |
| Unmaintained | None | 0 |
| Low popularity | `web-push`, `@eslint/eslintrc` | 2 |
| High-risk features | `next`, `react`, `tesseract.js`, `playwright` | 4 |
| Presence of past high/critical CVEs | `next`, `react` | 2 |
| Absence of a security contact | `web-push`, `@eslint/eslintrc` | 2 |
| **Total** | **6 unique dependencies** | **11 factor hits** |

### High-Risk Dependencies

The following dependencies have at least one material supply-chain risk factor;
items with multiple factors or current patch-level exposure should be handled
first.

| Dependency Name | Risk Factors | Notes | Suggested Alternative |
|-----------------|--------------|-------|-----------------------|
| `next` `15.5.19` | High-risk server features; past high/critical CVEs | `vercel/next.js` has 24 published high/critical advisories in the queried GitHub data. The installed `15.5.19` is below `15.5.21`, the patched version for CVE-2026-64645, CVE-2026-64649, and CVE-2026-64641. Repository: [vercel/next.js](https://github.com/vercel/next.js). | **`next@15.5.21` or later in the 15.x line** — direct patched successor with minimal compatibility change. |
| `react` / `react-dom` `19.2.7` | High-risk Server Components/server-function boundary; past high/critical CVEs | `facebook/react` has published high/critical Server Components advisories. The installed `19.2.7` is below `19.2.8`, the patched version for CVE-2026-44907. Repository: [react/react](https://github.com/react/react). | **`react@19.2.8` and `react-dom@19.2.8` or later** — direct patched successor. |
| `web-push` `3.6.7` | Single npm publishing maintainer; low popularity; no security contact found | npm metadata lists one maintainer (`marco-c`); [web-push-libs/web-push](https://github.com/web-push-libs/web-push) has ~3,530 stars and no `SECURITY.md`, `.github/SECURITY.md`, or security-reporting guidance detected. The repository is active and no published repository advisories were found, so this is a concentration/response risk rather than evidence of compromise. | **No safer drop-in replacement identified.** Keep only with exact-version pinning, integrity/provenance verification, and upstream monitoring; do not replace it with a less-established package without a protocol/crypto review. |
| `@eslint/eslintrc` `3.3.5` | Low popularity; no security contact found | [eslint/eslintrc](https://github.com/eslint/eslintrc) has ~177 stars and no security contact file or guidance detected. It is actively updated, so this is not an unmaintained finding. The project imports it directly from `eslint.config.mjs` through `FlatCompat`. | **Native ESLint flat config** — migrate `eslint.config.mjs` away from `FlatCompat`, then remove this direct dependency if `eslint-config-next` remains compatible. |
| `tesseract.js` `5.1.1` | High-risk features | The package executes WebAssembly through workers and supports externally loaded OCR assets. The project lazy-loads it in `lib/marketplace/free-ocr.ts`; this is an execution-surface observation, not evidence of malicious behavior. Repository: [naptha/tesseract.js](https://github.com/naptha/tesseract.js). | **`tesseract.js@7.x`** — direct successor; upgrade only with OCR regression coverage and pinned worker/language asset URLs. |
| `playwright` `1.60.0` | High-risk features | Playwright installs/launches browser binaries and executes browser-side test code. It appears only as a direct devDependency in the repository search, with no source usage found. Repository: [microsoft/playwright](https://github.com/microsoft/playwright). | **Remove `playwright` if unused.** If browser tests are added, prefer the scoped official `@playwright/test` package and keep it dev-only. |

## Suggested Alternatives

- Upgrade the `next` and `react` lockfile entries to the fixed patch levels before the next build or release; update the direct ranges in `package.json` to make the minimum safe patch explicit.
- Remove unused `playwright` from `package.json` and regenerate the lockfile, or replace it with `@playwright/test` only when test files actually require it.
- Migrate `eslint.config.mjs` from `FlatCompat` to native flat-config composition where the current `eslint-config-next` version permits it, then remove `@eslint/eslintrc`.
- For `web-push`, retain the canonical package only with exact pinning, lockfile integrity review, provenance/signature checks, and a documented upstream-owner watch; no better drop-in replacement was verified.
- Standardize the package manager. The repository declares `pnpm@11.7.0` but commits `package-lock.json`, while release workflows use `npm ci`. Prefer the existing npm CI path: change the package-manager declaration and documentation consistently, or commit a pnpm lockfile and convert every non-protected workflow consistently. Do not modify the protected rollback workflow as part of this audit.
- Run a separate active vulnerability check (`npm audit`/`pnpm audit`) after the lockfile update; it was intentionally outside this skill's scope.

## Report Generated By

Supply Chain Risk Auditor Skill
Generated: 2026-07-29 05:45:59 UTC
