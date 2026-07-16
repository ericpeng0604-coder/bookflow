import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const reviewApi = readFileSync(
  new URL("../app/api/admin/student-verifications/review/route.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/migrations/20260716135138_student_verification_result_delivery.sql", import.meta.url),
  "utf8",
);

assert.match(app, /ADMIN_MODERATION_REFRESH_INTERVAL_MS = 10_000/);
assert.match(app, /table: "student_verifications"/);
assert.match(app, /setStudentVerifications\(\(previous\) => previous\.filter/);
assert.match(app, /正在送出審核結果/);
assert.match(app, /refreshModerationInBackground\(\)/);
assert.match(app, /client\.removeChannel\(channel\)/);
assert.match(reviewApi, /NextResponse\.json\(\{ ok: true \}\)/);
assert.match(migration, /alter publication supabase_realtime add table public\.student_verifications/);

console.log("Admin moderation refresh checks passed (7/7).");
