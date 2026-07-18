# BookFlow Figma workflow

This repository treats the committed code and its automated checks as the
behavioral source of truth. Figma is used for visual review, communication,
and small, explicitly approved design experiments; it does not replace the
runtime implementation or the accessibility contract.

## Pilot contract

- Capture a named page from a clean release worktree and record the source
  commit in the handoff and history files.
- Keep the Figma file private and use the smallest available permissions.
- Do not place credentials, tokens, user data, or production-only content in
  Figma.
- Make one small visual change at a time. For this pilot, the change is the
  keyboard-visible focus ring for the homepage market switch.
- Before accepting a Figma change, compare it with the existing component
  boundary, responsive behavior, contrast, and keyboard checks.
- Do not bulk-overwrite code from an export. Apply reviewed changes manually
  or as a narrowly scoped patch, then run the relevant checks.

## Roundtrip and failure handling

1. Capture code to Figma and record the capture status and file URL.
2. Review the exact node/page in Figma, including focus, hover, active, and
   narrow-screen states where applicable.
3. If a design edit is approved, map it back to the smallest source selector
   or component and preserve behavior that Figma cannot express.
4. Run focused checks, typecheck, lint, and build before release review.
5. If capture, readback, or browser interaction cannot be proven, mark it
   `NOT VERIFIED` in the handoff; do not infer success from a pending job or a
   loaded page alone.

## Release guardrails

Every pilot handoff must identify the branch, full base SHA, Figma file URL,
changed source files, focused checks, and any unverified external step. The
protected rollback workflows and CODEOWNERS file are out of scope unless the
user explicitly authorizes recovery-system changes.
