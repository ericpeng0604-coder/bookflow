import { existsSync, readFileSync, writeFileSync } from "node:fs";

const packagePath = new URL("../package.json", import.meta.url);
const lockfilePath = new URL("../package-lock.json", import.meta.url);
const bumpType = process.argv[2] || "patch";

if (bumpType !== "patch") {
  console.error("Usage: node scripts/bump-version.mjs patch");
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!match) {
  console.error(`Unsupported package version: ${packageJson.version}`);
  process.exit(1);
}

const currentVersion = packageJson.version;
const nextVersion = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
packageJson.version = nextVersion;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

if (existsSync(lockfilePath)) {
  const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
  lockfile.version = nextVersion;
  if (lockfile.packages?.[""]) lockfile.packages[""].version = nextVersion;
  writeFileSync(lockfilePath, `${JSON.stringify(lockfile, null, 2)}\n`);
}

console.log(`Version bumped: ${currentVersion} -> ${nextVersion}`);
