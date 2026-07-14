#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migration = readFileSync(join(root, "supabase/migrations/20260714102652_trade_reviews_and_risk_warning.sql"), "utf8");
const app = readFileSync(join(root, "components/marketplace-app.tsx"), "utf8");
const queries = readFileSync(join(root, "lib/marketplace/queries.ts"), "utf8");
const types = readFileSync(join(root, "lib/types.ts"), "utf8");

const checks = [
  ["trade review table", migration.includes("create table if not exists public.trade_reviews")],
  ["completed trade gate", migration.includes("request.status = 'completed'")],
  ["one review per party", migration.includes("unique (request_id, reviewer_id)")],
  ["review tags constraint", migration.includes("trade_reviews_allowed_tags")],
  ["trade completion refresh", migration.includes("refresh_risk_profile_after_trade")],
  ["resolved report refresh", migration.includes("refresh_risk_profile_after_report")],
  ["private risk profile", migration.includes("create table if not exists public.risk_profiles") && migration.includes("revoke all on public.risk_profiles from anon, authenticated")],
  ["approved-only public badge policy", migration.includes("using (status = 'approved')")],
  ["public badge RPC", migration.includes("create or replace function public.get_public_trust_badges")],
  ["moderation risk RPC", migration.includes("create or replace function public.list_risk_profiles_for_moderation")],
  ["policy audit", migration.includes("action, details") && migration.includes("'policy_updated'")],
  ["review RPC client flow", app.includes("submitTradeReview(supabase") && queries.includes('client.rpc("submit_trade_review"')],
  ["trust badge UI", app.includes("badgeFor(") && app.includes("優良賣家") && app.includes("推薦買家")],
  ["risk moderation UI", app.includes("riskProfiles.map") && app.includes("saveRiskPolicy")],
  ["risk types", types.includes("export type RiskProfile") && types.includes("export type TrustBadge")],
];

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) {
  throw new Error(`Risk warning checks failed: ${failed.join(", ")}`);
}
console.log(`Risk warning checks passed (${checks.length}/${checks.length}).`);
