# Fix chat transaction details, purchase response RPC ambiguity, and listing image fallbacks

- Branch: `codex/chat-order-deploy-20260729`
- Base commit: `e711182cd68d9d5f1a01147de7a3c2767d16da30`
- Scope: chat transaction details, purchase response RPC signature, and book cover resilience.

## Root cause

- The chat details panel rendered coordination content unconditionally, so the details button only changed its label and accessibility state.
- The exposed purchase response RPC had both text and enum overloads with the same argument names, so PostgREST could not choose a candidate for the client string payload.
- Marketplace and dashboard listing images used direct image rendering without a failure fallback.

## Changes

- Gate transaction coordination content on the details control state.
- Remove the obsolete enum overload with an idempotent migration and request a PostgREST schema reload.
- Use one resilient book-cover renderer for marketplace cards and dashboard listings, including an accessible unavailable-cover fallback.
- Add a focused regression check to the project check suite.

## Verification

- Focused regression checks, typecheck, lint, and production build passed on the source checkout.
- Clean release-worktree verification is pending.
- Remote staging, production migration, merged SHA, and authenticated browser proof are pending.
