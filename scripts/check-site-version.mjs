import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../lib/app-version.ts", import.meta.url), "utf8");

assert.match(version, /APP_VERSION\s*=\s*process\.env\.NEXT_PUBLIC_APP_VERSION/);
assert.match(version, /v0\.1\.0-test\.20260718\.06/);
assert.match(app, /className="site-version"/);
assert.match(app, /APP_VERSION/);

console.log("Site version marker checks passed (4/4).");
