import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(scriptsDir, "..", "..");

export function resolveNodeExecutable() {
  if (process.execPath && existsSync(process.execPath)) {
    return process.execPath;
  }
  return "node";
}

export function nodeSupportsStripTypes() {
  const result = spawnSync(
    resolveNodeExecutable(),
    ["--experimental-strip-types", "-e", "import('node:fs');"],
    { encoding: "utf8" },
  );
  return result.status === 0;
}

export async function importTypeScriptModule(relativePath) {
  const absolutePath = join(projectRoot, relativePath);
  const moduleUrl = `${pathToFileURL(absolutePath).href}?check=${Date.now()}`;
  return import(moduleUrl);
}

export function extractExportFunction(source, name) {
  const marker = `export function ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Could not find export function ${name}`);
  }

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) {
    throw new Error(`Could not find body for export function ${name}`);
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Could not extract export function ${name}`);
}

export function normalizeTypeScriptForMirrorCompare(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\bexport\b/g, "")
    .replace(/<[A-Za-z_$][\w$]*(?:,\s*[A-Za-z_$][\w$]*)?>/g, "")
    .replace(/:\s*\(\s*signal\s*:\s*AbortSignal\s*\)\s*=>\s*Promise(?:<[^>]+>)?/g, "")
    .replace(/:\s*\(\s*signal\s*\)\s*=>\s*Promise\b/g, "")
    .replace(/\)\s*:\s*Promise(?:<[^>]+>)?\s*\{/g, ") {")
    .replace(/:\s*unknown\b/g, "")
    .replace(/:\s*string\b/g, "")
    .replace(/:\s*AbortSignal\b/g, "")
    .replace(/:\s*Promise<[^>]+>/g, "")
    .replace(/:\s*Map<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mirrorFingerprint(source) {
  return createHash("sha256").update(normalizeTypeScriptForMirrorCompare(source)).digest("hex");
}

export function runNodeScript(relativeScriptPath, { stripTypes = false } = {}) {
  const scriptPath = join(projectRoot, relativeScriptPath);
  const args = stripTypes ? ["--experimental-strip-types", scriptPath] : [scriptPath];
  execFileSync(resolveNodeExecutable(), args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
}
