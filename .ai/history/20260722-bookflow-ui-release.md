# BookFlow cumulative UI release

- Scope: cumulative user-facing fixes for market navigation, book listing AI/photo controls, and meetup modes.
- Source: `origin/main` at `adffbaa79902c90e20a73bf0fd803465b319dc1b`.
- Changes: removed duplicate navigation entries; hid the native file row; showed book AI recognition only after upload with floating helper text and one action; applied contextual meetup labels and conditional location input to books and secondhand listings.
- Preserved: giveaway flow, existing meetup migration and mapper contracts, validation, protected recovery files, and unrelated dirty checkout changes.
- Evidence so far: BookFlow Release Center local source/contracts/tests/quality passed; clean-worktree targeted listing, meetup, giveaway, and diff checks passed.
- Remaining: full project checks, typecheck, lint, build, PR checks, merge, Release Production workflow, exact-SHA release health, and production smoke.
