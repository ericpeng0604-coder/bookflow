# Supply Chain Risk Report

---

## Metadata

- **Scan Date**: 2026-07-29 06:30:00 UTC
- **Project**: campus-books
- **Repositories Scanned**: 12 unique Git repositories
- **Total Dependencies**: 18 direct dependencies (8 runtime, 10 development)
- **Scan Duration**: approximately 18 minutes

---

## Executive Summary

The latest `origin/main` dependency baseline is organization-backed overall and
uses the committed npm lockfile. PR1 updates Next.js and React to patched
versions and resolves the high-severity transitive findings reported by npm
audit without using the unsafe forced downgrade path. The remaining supply-chain
health concerns are maintainer concentration and missing security contact for
`web-push`, legacy low-popularity `@eslint/eslintrc`, and execution-capable
browser/WASM tooling. These are tracked for the later hardening and maintenance
PRs.

Evidence for this scan includes npm registry metadata, GitHub repository data
queried with `gh`, the committed manifest/lockfile, `npm audit`, and npm registry
signature verification. This is a supply-chain health review and does not
replace runtime security testing.

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

The following dependencies have at least one material supply-chain risk factor.
The Next.js and React rows describe historical/advisory exposure; the locked
PR1 versions are above the identified fixed versions.

| Dependency Name | Risk Factors | Notes | Suggested Alternative |
|-----------------|--------------|-------|-----------------------|
| `next` `15.5.22` | High-risk server features; past high/critical CVEs | [vercel/next.js](https://github.com/vercel/next.js) has published high/critical advisories. PR1 is above the fixed 15.5.21 patch line and `npm audit` returned zero vulnerabilities. | **Keep patched Next 15.5.x** — defer Next 16 migration to a separate compatibility change. |
| `react` / `react-dom` `19.2.8` | High-risk Server Components/server-function boundary; past high/critical CVEs | [react/react](https://github.com/react/react) has published Server Components advisories. PR1 is at the fixed 19.2.8 line and the affected 19.2.7 advisory no longer matches. | **Keep patched React 19.2.x** — update only through reviewed Dependabot or security PRs. |
| `web-push` `3.6.7` | Single npm publishing maintainer; low popularity; no security contact found | npm metadata lists one maintainer (`marco-c`); [web-push-libs/web-push](https://github.com/web-push-libs/web-push) has ~3,530 stars and no security contact file or guidance detected. The repository is active and no published repository advisories were found. | **No safer drop-in replacement verified.** PR3 should exact-pin this package and monitor its upstream owner. |
| `@eslint/eslintrc` `3.3.5` | Low popularity; no security contact found | [eslint/eslintrc](https://github.com/eslint/eslintrc) has ~177 stars and no security contact guidance detected. It remains needed by the current Next 15 legacy ESLint configuration. | **Keep until a separate Next 16 flat-config migration.** Update only as a reviewed patch dependency. |
| `tesseract.js` `5.1.1` | High-risk features; install script | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) executes WASM through workers and loads OCR assets. The current package has a lifecycle script; its name is tracked by the PR2 install-script allowlist. | **`tesseract.js@7.0.0`** — PR3 candidate, gated by fixed English/Traditional Chinese OCR tests. |
| `playwright` `1.60.0` | High-risk features | Playwright launches browser binaries and executes browser-side test code. It is retained because `scripts/check-public-mobile.mjs` imports it. Repository: [microsoft/playwright](https://github.com/microsoft/playwright). | **Keep dev-only** — do not remove an active release smoke dependency. |

## Suggested Alternatives

- PR1 updates `next`, `eslint-config-next`, `react`, and `react-dom` to patched versions and pins compatible transitive fixes through npm overrides.
- PR2 should add lifecycle-script and registry-integrity guards, npm audit/signature checks, and High/Critical dependency review in Release Readiness.
- PR2 should enable GitHub Dependabot security alerts and security updates while retaining the existing weekly update schedule.
- PR3 should exact-pin `web-push`, test `tesseract.js@7.0.0`, and update `@eslint/eslintrc` only as a compatible patch; no immediate replacement is recommended for either `web-push` or Playwright.
- PR1 evidence: `npm audit --audit-level=high` reported 0 vulnerabilities; `npm audit signatures` verified 484 packages and 100 attestations.

## Report Generated By

Supply Chain Risk Auditor Skill
Generated: 2026-07-29 06:30:00 UTC
