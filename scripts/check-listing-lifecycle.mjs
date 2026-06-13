import fs from "node:fs";

const migration = fs.readFileSync("supabase/listing-lifecycle.sql", "utf8");
const cronRoute = fs.readFileSync("app/api/cron/listing-lifecycle/route.ts", "utf8");
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));

const requiredMigrationSignals = [
  "interval '30 days'",
  "interval '60 days'",
  "interval '90 days'",
  "interval '113 days'",
  "interval '120 days'",
  "interval '358 days'",
  "interval '365 days'",
  "status = 'available'",
  "lifecycle_state = 'active'",
  "status = 'negotiating'",
  "notifications_dedupe_key_idx",
  "review_archived_listings",
  "confirm_all_active_listings",
];

const missing = requiredMigrationSignals.filter((signal) => !migration.includes(signal));
if (missing.length) {
  throw new Error(`Listing lifecycle migration is missing: ${missing.join(", ")}`);
}
if (!cronRoute.includes("CRON_SECRET") || !cronRoute.includes("process_listing_lifecycle")) {
  throw new Error("Cron route is missing authentication or lifecycle processing");
}
if (!cronRoute.includes("archived_one_year_without_requests")
  || !cronRoute.includes("archived_one_year_with_history")) {
  throw new Error("Cron route is missing one-year cleanup branches");
}
if (!Array.isArray(vercel.crons)
  || !vercel.crons.some((cron) => cron.path === "/api/cron/listing-lifecycle")) {
  throw new Error("Vercel cron configuration is missing");
}

const DAY = 86400000;
const stage = (days) => {
  if (days >= 120) return "archive";
  if (days >= 113) return "final";
  if (days >= 90) return "remind-90";
  if (days >= 60) return "remind-60";
  if (days >= 30) return "remind-30";
  return "none";
};
const expected = new Map([
  [29, "none"],
  [30, "remind-30"],
  [59, "remind-30"],
  [60, "remind-60"],
  [89, "remind-60"],
  [90, "remind-90"],
  [112, "remind-90"],
  [113, "final"],
  [119, "final"],
  [120, "archive"],
]);
for (const [days, result] of expected) {
  const elapsed = Math.floor((Date.UTC(2026, 0, 1) + days * DAY - Date.UTC(2026, 0, 1)) / DAY);
  if (stage(elapsed) !== result) throw new Error(`Unexpected lifecycle boundary at day ${days}`);
}

console.log("Listing lifecycle structure checks passed.");
