#!/usr/bin/env node

const baseUrl = process.env.RELEASE_BASE_URL?.replace(/\/+$/, "");
const expectedCommit = process.env.EXPECTED_COMMIT?.trim();
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15_000);

const parsedBaseUrl = baseUrl ? new URL(baseUrl) : null;
const isLocal =
  parsedBaseUrl &&
  ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname);
if (
  !parsedBaseUrl ||
  (parsedBaseUrl.protocol !== "https:" &&
    !(isLocal && parsedBaseUrl.protocol === "http:"))
) {
  throw new Error("RELEASE_BASE_URL must be https, except for local smoke tests.");
}

async function probe(path, validate, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "cache-control": "no-cache", ...init.headers },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    await validate(body, response);
    console.log(`PASS ${path} (${response.status})`);
  } finally {
    clearTimeout(timer);
  }
}

await probe("/", async (body, response) => {
  if (!response.headers.get("content-type")?.includes("text/html") || !body) {
    throw new Error("Homepage did not return HTML.");
  }
});

await probe("/api/marketplace/count", async (body) => {
  const data = JSON.parse(body);
  if (!Number.isInteger(data.count) || typeof data.approximate !== "boolean") {
    throw new Error("Marketplace count response has an unexpected shape.");
  }
}, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});

await probe("/api/health/release", async (body) => {
  const data = JSON.parse(body);
  if (data.status !== "ok") throw new Error("Release health endpoint is not healthy.");
  if (expectedCommit && data.commit !== expectedCommit) {
    throw new Error(`Expected commit ${expectedCommit}, received ${data.commit || "unknown"}.`);
  }
});

console.log("Release smoke checks passed.");
