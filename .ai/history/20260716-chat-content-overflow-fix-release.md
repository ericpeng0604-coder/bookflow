# 2026-07-16 desktop chat content overflow fix release

## Summary

The previous release fixed chat header overflow, but the production screenshot still showed nested order content and quick phrases clipped at the right edge.

## Root cause

The outer conversation grid could shrink, while the nested context-card auto column and phrase row retained intrinsic minimum widths. Long order text and action content were therefore painted outside the available panel width and clipped by the panel boundary.

## Changes

- Cap the context-card order column at the available width.
- Apply `min-width: 0` and `max-width: 100%` to nested content containers.
- Allow long order text and the edit action to wrap.
- Add a focused static regression assertion for desktop containment.

## Verification

Local checks passed: focused chat checks (24/24), typecheck, lint, project checks (29/29), and production build (22/22 static pages). Deployment verification is pending PR merge.
