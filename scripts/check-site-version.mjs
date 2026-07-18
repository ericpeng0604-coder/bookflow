import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const version = readFileSync(new URL("../lib/app-version.ts", import.meta.url), "utf8");

assert.match(version, /APP_VERSION\s*=\s*process\.env\.NEXT_PUBLIC_APP_VERSION/);
assert.match(version, /v0\.1\.0-test\.20260718\.06/);
assert.doesNotMatch(app, /className="site-version"/, "the header must not render the old version marker");
assert.match(app, /className="footer-version"/, "the footer must keep the version marker");
assert.match(app, /v\{APP_VERSION\}/, "the footer version must use the build version");

console.log("Site version marker checks passed (5/5).");
