#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const app = read("components/marketplace-app.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
const navigation = read("components/marketplace/navigation-state.ts");
const moduleSource = read("components/marketplace/use-conversation-navigation.ts");

assert.match(moduleSource, /markConversationReadWithRecovery/);
assert.match(moduleSource, /hide_closed_conversation/);
assert.match(moduleSource, /bookflow-last-chat-v1/);
assert.match(moduleSource, /resetConversationNavigationState/);
assert.match(navigation, /onExpandedConversationChange/);
assert.match(navigation, /lastConversationId/);
assert.doesNotMatch(navigation, /lastChatStorageKey/);
assert.doesNotMatch(app, /markConversationRead\(/);
assert.doesNotMatch(app, /const \[conversations, setConversations\]/);
assert.doesNotMatch(app, /setConversations\(/);
assert.match(app, /useConversationNavigation\(/);
assert.match(app, /resetConversationNavigation\(\)/);

console.log("Conversation navigation module checks passed.");
