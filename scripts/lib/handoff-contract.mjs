export const REQUIRED_HANDOFF_SECTIONS = [
  "任務目標",
  "目前狀態與背景",
  "已完成",
  "下一步",
  "變更檔案",
  "驗證結果",
  "風險與注意事項",
  "下一位 AI 工作指引",
  "相關 Commit",
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
  title = "<任務標題>",
  branch = "<branch>",
  baseCommit = "<base-commit>",
  currentCommit = "<current-or-pending-commit>",
  historyFile = ".ai/history/<date-task>.md",
} = {}) {
  return `# BookFlow AI Handoff

## 任務目標

${title}

## 目前狀態與背景

- Branch: \`${branch}\`.
- Base commit: \`${baseCommit}\`.
- No database migration is included unless listed here.
- No GitHub workflow or protected recovery file is changed unless explicitly listed here.
- Do not add \`Rollback-Workflow-Approved: true\` unless this is an authorized rollback/recovery change.

## 已完成

- Not started yet.

## 下一步

1. Implement the scoped change.
2. Run the required local checks.
3. Commit, run \`node scripts/release-preflight.mjs\`, then open a PR.
4. After merge, verify production with \`/api/health/release\` and \`release:smoke\`.

## 變更檔案

- ${historyFile}

## 驗證結果

- Not verified yet.

## 風險與注意事項

- None known yet.

## 下一位 AI 工作指引

1. Replace every placeholder in this handoff with confirmed facts.
2. Keep \`AI_HANDOFF.md\`, \`.ai/state.json\`, and the matching \`.ai/history/*.md\` in sync.
3. Run \`node scripts/ai-collaboration.mjs check-ci origin/main HEAD\` before opening or merging the PR.

## 相關 Commit

- Base commit: \`${baseCommit}\`.
- Current implementation commit before final commit: \`${currentCommit}\`.
`;
}
