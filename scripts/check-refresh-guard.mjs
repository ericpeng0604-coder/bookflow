#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportFunction,
  importTypeScriptModule,
  nodeSupportsStripTypes,
  normalizeTypeScriptForMirrorCompare,
  projectRoot,
} from "./lib/check-runner.mjs";

const sourcePath = join(projectRoot, "lib/marketplace/refresh-guard.ts");
const source = readFileSync(sourcePath, "utf8");

assert.match(source, /export function runGuarded/, "refresh-guard.ts must export runGuarded");
assert.match(source, /export function isAbortError/, "refresh-guard.ts must export isAbortError");

/**
 * Fallback mirror used only when Node cannot import TypeScript directly.
 * Keep this block synchronized with lib/marketplace/refresh-guard.ts.
 */
const mirrorSource = `
function runGuarded(key, task) {
  inFlight.get(key)?.abort();
  const controller = new AbortController();
  const promise = task(controller.signal).finally(() => {
    const current = inFlight.get(key);
    if (current?.promise === promise) {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, {
    promise,
    abort: () => controller.abort(),
  });
  return promise;
}

function isAbortError(error) {
  return error instanceof DOMException && error.name === "AbortError";
}
`;

function extractMirrorComparableFunctions(moduleSource) {
  return [
    extractExportFunction(moduleSource, "runGuarded"),
    extractExportFunction(moduleSource, "isAbortError"),
  ].join("\n");
}

const tsComparable = extractMirrorComparableFunctions(source);
const tsNormalized = normalizeTypeScriptForMirrorCompare(tsComparable);
const mirrorNormalized = normalizeTypeScriptForMirrorCompare(mirrorSource);

assert.equal(
  tsNormalized,
  mirrorNormalized,
  [
    "refresh-guard mirror drift detected; update scripts/check-refresh-guard.mjs or lib/marketplace/refresh-guard.ts",
    `TS: ${tsNormalized}`,
    `Mirror: ${mirrorNormalized}`,
  ].join("\n"),
);

let runGuarded;
let isAbortError;
let importMode = "typescript";

if (nodeSupportsStripTypes()) {
  ({ runGuarded, isAbortError } = await importTypeScriptModule("lib/marketplace/refresh-guard.ts"));
} else {
  importMode = "mirror";
  const inFlight = new Map();
  ({ runGuarded, isAbortError } = {
    runGuarded(key, task) {
      inFlight.get(key)?.abort();
      const controller = new AbortController();
      const promise = task(controller.signal).finally(() => {
        const current = inFlight.get(key);
        if (current?.promise === promise) {
          inFlight.delete(key);
        }
      });
      inFlight.set(key, {
        promise,
        abort: () => controller.abort(),
      });
      return promise;
    },
    isAbortError(error) {
      return error instanceof DOMException && error.name === "AbortError";
    },
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitUnlessAborted(signal, ms) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runTests() {
  const firstResult = await runGuarded("marketplace", async () => "done");
  assert.equal(firstResult, "done");

  let firstSignal;
  let secondSignal;
  const firstStarted = runGuarded("workspace", async (signal) => {
    firstSignal = signal;
    await waitUnlessAborted(signal, 50);
    return "first";
  });
  await delay(0);
  const secondStarted = runGuarded("workspace", async (signal) => {
    secondSignal = signal;
    return "second";
  });

  assert.equal(firstSignal.aborted, true);
  assert.equal(secondSignal.aborted, false);
  assert.equal(await secondStarted, "second");
  await assert.rejects(firstStarted, (error) => isAbortError(error));

  let isolatedFirstSignal;
  let isolatedSecondSignal;
  const isolatedFirst = runGuarded("moderation", async (signal) => {
    isolatedFirstSignal = signal;
    await delay(50);
    return "moderation";
  });
  const isolatedSecond = runGuarded("notifications", async (signal) => {
    isolatedSecondSignal = signal;
    await delay(10);
    return "notifications";
  });

  assert.equal(isolatedFirstSignal.aborted, false);
  assert.equal(isolatedSecondSignal.aborted, false);
  assert.equal(await isolatedFirst, "moderation");
  assert.equal(await isolatedSecond, "notifications");

  assert.equal(isAbortError(new DOMException("Aborted", "AbortError")), true);
  assert.equal(isAbortError(new DOMException("Other", "NetworkError")), false);
  assert.equal(isAbortError(new Error("AbortError")), false);
  assert.equal(isAbortError(null), false);
}

await runTests();
console.log(`Refresh guard checks passed (${importMode}, 7/7).`);
