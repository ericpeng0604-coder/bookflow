export const REQUIRED_HANDOFF_SECTIONS = [
  "Task title",
  "Release context",
  "Completed work",
  "Next steps",
  "Changed files",
  "Verification",
  "Risks and blockers",
  "AI follow-up",
  "Commit",
];

export const UNREADABLE_TEXT_PATTERN =
  /[\uFFFD\uE000-\uF8FF]|\u922D|\u6470|\u9708|\u6498|\u95AE|\u9788|\u747C|\u6840/u;

export function sectionContent(markdown, title) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start === -1) return "";

  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  return lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
}

export function missingHandoffSections(markdown) {
  return REQUIRED_HANDOFF_SECTIONS.filter(
    (section) => !sectionContent(markdown, section),
  );
}

export function renderHandoffDraft({
  taskId = "<task-id>",
  title = "<task title>",
  branch = "<branch>",
  baseCommit = "<base-commit>",
  currentCommit = "<current-or-pending-commit>",
  historyFile = ".ai/history/<date-task>.md",
} = {}) {
  return `# BookFlow AI Handoff

## Task title

${title}

## Release context

- Task ID: \`${taskId}\`.
- Task: \`${title}\`.
- Branch: \`${branch}\`.
- Base commit: \`${baseCommit}\`.
- History: \`${historyFile}\`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add \`Rollback-Workflow-Approved: true\` unless this is an authorized rollback/recovery change.

## Completed work

- Not started yet.

## Next steps

1. Implement the scoped change.
2. Run the required local checks.
3. Commit, run \`node scripts/release-preflight.mjs\`, then open a PR.
4. After merge, verify production with \`/api/health/release\` and \`release:smoke\`.

## Changed files

- ${historyFile}

## Verification

- Not verified yet.

## Risks and blockers

- None known yet.

## AI follow-up

1. Replace every placeholder in this handoff with confirmed facts.
2. Keep \`AI_HANDOFF.md\`, \`.ai/state.json\`, and the matching \`.ai/history/*.md\` in sync.
3. Run \`node scripts/ai-collaboration.mjs check-ci origin/main HEAD\` before opening or merging the PR.

## Commit

- Base commit: \`${baseCommit}\`.
- Current implementation commit before final commit: \`${currentCommit}\`.
`;
}
