#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260729120000_remove_ambiguous_purchase_request_rpc.sql", import.meta.url),
  "utf8",
);

assert.match(
  appSource,
  /\{contextDetailsOpen && <RequestCoordinationPanel request=\{request\} viewer=\{isSeller \? "seller" : "buyer"\} \/>\}/,
  "transaction details should render only after the details button is activated",
);
assert.match(appSource, /<ResilientBookCover book=\{book\} \/>/, "market cards should use the resilient cover renderer");
assert.match(appSource, /<ResilientBookCover book=\{book\} variant="listing" \/>/, "dashboard listings should use the resilient cover renderer");
assert.match(appSource, /onError=\{\(\) => setFailedImageUrl\(book\.imageUrl\)\}/, "cover failures should switch to the fallback state");
assert.match(appSource, /暫無封面/, "cover fallback should communicate the unavailable image state");
assert.match(
  migrationSource,
  /drop function if exists public\.respond_to_purchase_request\(uuid, public\.request_status\);/,
  "the legacy enum overload must be removed so PostgREST can resolve the RPC",
);

console.log("Chat order fix checks passed (details, covers, and RPC signature).");
