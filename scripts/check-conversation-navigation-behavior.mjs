#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  markConversationReadLocally,
  markConversationReadWithRecovery,
  removeConversation,
  restoreConversationId,
} = await import("../components/marketplace/conversation-navigation-policy.ts");
const policy = readFileSync(new URL("../components/marketplace/conversation-navigation-policy.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

assert.deepEqual(
  markConversationReadLocally([{ id: "a", unreadCount: 2 }], "a"),
  [{ id: "a", unreadCount: 0 }],
);
assert.equal(restoreConversationId("missing", [{ id: "a" }]), null);
assert.deepEqual(removeConversation([{ id: "a" }, { id: "b" }], "a"), [{ id: "b" }]);
let refreshed = false;
await assert.rejects(
  markConversationReadWithRecovery("a", {
    markRead: async () => { throw new Error("read failed"); },
    refresh: async () => { refreshed = true; },
  }),
  /read failed/,
);
assert.equal(refreshed, true);

assert.match(policy, /markConversationReadWithRecovery/);
assert.match(policy, /await actions\.refresh\(\)/);
assert.match(policy, /storedId && conversations\.some/);
assert.match(policy, /filter\(\(conversation\) => conversation\.id !== conversationId\)/);
assert.doesNotMatch(
  app.slice(app.indexOf("function TradeChatPanel")),
  /markConversationRead\(/,
  "TradeChatPanel must use the navigation read seam",
);

console.log("Conversation navigation behavior checks passed (4/4).");
