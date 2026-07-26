#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  appendTradeChatMessage,
  beginTradeChatSession,
  buildTradeChatPageState,
  prependOlderTradeMessages,
} from "../components/marketplace/trade-chat-session-policy.ts";

const hook = readFileSync(new URL("../components/marketplace/use-trade-chat-session.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const older = { id: "older", senderId: "seller", imagePaths: [] };
const current = { id: "current", senderId: "buyer", imagePaths: [] };

const pageState = buildTradeChatPageState({
  messages: [older, current],
  hasMore: true,
  nextCursor: { createdAt: "2026-07-26T00:00:00Z", id: "older" },
}, "buyer");
assert.deepEqual(pageState.messages, [older, current]);
assert.equal(pageState.showQuickPhrases, false);

assert.deepEqual(appendTradeChatMessage([current], current), { messages: [current], added: false });
const appended = { id: "new", senderId: "seller", imagePaths: [] };
assert.deepEqual(appendTradeChatMessage([current], appended), { messages: [current, appended], added: true });
assert.deepEqual(prependOlderTradeMessages([current], [older, current]), [older, current]);

const session = beginTradeChatSession();
const firstToken = session.begin();
const secondToken = session.begin();
assert.equal(session.isCurrent(firstToken), false);
assert.equal(session.isCurrent(secondToken), true);
session.dispose();
assert.equal(session.isCurrent(secondToken), false);

assert.match(hook, /useTradeChatSession/);
assert.match(hook, /session\.isCurrent/);
assert.match(hook, /removeChannel/);
assert.match(app, /useTradeChatSession/);

console.log("Trade chat session behavior checks passed (4/4).");
