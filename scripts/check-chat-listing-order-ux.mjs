#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");

const checks = [
  ["listing card uses department and course helper", /function cardContextLabel\(book: Book\)[\s\S]*listingContextLabel\(book\)/.test(app) && /cardContextLabel\(book\)/.test(app)],
  ["chat tab loads purchase requests", /if \(tab === "chats"\)[\s\S]*fetchUserRequests\(client\)[\s\S]*return \{ conversations, requests, partyProfiles, requestBooks \}/.test(queries)],
  ["chat panel receives book and active request", /<TradeChatPanel[\s\S]*book=\{book\}[\s\S]*request=\{conversationRequest\}/.test(app)],
  ["chat context card links back to listing", app.includes('className="chat-context-card"') && app.includes("onOpenBook(book.id)")],
  ["seller can respond to request inside chat", app.includes("canRespondToRequest") && app.includes('respondFromChat("accepted")') && app.includes('respondFromChat("rejected")')],
  ["chat safety actions are hidden behind menu", app.includes('className="trade-chat-actions chat-safety-actions"') && app.includes('className="chat-safety-menu"')],
  ["quick phrases stay until a message is sent", /function applyQuickPhrase\(phrase: string\) \{\s*setDraft\(phrase\);\s*\}/.test(app) && /const message = await sendTradeMessage[\s\S]*setShowQuickPhrases\(false\)/.test(app)],
  ["chat submit is guarded against rapid duplicate sends", app.includes("const sendingRef = useRef(false)") && app.includes("sendingRef.current ||") && app.includes("sendingRef.current = true") && app.includes("sendingRef.current = false")],
  ["chat context and safety menu have styles", css.includes(".chat-context-card") && css.includes(".chat-safety-menu")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Chat listing order UX checks passed (${checks.length}/${checks.length}).`);
