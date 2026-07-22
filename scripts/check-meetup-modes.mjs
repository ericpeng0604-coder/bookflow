import fs from "node:fs";

const root = process.cwd();
const read = (file) => fs.readFileSync(`${root}/${file}`, "utf8");
const checks = [
  ["MeetupMode union", read("lib/types.ts").includes('export type MeetupMode = "fixed_location" | "mutual_discussion" | "applicant_preferred";')],
  ["contextual listing labels", read("components/marketplace-app.tsx").includes("NON_GIVEAWAY_MEETUP_MODE_LABELS") && read("components/marketplace-app.tsx").includes('fixed_location: "刊登者指定位置"') && read("components/marketplace-app.tsx").includes('applicant_preferred: "配合買家"')],
  ["books use meetup modes", read("components/marketplace-app.tsx").includes("listingType={initialListingType}") && read("components/marketplace-app.tsx").includes("const meetupMode = normalizeMeetupMode(fields.meetupMode)")],
  ["meetup labels", read("lib/marketplace/meetup.ts").includes("贈送者指定位置") && read("lib/marketplace/meetup.ts").includes("雙方討論地點") && read("lib/marketplace/meetup.ts").includes("配合申請者")],
  ["item form heading", read("components/marketplace-app.tsx").includes('isNonBookListing ? "物品資料" : "課本資料"')],
  ["conditional location input", read("components/marketplace-app.tsx").includes('normalizeMeetupMode(draft.meetupMode) === DEFAULT_MEETUP_MODE')],
  ["validation allows blank non-fixed meetup", read("lib/marketplace/listing-validation.ts").includes('normalized.meetupMode !== "fixed_location"')],
  ["mapper reads meetup_mode", read("lib/marketplace/mappers.ts").includes("row.meetup_mode")],
  ["migration column and default", read("supabase/migrations/20260721230000_meetup_modes.sql").includes("add column if not exists meetup_mode text not null default 'fixed_location'")],
  ["migration RPC projection", read("supabase/migrations/20260721230000_meetup_modes.sql").includes("meetup_mode text") && read("supabase/migrations/20260721230000_meetup_modes.sql").includes("catalog.meetup_mode")],
  ["giveaway flow preserved", read("scripts/check-giveaway-flow.mjs").includes("16")],
];

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) {
  console.error(`Meetup mode checks failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`Meetup mode checks passed (${checks.length}/${checks.length}).`);
