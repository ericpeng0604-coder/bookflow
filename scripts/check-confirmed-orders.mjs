import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/marketplace/navigation-state.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");

assert.match(navigation, /DashboardTab = .*"confirmedOrders"/);
assert.match(navigation, /dashboardTabs = .*"confirmedOrders"/);
assert.match(navigation, /params\.set\("view", "chat"\)/);
assert.match(navigation, /buildChatUrl\(listingType, conversationId\)/);
assert.match(navigation, /if \(dashboardTab === "chats"\) \{[\s\S]*return buildChatUrl\(listingType, expandedConversationId\);/);
assert.match(app, /CONFIRMED_ORDER_STATUSES = new Set<RequestStatus>\(\["reserved", "awaiting_confirmation", "completed"\]\)/);
assert.match(app, /const confirmedOrders = currentUser/);
assert.match(app, /request\.buyerId === currentUser\.id \|\| book\?\.sellerId === currentUser\.id/);
assert.match(app, /request\.buyerId === currentUser\.id && !CONFIRMED_ORDER_STATUSES\.has\(request\.status\)/);
assert.match(app, /!CONFIRMED_ORDER_STATUSES\.has\(request\.status\)[\s\S]*requestBookSource\.some/);
assert.match(app, /dashboardTab === "confirmedOrders"/);
assert.match(app, /confirmed-orders-list/);
assert.match(queries, /tab: .*"confirmedOrders"/);

console.log("Confirmed orders and unified chat route checks passed (12/12).");
