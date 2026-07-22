#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { createSourceManifest, writeSourceManifest } from "./release-source.mjs";

const root = process.cwd();
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);
const portIndex = args.findIndex((arg) => arg === "-p" || arg === "--port");
const port = portIndex >= 0 && args[portIndex + 1] ? args[portIndex + 1] : "3000";

if (!existsSync(nextBin)) {
  throw new Error("Next.js is unavailable. Install dependencies in this worktree before starting the latest preview.");
}

const cleanup = spawnSync(process.execPath, [join(root, "scripts", "dev-environment.mjs"), "--fix"], {
  cwd: root,
  stdio: "inherit",
});
if (cleanup.status !== 0) process.exit(cleanup.status ?? 1);

const manifest = createSourceManifest(root, "workspace");
writeSourceManifest(manifest);
console.log("BookFlow latest local preview");
console.log(`Source commit: ${manifest.commit}`);
console.log(`Source fingerprint: ${manifest.fingerprint}`);
console.log(`Working tree: ${manifest.dirty ? "dirty (included)" : "clean"}`);
console.log(`Source check: npm run check:local-source -- --url http://127.0.0.1:${port}`);
console.log(`Release dashboard: http://127.0.0.1:${port}/release`);

const child = spawn(process.execPath, [nextBin, "dev", ...args], {
  cwd: root,
  env: {
    ...process.env,
    BOOKFLOW_SOURCE_MODE: "workspace",
    BOOKFLOW_SOURCE_COMMIT: manifest.commit,
    BOOKFLOW_SOURCE_FINGERPRINT: manifest.fingerprint,
    BOOKFLOW_SOURCE_DIRTY: String(manifest.dirty),
    BOOKFLOW_RELEASE_DASHBOARD_ENABLED: "true",
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
