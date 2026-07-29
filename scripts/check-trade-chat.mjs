#!/usr/bin/env node

import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../lib/marketplace/trade-chat.ts", import.meta.url), "utf8");
const session = readFileSync(new URL("../lib/marketplace/trade-chat-session.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");

const checks = [
  ["quoted pagination cursor filters", chat.includes("postgrestFilterLiteral")],
  ["send message guards empty rpc row", chat.includes("訊息已送出但無法取得伺服器回應")],
  ["sign images handles missing signed urls", chat.includes("部分圖片無法載入")],
  ["upload rollback helper", chat.includes("deleteChatImageUploads")],
  ["shared trade message mapper export", chat.includes("export function mapTradeMessage")],
  ["chat error mapping helper", chat.includes("export function mapChatError")],
  ["session owns initial load and realtime", /export function useTradeChatSession[\s\S]*fetchTradeMessages[\s\S]*mapTradeMessage/.test(session)],
  ["session keeps messages when signing fails", /setMessages\(page\.messages\)[\s\S]*catch \(signError\)/.test(session)],
  ["session rolls back uploaded images on send failure", session.includes("deleteChatImageUploads(client, uploadedPaths)")],
  ["session owns message pagination and recall", session.includes("loadOlderMessages") && session.includes("recallMessage")],
  ["panel calls the session seam", app.includes("useTradeChatSession") && app.includes("sendSessionMessage(body, files)")],
  ["panel keeps scroll restoration at the UI seam", app.includes("previousScrollHeight") && app.includes("loadOlderSessionMessages()")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Trade chat checks passed (${checks.length}/${checks.length}).`);
