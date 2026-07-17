#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../components/marketplace/navigation-state.ts", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/types.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260717100000_chat_message_summary.sql", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const checks = [
  ["standalone chat route", navigation.includes('MarketplaceView = "home" | "book" | "dashboard" | "chat"') && navigation.includes('params.set("view", "chat")')],
  ["message list summary fields", types.includes("lastMessageSenderId") && types.includes("lastMessagePreview") && queries.includes("fetchConversationsPage")],
  ["summary migration returns preview and sender", migration.includes("last_message_sender_id uuid") && migration.includes("last_message_preview text") && migration.includes("left join lateral")],
  ["conversation pagination control", app.includes("loadMoreConversations") && app.includes("conversationHasMore") && app.includes("載入更多訊息")],
  ["realtime inbox sorting", app.includes("conversation-summaries:") && app.includes("updateConversationActivity") && app.includes("mergeConversationSummaries")],
  ["date separators and grouped messages", app.includes("chat-date-divider") && app.includes("message-group-continued") && app.includes("messageDateKey")],
  ["message actions behind menu", app.includes('aria-label="訊息操作"') && app.includes("message-action-menu") && app.includes("reportChat(message.id)")],
  ["send retry and upload progress", app.includes("重試送出") && app.includes("uploadProgress") && app.includes("uploadChatImages")],
  ["removable image previews", app.includes("chat-upload-preview") && app.includes("removeSelectedFile") && app.includes("移除第")],
  ["collapsible transaction context", app.includes("chat-context-toggle") && app.includes("contextOpen") && app.includes("商品與交易資訊")],
  ["chat log live region", app.includes('aria-live="polite"') && app.includes("aria-busy={loading}"),],
  ["standalone chat owns viewport scroll", css.includes(".chat-route-page") && css.includes("position: fixed") && css.includes(".chat-route-page .trade-chat-log")],
  ["visible label uses message", !app.includes("聊聊")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
if (failed.length > 0) process.exit(1);
console.log(`Professional message UX checks passed (${checks.length}/${checks.length}).`);
