#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const helper = readFileSync(new URL("../lib/marketplace/meetup-coordination.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260730120000_shared_meetup_information.sql", import.meta.url), "utf8");

assert.match(helper, /fixed_location/);
assert.match(helper, /awaiting_confirmation/);
assert.match(helper, /MEETUP_INFO_MAX_LENGTH = 120/);
assert.match(migration, /function public\.update_purchase_request_coordination\(\s*target_request_id uuid,\s*preferred_location text default '',\s*preferred_time text default ''/s);
assert.match(migration, /Only the listing seller can edit a fixed meetup location/);
assert.match(migration, /update public\.purchase_orders/);
assert.match(migration, /where purchase_order_id = target\.purchase_order_id/);
assert.match(migration, /revoke all on function public\.update_purchase_request_coordination\(uuid, text, text\) from public, anon/);
assert.match(migration, /grant execute on function public\.update_purchase_request_coordination\(uuid, text, text\) to authenticated/);
assert.match(app, /MeetupInfoModal/);
assert.match(app, /update_purchase_request_coordination/);
assert.match(app, /request-coordination-lines/);
assert.doesNotMatch(app, /chat-meetup-summary/);
assert.doesNotMatch(app, /<div className="request-coordination-note"[^>]*>[\s\S]*<ul>/);
assert.match(app, /查看交易詳情/);
assert.match(app, /onEditMeetupInfo/);

console.log("Shared meetup information contracts passed (14/14).");
