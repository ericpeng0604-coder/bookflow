#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const lockfilePath = join(root, "package-lock.json");
const allowedInstallScriptPackages = new Set([
  "@sentry/cli",
  "fsevents",
  "sharp",
  "tesseract.js",
  "unrs-resolver",
]);

function packageName(packagePath) {
  const marker = "node_modules/";
  const index = packagePath.lastIndexOf(marker);
  if (index < 0) return packagePath;
  const name = packagePath.slice(index + marker.length);
  if (name.startsWith("@")) {
    const parts = name.split("/");
    return parts.slice(0, 2).join("/");
  }
  return name.split("/")[0];
}

export function validateLock(lock) {
  assert.equal(lock.lockfileVersion, 3, "package-lock.json must use lockfileVersion 3");
  const packages = lock.packages;
  assert.ok(packages && typeof packages === "object", "package-lock.json must contain packages");

  for (const [path, entry] of Object.entries(packages)) {
    if (path === "" || !entry || typeof entry !== "object" || !entry.version) continue;
    assert.ok(entry.integrity, `${path} is missing an integrity hash`);
    if (entry.resolved) {
      assert.match(
        entry.resolved,
        /^https:\/\/registry\.npmjs\.org\//,
        `${path} must resolve from registry.npmjs.org`,
      );
    }
    if (entry.hasInstallScript) {
      const name = packageName(path);
      assert.ok(
        allowedInstallScriptPackages.has(name),
        `unexpected lifecycle-script package: ${name}`,
      );
    }
  }
  return { packageCount: Object.keys(packages).length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lock = JSON.parse(readFileSync(lockfilePath, "utf8"));
  const result = validateLock(lock);
  console.log(
    `Dependency install-script guard passed (${result.packageCount} lockfile entries; allowlist: ${[...allowedInstallScriptPackages].join(", ")}).`,
  );
}
