# 20260703 Restore Homepage Price Color

## Summary

Restored the homepage listing card price color to the prior effective value.

## Evidence

- Previous effective selector before the color change: `.home-page .card-footer strong`.
- Previous effective color: `#2b3f38`.
- Current change: `app/globals.css` uses `#2b3f38` for homepage listing card prices.

## Release Notes

- No database migration.
- No protected recovery files changed.
- Production verification should use `RELEASE_BASE_URL=https://bookflow-green.vercel.app` and the exact merged commit SHA.
