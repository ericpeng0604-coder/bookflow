#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, ".next", "bookflow-source.json");
const excludedPath = /^(?:\.next(?:[\\/]|$)|node_modules(?:[\\/]|$)|\.env(?:\.|$)|\.ai[\\/]artifacts(?:[\\/]|$)|outputs(?:[\\/]|$)|work(?:[\\/]|$)|\.codex-remote-attachments(?:[\\/]|$))/i;

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean) : [];
}

export function shouldFingerprintPath(file) {
  const normalized = String(file).replaceAll("\\", "/").replace(/^\.\//, "");
  return normalized.length > 0 && !excludedPath.test(normalized);
}

export function fingerprintParts(parts) {
  const hash = createHash("sha256");
  hash.update("bookflow-source-fingerprint-v1\0");
  for (const part of parts) {
    hash.update(String(part.name ?? ""));
    hash.update("\0");
    hash.update(part.value ?? "");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function readUntrackedFiles(cwd, paths) {
  return paths
    .filter(shouldFingerprintPath)
    .sort()
    .flatMap((file) => {
      const absolute = resolve(cwd, file);
      if (!existsSync(absolute)) return [];
      try {
        return [{ name: `untracked:${file}`, value: readFileSync(absolute) }];
      } catch {
        return [{ name: `untracked:${file}`, value: "[unreadable]" }];
      }
    });
}

export function createSourceManifest(cwd = root, mode = "workspace") {
  const head = git(["rev-parse", "HEAD"], cwd).trim();
  const status = git(["status", "--porcelain=v1"], cwd);
  const untracked = lines(git(["ls-files", "--others", "--exclude-standard"], cwd));
  const diff = git(["diff", "--binary", "HEAD", "--", "."], cwd);
  const parts = [
    { name: "head", value: head },
    { name: "status", value: status },
    { name: "tracked-diff", value: diff },
    ...readUntrackedFiles(cwd, untracked),
  ];
  return {
    schemaVersion: 1,
    mode,
    commit: head,
    dirty: status.length > 0,
    fingerprint: fingerprintParts(parts),
  };
}

export function writeSourceManifest(manifest, outputPath = manifestPath) {
  const absolute = isAbsolute(outputPath) ? outputPath : resolve(root, outputPath);
  const parent = dirname(absolute);
  mkdirSync(parent, { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return absolute;
}

async function fetchLocalSource(baseUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/health/source`, {
      headers: { "cache-control": "no-cache" },
      signal: controller.signal,
    });
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(`local source endpoint returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`local source endpoint returned HTTP ${response.status}: ${body.slice(0, 200)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

export async function checkLocalSource({ cwd = root, baseUrl = null, timeoutMs = 10_000 } = {}) {
  const expected = createSourceManifest(cwd, "workspace");
  const actual = baseUrl
    ? await fetchLocalSource(baseUrl, timeoutMs)
    : JSON.parse(readFileSync(join(cwd, ".next", "bookflow-source.json"), "utf8"));
  const fields = ["schemaVersion", "mode", "commit", "dirty", "fingerprint"];
  const mismatches = fields.filter((field) => actual[field] !== expected[field]);
  if (mismatches.length) {
    throw new Error(`NOT LATEST: local source mismatch in ${mismatches.join(", ")}. Restart with npm run dev:latest.`);
  }
  return { expected, actual };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "current";
  if (command === "current") {
    console.log(JSON.stringify(createSourceManifest(), null, 2));
    return;
  }
  if (command === "manifest") {
    const manifest = createSourceManifest(root, option(args, "--mode", "workspace"));
    const output = writeSourceManifest(manifest, option(args, "--output", manifestPath));
    console.log(`Source manifest written: ${relative(root, output)}`);
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  if (command === "check-local") {
    const result = await checkLocalSource({
      baseUrl: option(args, "--url", null),
      timeoutMs: Number(option(args, "--timeout", "10000")),
    });
    console.log(`Local source passed: ${result.actual.commit} (${result.actual.fingerprint})`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (basename(process.argv[1] || "") === basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`STOP: ${error.message}`);
    process.exitCode = 1;
  });
}
