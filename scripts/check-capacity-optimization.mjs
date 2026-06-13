#!/usr/bin/env node

import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/capacity-optimization.sql", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("../lib/marketplace/trade-chat.ts", import.meta.url), "utf8");

const checks = [
  ["trigram catalog index", sql.includes("books_public_search_trgm_idx") && sql.includes("gin_trgm_ops")],
  ["unread notification RPC", sql.includes("count_my_unread_notifications")],
  ["paginated conversation RPC", sql.includes("list_my_conversations_page")],
  ["conversation message index", sql.includes("trade_messages_conversation_sender_created_idx")],
  ["catalog count removed from page fetch", !queries.match(/fetchMarketplacePage[\s\S]*count_books_filtered/)],
  ["workspace tabs load independently", queries.includes("loadWorkspaceTabData")],
  ["notification realtime channel removed", !app.includes("channel(`notifications:")],
  ["chat page size", chat.includes("const CHAT_PAGE_SIZE = 50")],
  ["chat signed URL batch", chat.includes("createSignedUrls")],
  ["immutable image cache", chat.includes('cacheControl: "31536000"')],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Capacity optimization checks passed (${checks.length}/${checks.length}).`);
