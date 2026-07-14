#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const app = read("components/marketplace-app.tsx");
const css = read("app/globals.css");
const queries = read("lib/marketplace/queries.ts");
const countRoute = read("app/api/marketplace/count/route.ts");
const migration = read("supabase/migrations/20260714131615_six_marketplace_fixes.sql");

assert.match(app, /notification\.type === "handoff_confirmation"[\s\S]{0,180}openDashboardTab\("requests"\)/);
assert.match(app, /activeRequestCheckState/);
assert.match(app, /activeRequestCheckState !== "ready"/);
assert.match(app, /compressBookOcrImage/);
assert.match(app, /recognizeBookCoverWithAi\(supabase, ocrImageFile/);
assert.match(app, /previousAuto/);
assert.match(app, /MIN_PRICE_500/);
assert.match(app, /marketplaceFilters\.minPrice/);
assert.match(app, /chat-list-toggle/);
assert.match(app, /chat-list-collapsed/);
assert.match(css, /\.mobile-menu\s*\{\s*display:\s*grid\s*!important/);
assert.match(css, /\.conversation-layout\.chat-list-collapsed/);
assert.match(queries, /p_min_price:\s*filters\.minPrice/);
assert.match(countRoute, /p_min_price:\s*filters\.minPrice/);
assert.match(migration, /b\.price >= p_min_price/);
assert.match(migration, /purchase_requests_one_active_per_buyer/);
assert.match(migration, /status in \('pending', 'waitlisted', 'reserved', 'awaiting_confirmation'\)/);

console.log("Six marketplace fixes checks passed.");
