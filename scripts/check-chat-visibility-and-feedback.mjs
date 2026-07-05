#!/usr/bin/env node

import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../components/marketplace-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const queries = readFileSync(new URL("../lib/marketplace/queries.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260615090000_chat_visibility_and_feedback.sql", import.meta.url),
  "utf8",
);

const checks = [
  ["signup is the default auth view", app.includes('useState<"login" | "signup" | "forgot">("signup")')],
  ["mobile chat has a back control", app.includes('className="chat-mobile-back"') && app.includes("onBack={() => setExpandedConversationId(null)}")],
  ["mobile chat list rail remains readable and switchable", !app.includes("onClickCapture") && css.includes("minmax(118px, 34vw)") && css.includes("-webkit-line-clamp: 2")],
  ["closed chat exposes per-user hide", app.includes('conversation.status === "closed"') && app.includes('rpc("hide_closed_conversation"')],
  ["hidden chats are excluded from both list RPCs", (migration.match(/conversation_user_preferences/g) || []).length >= 5],
  ["issue report form is authenticated", app.includes('modal === "feedback" && currentUser')],
  ["issue reports load into moderation", queries.includes("fetchFeedbackForModeration") && app.includes("setFeedback(data.feedback)")],
  ["issue report submission is rate limited", migration.includes("Daily feedback limit reached")],
  ["issue report moderation requires moderator permission", migration.includes("list_feedback_for_moderation") && migration.includes("public.is_moderator()")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"}: ${name}`);
}
if (failed.length > 0) process.exit(1);
console.log(`Chat visibility and feedback checks passed (${checks.length}/${checks.length}).`);
