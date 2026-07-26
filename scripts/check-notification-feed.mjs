import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const feed = readFileSync(new URL("../components/marketplace/use-notification-feed.ts", import.meta.url), "utf8");

assert.match(feed, /export function useNotificationFeed/);
assert.match(feed, /fetchNotifications\(client\)/);
assert.match(feed, /fetchUnreadNotificationCount\(client\)/);
assert.match(feed, /runGuarded\("notifications"/);
assert.match(feed, /markRead/);
assert.match(feed, /markAllRead/);
assert.match(feed, /visibilitychange/);
assert.match(feed, /\.in\("id", unreadIds\)\s*\.is\("read_at", null\)/);
assert.match(app, /useNotificationFeed\(\{/);
assert.doesNotMatch(app, /const loadNotificationFeed/);
assert.doesNotMatch(app, /const loadNotificationCount/);
assert.doesNotMatch(app, /async function markNotificationRead/);
assert.doesNotMatch(app, /async function markAllNotificationsRead/);
assert.match(app, /openDashboardTab\("received"\)/);
assert.match(app, /openConversation\(notification\.conversationId\)/);

console.log("Notification feed module checks passed");
