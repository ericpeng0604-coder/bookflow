#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

assert.match(appSource, /function ResilientBookCover/, "the app should define one resilient book cover renderer");
assert.match(appSource, /<ResilientBookCover book=\{book\} \/>/, "market and favorite cards should use the resilient cover renderer");
assert.match(appSource, /<ResilientBookCover book=\{book\} variant="listing" \/>/, "dashboard listings should use the resilient cover renderer");
assert.match(appSource, /onError=\{\(\) => setFailedImageUrl\(book\.imageUrl\)\}/, "cover failures should switch to the fallback state");
assert.match(appSource, /暫無封面/, "cover fallback should communicate the unavailable image state");
assert.match(cssSource, /\.card-image-fallback/, "card fallback should have a visible style");
assert.match(cssSource, /\.listing-image-placeholder/, "listing fallback should have a stable style hook");

console.log("Book image resilience checks passed (market, favorites, and dashboard listings).");
