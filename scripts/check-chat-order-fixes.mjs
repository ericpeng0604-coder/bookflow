#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const migrationSource = readFileSync(
  new URL("../supabase/migrations/20260729120000_remove_ambiguous_purchase_request_rpc.sql", import.meta.url),
  "utf8",
);
const coordinationMigrationSource = readFileSync(
  new URL("../supabase/migrations/20260729155232_shared_purchase_coordination.sql", import.meta.url),
  "utf8",
);
const sharedMeetupInfoMigrationSource = readFileSync(
  new URL("../supabase/migrations/20260730120000_shared_meetup_information.sql", import.meta.url),
  "utf8",
);

assert.match(
  appSource,
  /chat-meetup-details[\s\S]*RequestCoordinationPanel[\s\S]*修改面交資訊/,
  "transaction details should contain the shared meetup summary and modal action",
);
assert.match(appSource, /<ResilientBookCover book=\{book\} \/>/, "market cards should use the resilient cover renderer");
assert.match(appSource, /<ResilientBookCover book=\{book\} variant="listing" \/>/, "dashboard listings should use the resilient cover renderer");
assert.match(appSource, /onError=\{\(\) => setFailedImageUrl\(book\.imageUrl\)\}/, "cover failures should switch to the fallback state");
assert.match(appSource, /暫無封面/, "cover fallback should communicate the unavailable image state");
assert.match(appSource, /function MeetupInfoModal/, "chat should expose a meetup information modal");
assert.match(appSource, /chat-meetup-summary/, "chat should keep the outer transaction card compact");
assert.match(appSource, /canEditMeetupInfo/, "chat editing should use the shared permission helper");
assert.doesNotMatch(appSource, /function MeetupCoordinationEditor/, "the old inline meetup editor should be removed");
assert.match(appSource, /update_purchase_request_coordination/, "chat coordination should persist through its RPC");
assert.match(appSource, /function SellerOrderConfirmationModal/, "seller acceptance should use a confirmation modal");
assert.match(appSource, /seller_confirm_purchase_request/, "seller confirmation should use the atomic confirmation RPC");
assert.match(appSource, /fixed-meetup-badge/, "fixed seller locations should have a visible UI badge");
assert.match(
  cssSource,
  /\.chat-route-page \.chat-context-card \{\s*min-height: 90px;\s*max-height: none;/,
  "chat transaction actions must not be clipped by a fixed desktop context-card height",
);
assert.match(coordinationMigrationSource, /create or replace function public\.update_purchase_request_coordination/, "coordination migration should expose the shared update RPC");
assert.match(coordinationMigrationSource, /Only the buyer or seller can edit meetup coordination/, "coordination updates should authorize both parties");
assert.match(coordinationMigrationSource, /Meetup coordination is locked/, "coordination updates should lock after reservation");
assert.match(coordinationMigrationSource, /create or replace function public\.seller_confirm_purchase_request/, "coordination migration should expose seller confirmation");
assert.match(coordinationMigrationSource, /Meetup location and time are required/, "seller confirmation should require complete meetup details");
assert.match(coordinationMigrationSource, /preferred_meetup_location = normalized_location/, "order and request rows should share normalized meetup values");
assert.match(sharedMeetupInfoMigrationSource, /Only the listing seller can edit a fixed meetup location/, "fixed-location editing should be seller-only");
assert.match(sharedMeetupInfoMigrationSource, /where purchase_order_id = target\.purchase_order_id/, "grouped child requests should receive the same meetup values");
assert.match(sharedMeetupInfoMigrationSource, /revoke all on function public\.update_purchase_request_coordination\(uuid, text, text\) from public, anon/, "meetup RPC should revoke anonymous execution");

assert.match(
  migrationSource,
  /drop function if exists public\.respond_to_purchase_request\(uuid, public\.request_status\);/,
  "the legacy enum overload must be removed so PostgREST can resolve the RPC",
);

console.log("Chat order fix checks passed (details, covers, RPC signature, and action layout).");
