import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/multi-party-orders-and-safe-chat.sql", import.meta.url), "utf8");

const checks = [
  ["24-hour seller reminder", /interval '24 hours'/],
  ["72-hour request expiry", /interval '72 hours'/],
  ["7-day reservation", /interval '7 days'/],
  ["48-hour buyer confirmation", /interval '48 hours'/],
  ["waitlist pauses while reserved", /set status = 'waitlisted'/],
  ["waitlist resumes after cancellation", /set status = 'pending'.*status = 'waitlisted'/s],
  ["sold notifications include favorites", /from public\.favorites where book_id = target\.book_id/],
  ["idempotent notification keys", /notifications_dedupe_key_idx|on conflict \(dedupe_key\)/],
  ["private chat image bucket", /'chat-images', 'chat-images', false/],
  ["message recall deadline", /interval '10 minutes'/],
  ["repeat order updates active request", /event_type, actor_id\)\s*values \(existing_request\.id, 'request_updated'/],
  ["order parties can open chat", /function public\.open_order_conversation\(target_request_id uuid\)/],
  ["hourly Supabase cron", /process-trade-deadlines-hourly/],
];

const failures = checks.filter(([, pattern]) => !pattern.test(sql));
if (failures.length > 0) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log(`Trade workflow checks passed (${checks.length}/${checks.length}).`);
