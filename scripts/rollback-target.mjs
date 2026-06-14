import { execFileSync } from "node:child_process";

export function selectRollbackTarget(commits, previousTargets = new Set()) {
  for (const commit of commits) {
    if (commit.ignore || previousTargets.has(commit.sha)) continue;
    return commit;
  }
  return null;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

export function readFirstParentCandidates(ref = "origin/main") {
  const shas = git(["rev-list", "--first-parent", ref])
    .split(/\r?\n/)
    .filter(Boolean);

  return shas.map((sha) => {
    const message = git(["show", "-s", "--format=%B", sha]);
    return {
      sha,
      subject: git(["show", "-s", "--format=%s", sha]),
      ignore:
        /^Rollback-Ignore: true$/m.test(message) ||
        /^Rollback-Workflow-Approved: true$/m.test(message),
    };
  });
}

export function readPreviousTargets(ref = "origin/main") {
  const messages = git(["log", "--first-parent", "--format=%B%x00", ref]);
  return new Set(
    [...messages.matchAll(/^Rollback-Target: ([0-9a-f]{40})$/gim)].map(
      (match) => match[1],
    ),
  );
}
