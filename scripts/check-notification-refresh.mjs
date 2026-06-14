import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/request-update-notification-dedupe.sql", import.meta.url),
  "utf8",
);

assert.match(
  app,
  /\.in\("id", unreadIds\)\s*\.is\("read_at", null\)/,
  "opening notifications must only mark the fetched unread notification IDs",
);
assert.match(
  app,
  /if \(view === "dashboard" && store\.currentUser\)[\s\S]*loadUserWorkspace/,
  "clicking My Transactions while already open must refresh the active tab",
);
assert.match(
  app,
  /visibilitychange[\s\S]*loadUserWorkspace/,
  "returning to a visible dashboard must refresh the active tab",
);
assert.match(
  migration,
  /'request-updated:' \|\| existing_request\.id::text[\s\S]*on conflict \(dedupe_key\)[\s\S]*read_at = null/,
  "repeat purchase-request edits must update one unread notification",
);

console.log("Notification and transaction refresh checks passed (4/4).");
