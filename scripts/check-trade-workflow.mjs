import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/multi-party-orders-and-safe-chat.sql", import.meta.url), "utf8");

const checks = [
  ["24-hour seller reminder", /interval '24 hours'/],
  ["7-day pending request expiry", /status = 'pending' and created_at <= reference_time - interval '7 days'/],
  ["pending expiry notification says book is retained", /課本仍會保留在原刊登狀態/],
  ["7-day reservation", /interval '7 days'/],
  ["48-hour buyer confirmation", /interval '48 hours'/],
  ["waitlist pauses while reserved", /set status = 'waitlisted'/],
  ["waitlist resumes after cancellation", /set status = 'pending'.*status = 'waitlisted'/s],
  ["sold notifications include favorites", /from public\.favorites where book_id = target\.book_id/],
  ["idempotent notification keys", /notifications_dedupe_key_idx|on conflict \(dedupe_key\)/],
  ["private chat image bucket", /'chat-images', 'chat-images', false/],
  ["message recall deadline", /interval '10 minutes'/],
  ["repeat order updates active request", /event_type, actor_id\)\s*values \(existing_request\.id, 'request_updated'/],
  ["repeat order notification is merged", /'request-updated:' \|\| existing_request\.id::text[\s\S]*do update set[\s\S]*read_at = null/],
  ["order parties can open chat", /function public\.open_order_conversation\(target_request_id uuid\)/],
  ["hourly Supabase cron", /process-trade-deadlines-hourly/],
];

const pendingExpiryBlock = sql.match(/for item in select \* from public\.purchase_requests\s+where status = 'pending' and created_at <= reference_time - interval '7 days'[\s\S]*?end loop;/)?.[0] ?? "";
if (/update public\.books|delete from public\.books|set_listing_lifecycle/i.test(pendingExpiryBlock)) {
  console.error("FAIL: pending request expiry must not remove, hide, or update the book");
  process.exit(1);
}

const failures = checks.filter(([, pattern]) => !pattern.test(sql));
if (failures.length > 0) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log(`Trade workflow checks passed (${checks.length}/${checks.length}).`);
