#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");
const handoffPreferencesMigration = readFileSync(new URL("../supabase/migrations/20260704160000_purchase_request_handoff_preferences.sql", import.meta.url), "utf8");
const livePurchaseRequestFixMigration = readFileSync(new URL("../supabase/migrations/20260705224319_fix_live_purchase_request_function.sql", import.meta.url), "utf8");
const sellerCancelMigration = readFileSync(new URL("../supabase/migrations/20260705100000_seller_cancel_reserved_request.sql", import.meta.url), "utf8");

const checks = [
  ["listing card uses department and course helper", /function cardContextLabel\(book: Book\)[\s\S]*listingContextLabel\(book\)/.test(app) && /cardContextLabel\(book\)/.test(app)],
  ["chat tab loads purchase requests", /if \(tab === "chats"\)[\s\S]*fetchUserRequests\(client\)[\s\S]*return \{ conversations, conversationPage, requests, partyProfiles, requestBooks\b/.test(queries)],
  ["chat panel receives book and active request", /<TradeChatPanel[\s\S]*book=\{book\}[\s\S]*request=\{conversationRequest\}/.test(app)],
  ["chat context card links back to listing", app.includes("chat-context-card") && app.includes("onOpenBook(book.id)")],
  ["seller can respond to request inside chat", app.includes("canRespondToRequest") && app.includes('respondFromChat("accepted")') && app.includes('respondFromChat("rejected")')],
  ["request modal captures meetup preferences and message jump", app.includes('name="preferredMeetupLocation"') && app.includes('name="preferredMeetupTime"') && app.includes("先去訊息確認")],
  ["buyer can edit meetup preferences from chat before seller handoff", app.includes("canEditRequestFromChat") && app.includes("onEditRequest") && app.includes("修改面交資訊")],
  ["request modal rehydrates saved purchase fields", /const initialMessage = request\?\.message \|\| REQUEST_PHRASES\[0\]/.test(app) && /setPreferredMeetupLocation\(initialPreferredMeetupLocation\)/.test(app) && /setPreferredMeetupTime\(initialPreferredMeetupTime\)/.test(app)],
  ["chat safety actions are hidden behind menu", app.includes('className="trade-chat-actions chat-safety-actions"') && app.includes('className="chat-safety-menu"')],
  ["quick phrases stay until a message is sent", /function applyQuickPhrase\(phrase: string\) \{\s*setDraft\(phrase\);\s*\}/.test(app) && /const message = await sendTradeMessage[\s\S]*setShowQuickPhrases\(false\)/.test(app)],
  ["chat submit is guarded against rapid duplicate sends", app.includes("const sendingRef = useRef(false)") && app.includes("sendingRef.current ||") && app.includes("sendingRef.current = true") && app.includes("sendingRef.current = false")],
  ["chat does not force-scroll while reading older messages", app.includes("stickToBottomRef") && app.includes("hasUnreadBelow") && app.includes('className="chat-new-message-button"')],
  ["new message jump only scrolls the chat log", app.includes("function scrollChatLogToBottom") && app.includes("log.scrollTo({ top: log.scrollHeight, behavior })") && !app.includes("bottomRef.current?.scrollIntoView")],
  ["chat preserves scroll when loading older messages", app.includes("previousScrollHeight") && app.includes("previousScrollTop") && app.includes("heightDelta")],
  ["chat compose uses multiline input and dedicated phrase scroller", app.includes("<textarea") && app.includes('className="trade-chat-phrases-scroll"') && css.includes(".trade-chat-compose textarea")],
  ["seller can keep tracking completed orders", app.includes("sellerRequestNextStep") && app.includes('"completed"].includes(request.status)') && app.includes('className="order-next-step"')],
  ["standalone message route owns chat scrolling", app.includes('className="chat-page-toolbar"') && app.includes('chat-route-page') && /\.chat-route-page\s*\{\s*position:\s*fixed/.test(css) && css.includes(".chat-route-page .trade-chat-log")],
  ["mobile chat rail remains usable for switching", !app.includes("onClickCapture") && css.includes("minmax(118px, 34vw)") && css.includes("-webkit-line-clamp: 2")],
  ["book detail reload keeps existing order state", queries.includes("fetchActiveRequestForBook") && app.includes("fetchActiveRequestForBook") && app.includes("已下訂：")],
  ["handoff preference migration checks the existing books table", handoffPreferencesMigration.includes("from public.books") && !handoffPreferencesMigration.includes("marketplace_listings")],
  ["live purchase request fix migration replaces the broken function", livePurchaseRequestFixMigration.includes("create or replace function public.create_purchase_request") && livePurchaseRequestFixMigration.includes("from public.books") && !livePurchaseRequestFixMigration.includes("marketplace_listings")],
  ["seller can cancel reserved handoff in migration", sellerCancelMigration.includes("actor = target_book.seller_id") && sellerCancelMigration.includes("target.status in ('reserved', 'awaiting_confirmation')")],
  ["chat context and safety menu have styles", css.includes(".chat-context-card") && css.includes(".chat-safety-menu")],
  ["mobile chat long text has wrapping styles", css.includes(".trade-chat-bubble p") && css.includes("overflow-wrap: anywhere") && css.includes(".chat-new-message-button")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Chat listing order UX checks passed (${checks.length}/${checks.length}).`);
