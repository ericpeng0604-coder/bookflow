#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(join(root, "components", "marketplace-app.tsx"), "utf8");
const types = await readFile(join(root, "lib", "types.ts"), "utf8");
const migration = await readFile(join(root, "supabase", "migrations", "20260721160000_zero_giveaway_flow.sql"), "utf8");
const navigation = await readFile(join(root, "components", "marketplace", "navigation-state.ts"), "utf8");
const giveaway = await readFile(join(root, "lib", "marketplace", "giveaway.ts"), "utf8");

const checks = [
  [types, 'ListingType = "book" | "secondhand" | "giveaway"', "giveaway listing type"],
  [navigation, 'targetMarket === "giveaway"', "URL market parsing"],
  [source, 'switchListingType("giveaway")', "third market tab"],
  [source, 'price: String(fields.listingType) === "giveaway" ? 0', "frontend zero price"],
  [source, 'name="message"', "optional application message field"],
  [source, 'giveawayRequestLabel(request.status)', "giveaway status display"],
  [source, 'verifiedPartyIds.has(request.buyerId)', "verified applicant badge and ordering"],
  [giveaway, '尚未選定受贈者，贈送者正在確認領取安排。', "pre-selection chat banner"],
  [migration, "create_giveaway_request", "dedicated create RPC"],
  [migration, "select_giveaway_recipient", "atomic recipient selection RPC"],
  [migration, "respond_to_giveaway_recipient", "recipient response RPC"],
  [migration, "giveaway_confirm_handoff", "bilateral handoff confirmation RPC"],
  [migration, "process_giveaway_deadlines", "deadline cron RPC"],
  [migration, "price = 0", "database zero price constraint"],
  [migration, "awaiting_recipient_confirmation", "recipient confirmation state"],
  [migration, "on conflict (dedupe_key)", "deduplicated notifications"],
];

for (const [text, needle, label] of checks) {
  if (!text.includes(needle)) throw new Error(`Giveaway check failed: ${label}`);
}

console.log(`Giveaway flow checks passed (${checks.length}/${checks.length}).`);
