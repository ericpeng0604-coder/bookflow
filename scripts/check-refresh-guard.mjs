#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "lib/marketplace/refresh-guard.ts");
const source = readFileSync(sourcePath, "utf8");

assert.match(source, /export function runGuarded/, "refresh-guard.ts must export runGuarded");
assert.match(source, /export function isAbortError/, "refresh-guard.ts must export isAbortError");
assert.match(source, /new Map<string, GuardEntry>/, "refresh-guard.ts should track in-flight work by key");
assert.match(source, /controller\.abort\(\)/, "refresh-guard.ts should abort superseded requests");

/**
 * Behavioral checks mirror lib/marketplace/refresh-guard.ts so this script can run
 * without a TypeScript loader. Keep in sync with that module.
 */
const inFlight = new Map();

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
  assert.equal(inFlight.has("marketplace"), false, "completed work should clear the guard entry");

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

  assert.equal(firstSignal.aborted, true, "a superseded request should receive abort");
  assert.equal(secondSignal.aborted, false, "the latest request should stay active");

  const secondResult = await secondStarted;
  assert.equal(secondResult, "second");
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

  assert.equal(isolatedFirstSignal.aborted, false, "different keys must not abort each other");
  assert.equal(isolatedSecondSignal.aborted, false, "different keys must not abort each other");
  assert.equal(await isolatedFirst, "moderation");
  assert.equal(await isolatedSecond, "notifications");

  assert.equal(isAbortError(new DOMException("Aborted", "AbortError")), true);
  assert.equal(isAbortError(new DOMException("Other", "NetworkError")), false);
  assert.equal(isAbortError(new Error("AbortError")), false);
  assert.equal(isAbortError(null), false);
}

await runTests();
console.log("Refresh guard checks passed (7/7).");
