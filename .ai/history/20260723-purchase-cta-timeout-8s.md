## 2026-07-23 follow-up

- Found production CTA still stuck after 9 seconds despite the 8-second AbortController. Root cause: the React effect depended on its own loading/key state, so setting loading triggered cleanup and ignored the first query result.
- Fixed the effect dependencies, added a regression check, and reran focused 30/30, typecheck, lint, tests 22/22, and build successfully.
- Previous production SHA d0e88fc3d35e763891d33ea03b0a2dbc4c1ddb4b remains deployed; this follow-up requires a new PR and protected release.
