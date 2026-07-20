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
  /const openDashboard = useCallback[\s\S]*if \(store\.currentUser\)[\s\S]*loadDashboardWorkspace\(store\.currentUser, "listings"\)/,
  "clicking My Transactions must refresh the listings dashboard",
);
assert.match(
  app,
  /visibilitychange[\s\S]*loadDashboardWorkspace/,
  "returning to a visible dashboard must refresh the active tab",
);
assert.match(
  app,
  /const loadDashboardWorkspace[\s\S]*\[tab, "requests" as const\]/,
  "opening My Transactions must preload purchase requests before the requests tab is clicked",
);
assert.match(
  migration,
  /'request-updated:' \|\| existing_request\.id::text[\s\S]*on conflict \(dedupe_key\)[\s\S]*read_at = null/,
  "repeat purchase-request edits must update one unread notification",
);
assert.match(
  migration,
  /'request-created:' \|\| created_id::text[\s\S]*on conflict \(dedupe_key\)[\s\S]*do nothing/,
  "a new purchase request must create an idempotent seller notification inside the RPC",
);

console.log("Notification and transaction refresh checks passed (6/6).");
