import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, relative } from "node:path";

export const RELEASE_ARTIFACT_PREFIX = ".ai/artifacts/release-runs/";

const SECRET_FILE_PATTERN = /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|credentials?\.json)$/i;
const SECRET_CONTENT_PATTERNS = [
  { label: "private key material", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { label: "Supabase service key assignment", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=/i },
  { label: "API secret assignment", pattern: /(?:API_KEY|API_SECRET|AUTH_TOKEN|ACCESS_TOKEN|VERCEL_TOKEN|RESEND_API_KEY|GEMINI_API_KEY)\s*=\s*[^\s$]{12,}/i },
  { label: "GitHub token", pattern: /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/i },
  { label: "OpenAI key", pattern: /sk-[A-Za-z0-9_-]{20,}/i },
];

const PROTECTED_FILES = new Set([
  ".github/workflows/rollback-production.yml",
  ".github/workflows/protect-rollback-workflow.yml",
  ".github/CODEOWNERS",
]);

function sortUnique(values) {
  return [...new Set(values)].filter(Boolean).sort();
}

function porcelainPath(entry) {
  return String(entry || "").slice(2).trimStart();
}

export function isReleaseArtifact(file) {
  return file.replaceAll("\\", "/").startsWith(RELEASE_ARTIFACT_PREFIX);
}

export function parsePorcelainFiles(output) {
  return sortUnique(
    String(output || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .map(porcelainPath)
      .filter((file) => file && !isReleaseArtifact(file)),
  );
}

export function collectChangedFiles({ git, baseRef = "origin/main" }) {
  const statusEntries = String(git(["status", "--porcelain=v1"]) || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((entry) => !isReleaseArtifact(porcelainPath(entry)));
  const workingTreeFiles = sortUnique([
    ...parsePorcelainFiles(statusEntries.join("\n")),
    ...String(git(["diff", "--name-only", "HEAD"]) || "")
      .split(/\r?\n/)
      .filter(Boolean),
    ...String(git(["ls-files", "--others", "--exclude-standard"]) || "")
      .split(/\r?\n/)
      .filter(Boolean),
  ].filter((file) => !isReleaseArtifact(file)));

  let baseFiles = [];
  try {
    baseFiles = String(git(["diff", "--name-only", `${baseRef}...HEAD`]) || "")
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((file) => !isReleaseArtifact(file));
  } catch {
    baseFiles = [];
  }

  return {
    statusEntries,
    workingTreeFiles,
    baseFiles: sortUnique(baseFiles),
    changedFiles: sortUnique([...workingTreeFiles, ...baseFiles]),
    untrackedFiles: sortUnique(
      String(git(["ls-files", "--others", "--exclude-standard"]) || "")
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((file) => !isReleaseArtifact(file)),
    ),
    clean: statusEntries.length === 0,
  };
}

export function computeTreeFingerprint(root, files) {
  const hash = createHash("sha256");
  for (const file of sortUnique(files)) {
    const safeFile = file.replaceAll("\\", "/");
    if (isReleaseArtifact(safeFile)) continue;
    const absolute = join(root, safeFile);
    hash.update(`FILE:${safeFile}\n`);
    if (!existsSync(absolute)) {
      hash.update("<deleted>\n");
      continue;
    }
    hash.update(readFileSync(absolute));
    hash.update("\n");
  }
  return hash.digest("hex");
}

export function scanSensitiveFiles(root, files) {
  const findings = [];
  for (const file of sortUnique(files)) {
    const normalizedFile = file.replaceAll("\\", "/");
    if (SECRET_FILE_PATTERN.test(normalizedFile) && !/^\.env\.example$/i.test(normalizedFile)) {
      findings.push({ file: normalizedFile, reason: "sensitive filename" });
      continue;
    }
    const absolute = join(root, normalizedFile);
    if (!existsSync(absolute)) continue;
    let content;
    try {
      content = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const { label, pattern } of SECRET_CONTENT_PATTERNS) {
      if (pattern.test(content)) findings.push({ file: normalizedFile, reason: label });
    }
  }
  return findings;
}

export function scanUnreadableText(root, files) {
  const findings = [];
  for (const file of sortUnique(files)) {
    const normalizedFile = file.replaceAll("\\", "/");
    if (!/\.(?:md|txt|mjs|cjs|js|json|ts|tsx|css|sql|yml|yaml)$/i.test(normalizedFile)) continue;
    const absolute = join(root, normalizedFile);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, "utf8");
    if (content.includes("\uFFFD") || /[\uE000-\uF8FF]/u.test(content)) {
      findings.push({ file: normalizedFile, reason: "replacement or private-use character" });
    }
  }
  return findings;
}

export function protectedFiles(files) {
  return sortUnique(files).filter((file) => PROTECTED_FILES.has(file.replaceAll("\\", "/")));
}

export function migrationFiles(files) {
  return sortUnique(files).filter((file) => /^supabase\/migrations\/.*\.sql$/i.test(file.replaceAll("\\", "/")));
}

export function hasDatabaseChanges(files) {
  return sortUnique(files).some((file) => file.replaceAll("\\", "/").startsWith("supabase/"));
}

export function isFreshReport(report, snapshot) {
  return Boolean(
    report
      && report.schemaVersion === 1
      && report.mode === "full"
      && report.status === "passed"
      && report.treeFingerprint === snapshot.treeFingerprint
      && JSON.stringify(sortUnique(report.changedFiles)) === JSON.stringify(sortUnique(snapshot.changedFiles)),
  );
}

export function buildRemoteGates({ databaseChanges }) {
  return {
    pullRequest: "required",
    staging: databaseChanges ? "required" : "not_applicable",
    vercel: "required",
    productionSmoke: "required",
  };
}

export function redactSensitive(value) {
  return String(value || "")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|API_KEY|API_SECRET|AUTH_TOKEN|ACCESS_TOKEN|VERCEL_TOKEN|RESEND_API_KEY|GEMINI_API_KEY)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{12,}/g, "[REDACTED]");
}

export function relativePath(root, absolute) {
  return normalize(relative(root, absolute)).replaceAll("\\", "/");
}
